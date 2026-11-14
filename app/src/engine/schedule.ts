// Rest-opportunity calculator (SRS section 10, Team plan S-06, contract D-8). Pure: no UI imports.
// Intervals are half-open [start, end). Blocked time for a task = [start - prep - travel, end).
// The rest opportunity is the LONGEST continuous free block inside the rest window.
// An unknown or invalid rest window is "not_computable" and never reported as 0.
import type { MissionSchedule } from '../data/contract'

export interface ScheduleItemInput {
  item_id: string
  label?: string
  start: string // ISO UTC
  end: string // ISO UTC
  is_fixed: boolean
  prep_minutes?: number | null
  travel_minutes?: number | null
  movable_earliest_start?: string | null
  movable_latest_end?: string | null
}

export interface RestWindowInput {
  start: string | null
  end: string | null
}

export interface ScheduleChange {
  item_id: string
  new_start: string
  new_end: string
}

export interface RestOpportunityResult {
  status: 'improved' | 'no_valid_alternative' | 'not_computable'
  current_minutes: number | null
  best_minutes: number | null
  current_total_minutes: number | null
  best_total_minutes: number | null
  changes: ScheduleChange[]
}

type Interval = [number, number]
const MIN = 60_000
const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}
const isoOf = (t: number) => new Date(t).toISOString().replace('.000Z', 'Z')

function blockedOf(it: { start: number; end: number; prep: number; travel: number }): Interval {
  return [it.start - (it.prep + it.travel) * MIN, it.end]
}

function union(intervals: Interval[]): Interval[] {
  const s = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0])
  const out: Interval[] = []
  for (const iv of s) {
    const last = out[out.length - 1]
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
    else out.push([iv[0], iv[1]])
  }
  return out
}

/** Free minutes in the window: [longest continuous, total]. */
export function freeMinutes(window: Interval, blocked: Interval[]): [number, number] {
  const clipped = union(blocked.map(([a, b]) => [Math.max(a, window[0]), Math.min(b, window[1])] as Interval))
  let cursor = window[0]
  let longest = 0
  let total = 0
  for (const [a, b] of clipped) {
    if (a > cursor) {
      longest = Math.max(longest, a - cursor)
      total += a - cursor
    }
    cursor = Math.max(cursor, b)
  }
  if (window[1] > cursor) {
    longest = Math.max(longest, window[1] - cursor)
    total += window[1] - cursor
  }
  return [Math.round(longest / MIN), Math.round(total / MIN)]
}

/** Where the longest free block sits (ISO start/end), for drawing. null when the window or an item time is unreadable. */
export function longestFreeBlock(window: RestWindowInput | null, items: ScheduleItemInput[]): { start: string; end: string } | null {
  const w0 = ms(window?.start), w1 = ms(window?.end)
  if (w0 === null || w1 === null || w1 <= w0) return null
  const blocked: Interval[] = []
  for (const it of items) {
    const a = ms(it.start), b = ms(it.end)
    if (a === null || b === null) return null
    blocked.push(blockedOf({ start: a, end: b, prep: it.prep_minutes ?? 0, travel: it.travel_minutes ?? 0 }))
  }
  const clipped = union(blocked.map(([a, b]) => [Math.max(a, w0), Math.min(b, w1)] as Interval))
  let cursor = w0
  let best: Interval | null = null
  for (const [a, b] of [...clipped, [w1, w1] as Interval]) {
    if (a > cursor && (!best || a - cursor > best[1] - best[0])) best = [cursor, a]
    cursor = Math.max(cursor, b)
  }
  return best ? { start: isoOf(best[0]), end: isoOf(best[1]) } : null
}

const overlaps = (a: Interval, b: Interval) => a[0] < b[1] && b[0] < a[1]

interface Parsed {
  id: string
  start: number
  end: number
  prep: number
  travel: number
  fixed: boolean
  earliest: number | null
  latest: number | null
}

export function restOpportunity(input: {
  rest_window: RestWindowInput | null
  items: ScheduleItemInput[]
  step_minutes?: number
}): RestOpportunityResult {
  const step = (input.step_minutes ?? 15) * MIN
  const ws = ms(input.rest_window?.start)
  const we = ms(input.rest_window?.end)
  const none: RestOpportunityResult = {
    status: 'not_computable', current_minutes: null, best_minutes: null, current_total_minutes: null, best_total_minutes: null, changes: [],
  }
  if (ws === null || we === null || we <= ws) return none

  const items: Parsed[] = []
  for (const it of input.items) {
    const s = ms(it.start)
    const e = ms(it.end)
    if (s === null || e === null || e <= s) return none // an unreadable task makes the window unknowable
    items.push({
      id: it.item_id, start: s, end: e, prep: it.prep_minutes ?? 0, travel: it.travel_minutes ?? 0, fixed: it.is_fixed,
      earliest: ms(it.movable_earliest_start), latest: ms(it.movable_latest_end),
    })
  }
  const window: Interval = [ws, we]
  const [cur, curTotal] = freeMinutes(window, items.map(blockedOf))

  // Candidate positions for each movable item that blocks part of the window.
  const movable = items.filter((it) => !it.fixed && it.earliest !== null && it.latest !== null && overlaps(blockedOf(it), window))
  type Candidate = { changes: { id: string; start: number; end: number }[]; longest: number; total: number; shift: number }
  const evaluate = (moves: Map<string, { start: number; end: number }>): Candidate | null => {
    const placed = items.map((it) => ({ ...it, ...(moves.get(it.id) ?? {}) }))
    // Tasks may not overlap each other (including prep and travel).
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++)
        if (moves.has(placed[i].id) || moves.has(placed[j].id))
          if (overlaps(blockedOf(placed[i]), blockedOf(placed[j]))) return null
    const [longest, total] = freeMinutes(window, placed.map(blockedOf))
    const changes = [...moves.entries()].map(([id, p]) => ({ id, ...p }))
    const shift = changes.reduce((s, c) => s + Math.abs(c.start - (items.find((i) => i.id === c.id)!.start)), 0)
    return { changes, longest, total, shift }
  }

  const options = new Map<string, { start: number; end: number }[]>()
  for (const it of movable) {
    const dur = it.end - it.start
    const list: { start: number; end: number }[] = []
    for (let s = it.earliest as number; s + dur <= (it.latest as number); s += step) {
      if (s === it.start) continue
      // The moved block (with prep/travel) must stay inside the allowed range.
      if (s - (it.prep + it.travel) * MIN < (it.earliest as number)) continue
      list.push({ start: s, end: s + dur })
    }
    options.set(it.id, list)
  }

  const candidates: Candidate[] = []
  for (const it of movable) for (const p of options.get(it.id) ?? []) {
    const c = evaluate(new Map([[it.id, p]]))
    if (c) candidates.push(c)
  }
  // Pairs of moves, only when there are two or more movable items.
  for (let a = 0; a < movable.length; a++)
    for (let b = a + 1; b < movable.length; b++)
      for (const pa of options.get(movable[a].id) ?? [])
        for (const pb of options.get(movable[b].id) ?? []) {
          const c = evaluate(new Map([[movable[a].id, pa], [movable[b].id, pb]]))
          if (c) candidates.push(c)
        }

  // Rank: longer continuous rest, then more total rest, then fewer changes, then smaller shift, then earlier.
  candidates.sort(
    (x, y) => y.longest - x.longest || y.total - x.total || x.changes.length - y.changes.length || x.shift - y.shift ||
      x.changes[0].start - y.changes[0].start,
  )
  const best = candidates[0]
  if (!best || best.longest <= cur) {
    return { status: 'no_valid_alternative', current_minutes: cur, best_minutes: cur, current_total_minutes: curTotal, best_total_minutes: curTotal, changes: [] }
  }
  return {
    status: 'improved',
    current_minutes: cur,
    best_minutes: best.longest,
    current_total_minutes: curTotal,
    best_total_minutes: best.total,
    changes: best.changes.map((c) => ({ item_id: c.id, new_start: isoOf(c.start), new_end: isoOf(c.end) })),
  }
}

/** Builds the calculator input from mission_schedule records for one mission day. */
export function scheduleInputFor(records: MissionSchedule[], missionDay: string) {
  const day = records.filter((r) => r.mission_day === missionDay)
  const w = day.find((r) => r.item_kind === 'rest_window')
  return {
    rest_window: w ? { start: w.start_at, end: w.end_at } : null,
    items: day
      .filter((r) => r.item_kind === 'task')
      .map((r) => ({
        item_id: r.mission_schedule_id, label: r.activity_label, start: r.start_at, end: r.end_at, is_fixed: r.is_fixed,
        prep_minutes: r.prep_minutes ?? 0, travel_minutes: r.travel_minutes ?? 0,
        movable_earliest_start: r.movable_earliest_start ?? null, movable_latest_end: r.movable_latest_end ?? null,
      })),
  }
}

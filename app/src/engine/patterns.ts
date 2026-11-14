// FR-PE-07: one descriptive pattern in the astronaut's own record. Pure: no React, no I/O.
// It counts how often two observations happen together (a short night, and a Decode round below the personal
// range the morning after). It never says why, never ranks or recommends anything, and opens no finding or step.
// Missing stays missing: a night with no valid Decode round the morning after is listed, never counted as below or within.
import type { DecodeSession, PersonalReference, SleepRecord } from '../data/contract'
import { addDays } from './mission'
import { compareToReference } from './reference'
import { STARTER_RULES } from './rules.starter'
import { infoStatusOf, type DataSet } from './view'

/**
 * Short night when no usable personal sleep reference exists: the same threshold the rules use
 * (R-PLAN-01 counts nights "under 6 hours" via the fact sleep.nights_under_6h_last3 in rules.ts computeFacts).
 */
export const SHORT_NIGHT_RULE_ID = 'R-PLAN-01'
export const SHORT_NIGHT_RULE_HOURS = 6

export type NightKind = 'short' | 'other'
export type PairOutcome = 'below_range' | 'within_range' | 'above_range' | 'no_decode' | 'not_comparable'

export interface PatternPair {
  /** Morning date: the sleep record's observation_date (the night that ended that morning) and the Decode date. */
  date: string
  sleepId: string
  sleepHours: number
  kind: NightKind
  /** The first non-practice Decode round that morning, or null when there was none. */
  decodeId: string | null
  decode: number | null
  outcome: PairOutcome
}

export interface PatternGroup {
  kind: NightKind
  nights: number
  /** Mornings with a valid Decode round compared to the personal range. */
  compared: number
  below: number
  pairs: PatternPair[]
}

export interface ShortNightBasis {
  hours: number
  basis: 'sleep_reference' | 'rule'
  /** personal_reference id when basis is sleep_reference. */
  referenceId: string | null
  ruleId: string | null
  ruleVersion: string | null
  sourceId: string | null
}

export type PatternState = 'pattern' | 'no_decode_reference' | 'no_short_nights' | 'nothing_comparable'

export interface SleepDecodePattern {
  state: PatternState
  shortNight: ShortNightBasis
  decodeReference: PersonalReference | null
  /** First morning in the window: the day after the Decode reference period ends. */
  from: string | null
  to: string
  short: PatternGroup
  other: PatternGroup
  /** Every record the counts rest on, for "Why?". */
  recordIds: string[]
}

const latest = <T extends { created_at_utc: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.created_at_utc.localeCompare(b.created_at_utc)).at(-1) ?? null

const hoursOf = (s: SleepRecord) => (s.recorded_interval_ms === null ? null : s.recorded_interval_ms / 3_600_000)

/** What counts as a short night for this person: below their own sleep reference range, else the rule threshold. */
export function shortNightBasis(d: DataSet): ShortNightBasis {
  const ref = latest((d.personal_reference ?? []).filter((p) => p.metric_code === 'sleep_duration'))
  if (ref && ref.reference_status === 'usable_for_question' && typeof ref.range_low === 'number') {
    return { hours: ref.range_low, basis: 'sleep_reference', referenceId: ref.personal_reference_id, ruleId: null, ruleVersion: null, sourceId: null }
  }
  const rule = STARTER_RULES.find((r) => r.id === SHORT_NIGHT_RULE_ID) ?? null
  return {
    hours: SHORT_NIGHT_RULE_HOURS, basis: 'rule', referenceId: null,
    ruleId: SHORT_NIGHT_RULE_ID, ruleVersion: rule?.version ?? null, sourceId: rule?.source_id ?? null,
  }
}

function group(kind: NightKind, pairs: PatternPair[]): PatternGroup {
  const mine = pairs.filter((p) => p.kind === kind)
  const compared = mine.filter((p) => p.outcome === 'below_range' || p.outcome === 'within_range' || p.outcome === 'above_range')
  return { kind, nights: mine.length, compared: compared.length, below: compared.filter((p) => p.outcome === 'below_range').length, pairs: mine }
}

/**
 * Nights in the comparison period (after the Decode reference period, up to `to`), each paired with the Decode
 * round of the morning after. Only valid sleep records count as nights; a Decode round is compared only when its
 * data status is valid, exactly as Record & trends does.
 */
export function sleepDecodePattern(d: DataSet, opts: { to: string }): SleepDecodePattern {
  const basis = shortNightBasis(d)
  const ref = latest((d.personal_reference ?? []).filter((p) => p.metric_code === 'decode_correct_count'))
  const empty = (kind: NightKind): PatternGroup => ({ kind, nights: 0, compared: 0, below: 0, pairs: [] })
  if (!ref || ref.reference_status !== 'usable_for_question' || ref.range_low == null || ref.range_high == null) {
    return { state: 'no_decode_reference', shortNight: basis, decodeReference: ref, from: null, to: opts.to, short: empty('short'), other: empty('other'), recordIds: ref ? [ref.personal_reference_id] : [] }
  }
  const from = addDays(ref.end_date, 1)
  const status = (id: string) => infoStatusOf(d, id).status

  const nights = new Map<string, SleepRecord>()
  for (const s of [...(d.sleep_record ?? [])].sort((a, b) => a.sleep_record_id.localeCompare(b.sleep_record_id))) {
    if (s.observation_date < from || s.observation_date > opts.to) continue
    if (status(s.sleep_record_id) !== 'valid' || hoursOf(s) === null) continue
    nights.set(s.observation_date, s)
  }
  const sessions = new Map<string, DecodeSession[]>()
  for (const s of [...(d.decode_session ?? [])].sort((a, b) => a.start_at_utc.localeCompare(b.start_at_utc))) {
    if (s.is_practice) continue
    const day = s.start_at_utc.slice(0, 10)
    sessions.set(day, [...(sessions.get(day) ?? []), s])
  }

  const pairs: PatternPair[] = [...nights.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, s]) => {
    const h = hoursOf(s) as number
    const kind: NightKind = h < basis.hours ? 'short' : 'other'
    const all = sessions.get(date) ?? []
    const session = all.find((x) => status(x.decode_session_id) === 'valid') ?? all[0] ?? null
    let outcome: PairOutcome = 'no_decode'
    if (session) {
      if (status(session.decode_session_id) !== 'valid') outcome = 'not_comparable'
      else {
        const c = compareToReference({ value: session.correct_count, reference: { ...ref, range_low: ref.range_low ?? null, range_high: ref.range_high ?? null } })
        outcome = c.position === 'not_comparable' ? 'not_comparable' : c.position
      }
    }
    return {
      date, sleepId: s.sleep_record_id, sleepHours: Math.round(h * 10) / 10, kind,
      decodeId: session?.decode_session_id ?? null, decode: session?.correct_count ?? null, outcome,
    }
  })

  const short = group('short', pairs)
  const other = group('other', pairs)
  const state: PatternState = short.nights === 0 ? 'no_short_nights' : short.compared === 0 ? 'nothing_comparable' : 'pattern'
  const recordIds = [
    ...pairs.flatMap((p) => (p.decodeId ? [p.sleepId, p.decodeId] : [p.sleepId])),
    ref.personal_reference_id,
    ...(basis.referenceId ? [basis.referenceId] : []),
  ]
  return { state, shortNight: basis, decodeReference: ref, from, to: opts.to, short, other, recordIds }
}

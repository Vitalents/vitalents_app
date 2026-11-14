// Record & trends (UI-07, UI-06): pure helpers that turn an indicator's history and its reference
// versions into what the trend chart, its table and the reference panel show. No React, no I/O.
// Missing stays null (contract D-3); a non-valid value is kept but never drawn as a valid point.
import type { FollowUp, PersonalReference } from '../data/contract'
import { addDays } from './mission'
import { compareToReference, type ComparisonResult } from './reference'
import { indexRecords, indicatorOf, type DataSet, type InfoStatus } from './view'

export interface HistoryItem { date: string; value: number | null; status: InfoStatus; id: string }

export type PointKind = 'valid' | 'problem' | 'no_reading'

export interface TrendPoint {
  date: string
  /** Record behind the point; null for a day with no record at all. */
  id: string | null
  value: number | null
  status: InfoStatus
  kind: PointKind
  /** Chart channels: exactly one is set (or none), so a non-valid value never joins the valid line. */
  valid: number | null
  problem: number | null
  /** Whether the record is one of the reference's source records. */
  inReference: boolean
  /** Change from the reference, only for valid values after the reference period. */
  comparison: ComparisonResult | null
}

/**
 * One point per record, and for daily indicators one "No reading" point for every day without a record
 * between the first record and `to`. Several records on one day stay separate points (FR-DEC-08).
 */
export function buildTrend(history: HistoryItem[], opts: { to: string; daily: boolean; reference?: PersonalReference | null }): TrendPoint[] {
  const ref = opts.reference ?? null
  const used = new Set(ref?.source_record_ids ?? [])
  const rows = history.filter((h) => h.date <= opts.to).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const toPoint = (h: HistoryItem): TrendPoint => {
    const kind: PointKind = h.value === null || h.status === 'no_reading' ? 'no_reading' : h.status === 'valid' ? 'valid' : 'problem'
    const value = kind === 'no_reading' ? null : h.value
    const comparable = kind === 'valid' && ref !== null && h.date > ref.end_date
    return {
      date: h.date, id: h.id, value, status: kind === 'no_reading' ? 'no_reading' : h.status, kind,
      valid: kind === 'valid' ? value : null,
      problem: kind === 'problem' ? value : null,
      inReference: used.has(h.id),
      comparison: comparable
        ? compareToReference({ value, reference: { ...ref, range_low: ref.range_low ?? null, range_high: ref.range_high ?? null } })
        : null,
    }
  }
  const points = rows.map(toPoint)
  if (!opts.daily || rows.length === 0) return points
  const seen = new Set(rows.map((r) => r.date))
  const filled: TrendPoint[] = [...points]
  for (let day = rows[0].date; day <= opts.to; day = addDays(day, 1)) {
    if (!seen.has(day)) {
      filled.push({ date: day, id: null, value: null, status: 'no_reading', kind: 'no_reading', valid: null, problem: null, inReference: false, comparison: null })
    }
  }
  return filled.sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? '').localeCompare(b.id ?? ''))
}

export interface TrendSummary { valid: number; problem: number; noReading: number; latest: TrendPoint | null; latestWithValue: TrendPoint | null }

export function summarizeTrend(points: TrendPoint[]): TrendSummary {
  return {
    valid: points.filter((p) => p.kind === 'valid').length,
    problem: points.filter((p) => p.kind === 'problem').length,
    noReading: points.filter((p) => p.kind === 'no_reading').length,
    latest: points[points.length - 1] ?? null,
    latestWithValue: [...points].reverse().find((p) => p.value !== null) ?? null,
  }
}

/** Y range that holds every value and the reference band, padded and rounded outward. Never invents a 0 floor. */
export function trendDomain(points: TrendPoint[], ref?: PersonalReference | null): [number, number] | null {
  const vals = points.flatMap((p) => (p.value === null ? [] : [p.value]))
  for (const v of [ref?.range_low, ref?.range_high, ref?.reference_value]) if (typeof v === 'number') vals.push(v)
  if (vals.length === 0) return null
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const pad = Math.max((hi - lo) * 0.15, Math.abs(hi) * 0.02, 0.5)
  const step = hi - lo + 2 * pad > 20 ? 5 : hi - lo + 2 * pad > 4 ? 1 : 0.5
  return [Math.floor((lo - pad) / step) * step, Math.ceil((hi + pad) / step) * step]
}

/** Round axis ticks inside a domain: the smallest of 0.5, 1, 2, 5, 10 … that gives at most 6 ticks. */
export function trendTicks([lo, hi]: [number, number]): number[] {
  const steps = [0.5, 1, 2, 5, 10, 20, 50, 100]
  const step = steps.find((s) => Math.floor(hi / s) - Math.ceil(lo / s) + 1 <= 6) ?? 100
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100)
  return out
}

/** All versions of the reference for one metric, oldest first (FR-REF-03). */
export function referenceVersions(refs: PersonalReference[], metric: string): PersonalReference[] {
  return refs
    .filter((r) => r.metric_code === metric)
    .sort((a, b) => a.created_at_utc.localeCompare(b.created_at_utc) || a.reference_version.localeCompare(b.reference_version))
}

export type ChangeField = 'reference_status' | 'reference_value' | 'range_low' | 'range_high' | 'valid_record_count' | 'start_date' | 'end_date' | 'method' | 'frozen'
const CHANGE_FIELDS: ChangeField[] = ['reference_status', 'reference_value', 'range_low', 'range_high', 'valid_record_count', 'start_date', 'end_date', 'method', 'frozen']

export interface ChangeLogEntry {
  from: PersonalReference
  to: PersonalReference
  at: string
  changes: { field: ChangeField; before: string | number | boolean | null; after: string | number | boolean | null }[]
  addedRecords: string[]
  removedRecords: string[]
}

/** One entry per new version: what changed from the version before it. The first version has no entry. */
export function referenceChangeLog(versions: PersonalReference[]): ChangeLogEntry[] {
  const out: ChangeLogEntry[] = []
  for (let i = 1; i < versions.length; i++) {
    const a = versions[i - 1]
    const b = versions[i]
    const get = (r: PersonalReference, f: ChangeField) => (r[f] ?? null) as string | number | boolean | null
    const changes = CHANGE_FIELDS.filter((f) => get(a, f) !== get(b, f)).map((f) => ({ field: f, before: get(a, f), after: get(b, f) }))
    const before = new Set(a.source_record_ids)
    const after = new Set(b.source_record_ids)
    out.push({
      from: a, to: b, at: b.created_at_utc, changes,
      addedRecords: b.source_record_ids.filter((id) => !before.has(id)),
      removedRecords: a.source_record_ids.filter((id) => !after.has(id)),
    })
  }
  return out.reverse() // newest first
}

/** Records inside the reference period that the reference did not use, with their data status. */
export function excludedFromReference(points: TrendPoint[], ref: PersonalReference): TrendPoint[] {
  const used = new Set(ref.source_record_ids)
  return points.filter((p) => p.id !== null && p.date >= ref.start_date && p.date <= ref.end_date && !used.has(p.id))
}

const OPEN = (f: FollowUp) => f.followup_status !== 'closed' && f.followup_status !== 'no_open_follow_up'

/**
 * Open follow-ups on the reference's indicator (FR-REF-04): follow_up -> action -> finding, where the finding
 * rests on this reference or on a record of the same indicator.
 */
export function openFollowUpsForReference(d: DataSet, ref: PersonalReference): FollowUp[] {
  const idx = new Map(indexRecords(d).map((r) => [r.id, r]))
  return d.follow_up.filter(OPEN).filter((fu) => {
    const action = d.action.find((a) => a.action_id === fu.action_id)
    const finding = action?.finding_id ? d.finding.find((f) => f.finding_id === action.finding_id) : undefined
    return (finding?.supporting_record_ids ?? []).some((id) => {
      if (id === ref.personal_reference_id) return true
      const rec = idx.get(id)
      return rec ? rec.entity !== 'personal_reference' && indicatorOf(rec) === ref.metric_code : false
    })
  })
}

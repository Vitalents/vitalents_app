// Personal reference v1 (contract D-10) and comparison. Pure functions, no UI imports.
// Ported from the contract until science/reference.py lands; must reproduce contracts/vectors.
import type { PersonalReference } from '../data/contract'

/** A later revision must never change the reference displayed for an earlier review date. */
export function referenceForDate(refs: PersonalReference[], metric: string, date: string, subjectId?: string, asOf?: string): PersonalReference | null {
  return refs.filter((r) => r.metric_code === metric && (!subjectId || r.subject_id === subjectId)
    && r.created_at_utc.slice(0, 10) <= date && (!asOf || Date.parse(r.created_at_utc) <= Date.parse(asOf)) && r.end_date < date
    && (!r.comparison_target_date || r.comparison_target_date <= date))
    .sort((a, b) => a.created_at_utc.localeCompare(b.created_at_utc) || a.reference_version.localeCompare(b.reference_version))
    .at(-1) ?? null
}

export interface HistoryPoint {
  record_id: string
  date: string // YYYY-MM-DD
  value: number | null
  info_status: string
  is_practice: boolean
  session_index: number
}

export interface ReferenceParams {
  lookback_days: number
  min_valid: number
  exclude_first_sessions: number
  method: 'median'
}

export interface ReferenceResult {
  reference_status: 'not_built' | 'provisional' | 'usable_for_question' | 'needs_review'
  reference_value: number | null
  range_low: number | null
  range_high: number | null
  valid_record_count: number
  start_date: string
  end_date: string
  frozen: boolean
  source_record_ids: string[]
}

export interface ComparisonResult {
  absolute_change: number | null
  relative_change: number | null
  position: 'below_range' | 'within_range' | 'above_range' | 'not_comparable'
}

const DAY = 86_400_000
const toDay = (d: string) => Date.parse(`${d}T00:00:00Z`)
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function buildReference(input: {
  metric_code: string
  target_date: string
  history: HistoryPoint[]
  params: ReferenceParams
  open_follow_up: boolean
  previous_reference: ReferenceResult | null
}): ReferenceResult {
  const { target_date, history, params, open_follow_up, previous_reference } = input
  if (open_follow_up && previous_reference) return { ...previous_reference, frozen: true }
  const t = toDay(target_date)
  const lo = t - params.lookback_days * DAY
  const eligible = history.filter(
    (h) =>
      h.info_status === 'valid' &&
      !h.is_practice &&
      h.session_index > params.exclude_first_sessions &&
      h.value !== null &&
      toDay(h.date) >= lo &&
      toDay(h.date) < t,
  )
  const values = eligible.map((h) => h.value as number)
  const n = values.length
  return {
    reference_status: n === 0 ? 'not_built' : n < params.min_valid ? 'provisional' : 'usable_for_question',
    reference_value: n ? median(values) : null,
    range_low: n ? Math.min(...values) : null,
    range_high: n ? Math.max(...values) : null,
    valid_record_count: n,
    start_date: iso(lo),
    end_date: iso(t - DAY),
    frozen: false,
    source_record_ids: eligible.map((h) => h.record_id),
  }
}

export function compareToReference(input: {
  value: number | null
  reference: { reference_status: string; reference_value: number | null; range_low: number | null; range_high: number | null }
}): ComparisonResult {
  const { value, reference: r } = input
  if (value === null || r.reference_status !== 'usable_for_question' || r.reference_value === null || r.range_low === null || r.range_high === null)
    return { absolute_change: null, relative_change: null, position: 'not_comparable' }
  const abs = value - r.reference_value
  const rel = r.reference_value !== 0 ? Math.round((abs / r.reference_value) * 1000) / 1000 : null
  const position = value < r.range_low ? 'below_range' : value > r.range_high ? 'above_range' : 'within_range'
  return { absolute_change: abs, relative_change: rel, position }
}

// Is there a reading after the action was done? Used by "Mark done" (FR-FU-06). Descriptive only.
import type { Action, DecodeSession, Finding, Measurement, PersonalReference, SelfReport, SleepRecord } from '../../data/contract'
import { compareToReference } from '../../engine/reference'
import type { LaterReading } from './records'

interface Data { finding: Finding[]; decode_session: DecodeSession[]; personal_reference: PersonalReference[]; information_status: { record_ref: string; status: string }[] }

/** Looks only at Decode for now; other indicators return null so the action stays awaiting_impact_review.
 * TODO(question: Shaimaa — which later readings count for sleep and pulse steps?) */
export function laterReading(d: Data, a: Action, after: string): LaterReading {
  const f = d.finding.find((x) => x.finding_id === a.finding_id)
  if (!f || !f.supporting_record_ids.some((id) => id.includes(':decode_session:'))) return null
  const bad = new Set(d.information_status.filter((s) => s.status !== 'valid').map((s) => s.record_ref))
  const next = d.decode_session
    .filter((s) => !s.is_practice && s.start_at_utc > after && !bad.has(s.decode_session_id))
    .sort((x, y) => x.start_at_utc.localeCompare(y.start_at_utc))[0]
  const ref = d.personal_reference.filter((p) => p.metric_code === 'decode_correct_count').sort((x, y) => y.created_at_utc.localeCompare(x.created_at_utc))[0]
  if (!next || !ref) return null
  const c = compareToReference({ value: next.correct_count, reference: { ...ref, range_low: ref.range_low ?? null, range_high: ref.range_high ?? null } })
  if (c.position === 'not_comparable') return null
  return { position: c.position === 'within_range' ? 'within' : 'outside', record_id: next.decode_session_id }
}

// ---------------------------------------------------------------------------------------------------------------
// FR-FU-04: the readings recorded since a step started, per indicator, shown beside the astronaut's answer.
// Observations only: no reading is ever linked to the step as an effect.

export type ReadingKind = 'decode_session' | 'sleep_record' | 'measurement' | 'self_report'
export interface SinceReading {
  record_id: string
  kind: ReadingKind
  /** Indicator key used to group readings into side-by-side columns (e.g. decode_session, measurement:hr_resting_bpm). */
  indicator: string
  date: string // YYYY-MM-DD the reading belongs to
  value: number | string | null // null = no value recorded, never 0
  unit: string | null
  status: string | null // latest information_status; null when none is stored
  reasons: string[]
  position: 'below_range' | 'within_range' | 'above_range' | null // Decode only, only for valid readings
}

export interface SinceData {
  finding: Finding[]
  decode_session: DecodeSession[]
  personal_reference: PersonalReference[]
  sleep_record: SleepRecord[]
  measurement: Measurement[]
  self_report: SelfReport[]
  information_status: { record_ref: string; status: string; reason_codes?: string[] | null; created_at_utc: string }[]
}

const kindOf = (id: string) => id.split(':')[1]

/** Readings of the step's indicators recorded after `since` (the follow-up's opening) and up to `until`. */
export function readingsSince(d: SinceData, a: Action, since: string, until: string): SinceReading[] {
  const f = d.finding.find((x) => x.finding_id === a.finding_id)
  if (!f) return []
  const ids = f.supporting_record_ids
  const kinds = new Set(ids.map(kindOf))
  const metrics = new Set(d.measurement.filter((m) => ids.includes(m.measurement_id)).map((m) => m.metric_code))
  const reportKinds = new Set(d.self_report.filter((s) => ids.includes(s.self_report_id)).map((s) => s.report_kind))
  const sinceDate = since.slice(0, 10)
  const untilDate = until.slice(0, 10)

  const latest = new Map<string, { status: string; reasons: string[]; at: string }>()
  for (const s of d.information_status) {
    const p = latest.get(s.record_ref)
    if (!p || s.created_at_utc >= p.at) latest.set(s.record_ref, { status: s.status, reasons: s.reason_codes ?? [], at: s.created_at_utc })
  }
  const st = (id: string) => ({ status: latest.get(id)?.status ?? null, reasons: latest.get(id)?.reasons ?? [] })
  const out: (SinceReading & { at: string })[] = []

  if (kinds.has('decode_session')) {
    const ref = d.personal_reference.filter((p) => p.subject_id === a.subject_id && p.metric_code === 'decode_correct_count')
      .sort((x, y) => x.created_at_utc.localeCompare(y.created_at_utc)).pop()
    for (const s of d.decode_session) {
      if (s.subject_id !== a.subject_id || s.is_practice || !(s.start_at_utc > since && s.start_at_utc <= until)) continue
      const q = st(s.decode_session_id)
      let position: SinceReading['position'] = null
      if (ref && q.status === 'valid') {
        const c = compareToReference({ value: s.correct_count, reference: { ...ref, range_low: ref.range_low ?? null, range_high: ref.range_high ?? null } })
        position = c.position === 'not_comparable' ? null : c.position
      }
      out.push({
        record_id: s.decode_session_id, kind: 'decode_session', indicator: 'decode_session', date: s.start_at_utc.slice(0, 10),
        at: s.start_at_utc, value: s.correct_count ?? null, unit: 'correct', ...q, position,
      })
    }
  }
  if (kinds.has('sleep_record')) {
    for (const s of d.sleep_record) {
      // a sleep record carries only its local date: count nights dated after the day the step started
      if (s.subject_id !== a.subject_id || !(s.observation_date > sinceDate && s.observation_date <= untilDate)) continue
      out.push({
        record_id: s.sleep_record_id, kind: 'sleep_record', indicator: 'sleep_record', date: s.observation_date,
        at: `${s.observation_date}T00:00:00Z`, value: s.minutes_asleep ?? null, unit: 'min', ...st(s.sleep_record_id), position: null,
      })
    }
  }
  for (const m of d.measurement) {
    if (m.subject_id !== a.subject_id || !metrics.has(m.metric_code)) continue
    const at = m.observed_at_utc ?? (m.observation_date ? `${m.observation_date}T00:00:00Z` : null)
    if (!at || !(at > since && at <= until)) continue
    out.push({
      record_id: m.measurement_id, kind: 'measurement', indicator: `measurement:${m.metric_code}`, date: at.slice(0, 10), at,
      value: m.value ?? null, unit: m.unit ?? null, ...st(m.measurement_id), position: null,
    })
  }
  for (const s of d.self_report) {
    if (s.subject_id !== a.subject_id || !reportKinds.has(s.report_kind)) continue
    const at = s.submitted_at_utc ?? `${s.report_date}T00:00:00Z`
    if (!(at > since && at <= until)) continue
    const value = s.report_kind === 'symptom' ? (s.symptom_text ?? null) : (s.alertness_rating ?? null)
    out.push({
      record_id: s.self_report_id, kind: 'self_report', indicator: `self_report:${s.report_kind}`, date: at.slice(0, 10), at,
      value, unit: null, ...st(s.self_report_id), position: null,
    })
  }
  return out.sort((x, y) => x.at.localeCompare(y.at)).map(({ at: _at, ...r }) => r)
}

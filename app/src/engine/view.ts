// Derives what the screens show from contract records. Pure: no React, no I/O.
// Data status, follow-up status and sync status stay separate (CLAUDE.md rule 2).
import type { DomainContent, DomainId, IndicatorContent } from '../content/content'
import type { Action, DecodeSession, Finding, FollowUp, Measurement, PersonalReference, SelfReport, SleepRecord } from '../data/contract'
import { compareToReference, referenceForDate, type ComparisonResult } from './reference'

export type InfoStatus = 'valid' | 'limited' | 'stale' | 'not_comparable' | 'incomplete' | 'no_reading'
export type FollowStatus = FollowUp['followup_status']

export interface DataSet {
  sleep_record: SleepRecord[]
  measurement: Measurement[]
  self_report: SelfReport[]
  decode_session: DecodeSession[]
  information_status: { record_ref: string; status: string; reason_codes?: string[] | null; created_at_utc: string }[]
  personal_reference: PersonalReference[]
  finding: Finding[]
  action: Action[]
  follow_up: FollowUp[]
}

export const INFO_RANK: Record<InfoStatus, number> = { no_reading: 6, not_comparable: 5, incomplete: 4, stale: 3, limited: 2, valid: 1 }
export const FOLLOW_RANK: Record<FollowStatus, number> = {
  under_specialist_review: 5, review_requested: 4, action_open: 3, watching: 2, no_open_follow_up: 0, closed: -1,
}

export type AnyRecord = { entity: string; id: string; date: string; domain: DomainId | null; record: Record<string, unknown> }

/** IDs are identities, not clocks. Use observation/submission time within a review day. */
export function recordTime(r: AnyRecord): string {
  return String(r.record.start_at_utc ?? r.record.observed_at_utc ?? r.record.submitted_at_utc ?? r.record.created_at_utc ?? `${r.date}T00:00:00Z`)
}

export const isMeasurementRecord = (r: AnyRecord): boolean => r.entity !== 'decode_session' || r.record.is_practice !== true

const METRIC_DOMAIN: Record<string, DomainId> = {
  hr_daily_bpm: 'heart', hr_resting_bpm: 'heart', hr_hourly_bpm: 'heart',
  nightly_skin_temperature: 'symptoms', skin_temperature_variation: 'symptoms',
  steps_daily: 'movement', steps_hourly: 'movement', activity_minutes: 'movement',
}

/** Every measured record with its date, domain and indicator id, in one list. */
export function indexRecords(d: DataSet): AnyRecord[] {
  const out: AnyRecord[] = []
  for (const r of d.sleep_record) out.push({ entity: 'sleep_record', id: r.sleep_record_id, date: r.observation_date, domain: 'sleep', record: r as never })
  for (const r of d.measurement) out.push({ entity: 'measurement', id: r.measurement_id, date: r.observation_date, domain: METRIC_DOMAIN[r.metric_code] ?? null, record: r as never })
  for (const r of d.self_report)
    out.push({ entity: 'self_report', id: r.self_report_id, date: r.report_date, domain: r.report_kind === 'symptom' ? 'symptoms' : r.report_kind.startsWith('daily_check') ? 'cognition' : null, record: r as never })
  for (const r of d.decode_session) out.push({ entity: 'decode_session', id: r.decode_session_id, date: r.start_at_utc.slice(0, 10), domain: 'cognition', record: r as never })
  for (const r of d.personal_reference)
    out.push({ entity: 'personal_reference', id: r.personal_reference_id, date: r.end_date, domain: r.metric_code.startsWith('decode') ? 'cognition' : r.metric_code.startsWith('hr') ? 'heart' : r.metric_code.startsWith('sleep') ? 'sleep' : null, record: r as never })
  return out
}

/** Which indicator of a domain a record belongs to. */
export function indicatorOf(r: AnyRecord): string | null {
  switch (r.entity) {
    case 'sleep_record': return 'sleep_duration'
    case 'measurement': {
      const m = r.record as unknown as Measurement
      return m.metric_code.includes('temperature') ? 'temperature' : m.metric_code
    }
    case 'self_report': {
      const s = r.record as unknown as SelfReport
      return s.report_kind === 'symptom' ? 'symptom' : 'alertness_self'
    }
    case 'decode_session': return 'decode_correct_count'
    default: return null
  }
}

export function infoStatusOf(d: DataSet, recordId: string): { status: InfoStatus; reasons: string[] } {
  const rows = d.information_status.filter((s) => s.record_ref === recordId).sort((a, b) => a.created_at_utc.localeCompare(b.created_at_utc))
  const last = rows[rows.length - 1]
  if (last) return { status: last.status as InfoStatus, reasons: last.reason_codes ?? [] }
  // A self-report describes what the person entered; device measurements require a quality record.
  if (d.self_report.some((r) => r.self_report_id === recordId)) return { status: 'valid', reasons: [] }
  return { status: 'incomplete', reasons: ['quality_not_evaluated'] }
}

/** The value an indicator shows for a record, never invented: null stays null. */
export function valueOf(r: AnyRecord): number | null {
  switch (r.entity) {
    case 'sleep_record': {
      const ms = (r.record as unknown as SleepRecord).recorded_interval_ms
      return ms === null ? null : Math.round((ms / 3_600_000) * 10) / 10
    }
    case 'measurement': return (r.record as unknown as Measurement).value
    case 'self_report': return (r.record as unknown as SelfReport).alertness_rating ?? null
    case 'decode_session': return (r.record as unknown as DecodeSession).correct_count
    default: return null
  }
}

export interface IndicatorView {
  content: IndicatorContent
  today: AnyRecord | null
  latest: AnyRecord | null
  value: number | null
  status: InfoStatus
  reasons: string[]
  counts: boolean // whether this indicator counts toward the region's data badge today
  reference: PersonalReference | null
  comparison: ComparisonResult | null
  history: { date: string; value: number | null; status: InfoStatus; id: string }[]
}

export interface DomainView {
  content: DomainContent
  indicators: IndicatorView[]
  dataStatus: InfoStatus | null // null = sample domain, nothing measured
  followStatus: FollowStatus
  followUps: FollowUp[]
}

/** Domains a follow-up is about: follow_up -> action -> finding -> supporting records. */
export function followUpDomains(d: DataSet, fu: FollowUp, idx: Map<string, AnyRecord>): Set<DomainId> {
  const action = d.action.find((a) => a.action_id === fu.action_id)
  const finding = action?.finding_id ? d.finding.find((f) => f.finding_id === action.finding_id) : undefined
  const out = new Set<DomainId>()
  for (const id of finding?.supporting_record_ids ?? []) {
    const dom = idx.get(id)?.domain
    if (dom) out.add(dom)
  }
  return out
}

export function buildDomainViews(d: DataSet, domains: DomainContent[], reviewDate: string, asOf?: string): DomainView[] {
  const all = indexRecords(d)
  const idx = new Map(all.map((r) => [r.id, r]))
  const openFUs = d.follow_up.filter((f) => f.followup_status !== 'closed' && f.followup_status !== 'no_open_follow_up')

  return domains.map((content) => {
    const indicators: IndicatorView[] = content.indicators.map((ind) => {
      const recs = all
        .filter((r) => r.domain === content.id && indicatorOf(r) === ind.id && r.date <= reviewDate && isMeasurementRecord(r))
        .sort((a, b) => a.date.localeCompare(b.date) || recordTime(a).localeCompare(recordTime(b)) || a.id.localeCompare(b.id))
      const latest = recs[recs.length - 1] ?? null
      const today = [...recs].reverse().find((r) => r.date === reviewDate) ?? null
      let status: InfoStatus
      let reasons: string[] = []
      if (today) ({ status, reasons } = infoStatusOf(d, today.id))
      else status = 'no_reading'
      const counts = ind.frequency === 'daily' || today !== null
      const shown = today ?? latest
      const value = shown ? valueOf(shown) : null
      const reference = referenceForDate(d.personal_reference, ind.id, reviewDate, shown?.record.subject_id as string | undefined, asOf)
      const comparison =
        reference && shown && shown.date > reference.end_date && infoStatusOf(d, shown.id).status === 'valid'
          ? compareToReference({ value, reference: { ...reference, range_low: reference.range_low ?? null, range_high: reference.range_high ?? null } })
          : null
      return {
        content: ind, today, latest, value, status, reasons, counts, reference, comparison,
        history: recs.map((r) => ({ date: r.date, value: valueOf(r), status: infoStatusOf(d, r.id).status, id: r.id })),
      }
    })
    const counted = indicators.filter((i) => i.counts)
    const dataStatus: InfoStatus | null = !content.live
      ? null
      : counted.length
        ? counted.reduce<InfoStatus>((w, i) => (INFO_RANK[i.status] > INFO_RANK[w] ? i.status : w), 'valid')
        : 'no_reading'
    const followUps = openFUs.filter((f) => followUpDomains(d, f, idx).has(content.id))
    const followStatus = followUps.reduce<FollowStatus>((w, f) => (FOLLOW_RANK[f.followup_status] > FOLLOW_RANK[w] ? f.followup_status : w), 'no_open_follow_up')
    return { content, indicators, dataStatus, followStatus, followUps }
  })
}

export interface ReviewView {
  date: string
  recorded: { record: AnyRecord; status: InfoStatus; reasons: string[] }[]
  changed: Finding[]
  missing: { domain: DomainContent; indicator: IndicatorContent }[]
  nextStep: Action | null
  otherFollowUps: FollowUp[]
}

export function buildReview(d: DataSet, domains: DomainContent[], review: { daily_review_id: string; review_date: string; selected_action_id?: string | null }): ReviewView {
  const all = indexRecords(d).filter((r) => r.entity !== 'personal_reference')
  const recorded = all.filter((r) => r.date === review.review_date).map((r) => ({ record: r, ...infoStatusOf(d, r.id) }))
  const changed = d.finding.filter((f) => f.review_id === review.daily_review_id)
  const missing = domains
    .filter((dc) => dc.live)
    .flatMap((dc) => dc.indicators.filter((i) => i.frequency === 'daily').map((i) => ({ domain: dc, indicator: i })))
    .filter(({ domain, indicator }) => !recorded.some((r) => r.record.domain === domain.id && indicatorOf(r.record) === indicator.id && isMeasurementRecord(r.record)))
  const nextStep = review.selected_action_id ? d.action.find((a) => a.action_id === review.selected_action_id) ?? null : null
  const otherFollowUps = d.follow_up
    .filter((f) => f.followup_status !== 'closed' && f.followup_status !== 'no_open_follow_up' && f.action_id !== nextStep?.action_id)
    .sort((a, b) => FOLLOW_RANK[b.followup_status] - FOLLOW_RANK[a.followup_status])
  return { date: review.review_date, recorded, changed, missing, nextStep, otherFollowUps }
}

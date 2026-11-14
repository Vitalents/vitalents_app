// SummaryBuilder (FR-SHR-01). Builds the consult summary from the astronaut's own record.
// Pure. Copies only named fields, so private notes can never enter the package (CLAUDE.md rule 9).
import { DOMAINS, domainById, type IndicatorContent } from '../../content/content'
import type { PersonalReference } from '../../data/contract'
import { indexRecords, indicatorOf, infoStatusOf, valueOf, type AnyRecord } from '../../engine/view'
import type { Data } from '../../store/store'
import { ACTION_STATUS, FOLLOW_STATUS, INFO_STATUS, T } from './strings'

export const EXCLUDED_FIELD_CODES = ['self_report.private_note'] as const

export interface SummaryItem {
  id: string
  date: string
  text: string
  /** Data status of a reading (never merged with follow-up or sync status). */
  dataStatus?: string
  reasons?: string[]
  /** What this kind of reading cannot tell (from content/domains.json). */
  limits?: string
}

export type SectionKey = 'events' | 'measurements' | 'symptoms' | 'actions' | 'question'

export interface SummarySection {
  key: SectionKey
  title: string
  items: SummaryItem[]
}

export interface Summary {
  sections: SummarySection[]
  previewedRecordIds: string[]
  excludedFieldCodes: string[]
  summaryText: string
  isEmpty: boolean
}

const ALL_INDICATORS = new Map<string, { ind: IndicatorContent; domainId: string }>()
for (const d of DOMAINS) for (const ind of d.indicators) ALL_INDICATORS.set(ind.id, { ind, domainId: d.id })

function formatValue(value: number | null, unit: string | null): string {
  if (value === null) return INFO_STATUS.no_reading
  if (!unit || unit === 'count') return String(value)
  if (unit === '1-10') return `${value} on a 1-10 scale`
  return `${value} ${unit}`
}

function readingItem(r: AnyRecord, data: Data): SummaryItem | null {
  if (r.entity === 'personal_reference') {
    const pr = r.record as unknown as PersonalReference
    const meta = ALL_INDICATORS.get(pr.metric_code)
    const name = meta?.ind.name ?? pr.metric_code
    const range =
      pr.range_low != null && pr.range_high != null
        ? `${pr.range_low}-${pr.range_high}`
        : pr.reference_value != null
          ? String(pr.reference_value)
          : INFO_STATUS.no_reading
    return {
      id: r.id,
      date: pr.end_date,
      text: `Your reference for ${name}: ${range} (${pr.reference_version}, ${pr.valid_record_count} valid records)`,
      limits: meta ? domainById(meta.domainId)?.limits_note : undefined,
    }
  }
  if (r.entity === 'self_report' && indicatorOf(r) === 'symptom') return null // listed under symptoms
  const indId = indicatorOf(r)
  const meta = indId ? ALL_INDICATORS.get(indId) : undefined
  if (!meta) return null
  const { status, reasons } = infoStatusOf(data, r.id)
  return {
    id: r.id,
    date: r.date,
    text: `${meta.ind.name}: ${formatValue(valueOf(r), meta.ind.unit)}`,
    dataStatus: status,
    reasons,
    limits: domainById(meta.domainId)?.limits_note,
  }
}

/** Builds what will be shared about one subject. Never reads private_note. */
export function buildSummary(data: Data, subjectId: string, question: string): Summary {
  const mine = <T extends { subject_id: string }>(list: T[]) => list.filter((r) => r.subject_id === subjectId)
  const findings = mine(data.finding)
  const actions = mine(data.action)
  const followUps = mine(data.follow_up)
  const reviews = mine(data.daily_review).sort((a, b) => a.review_date.localeCompare(b.review_date))
  const latestReview = reviews[reviews.length - 1]
  const reviewDate = (id: string | null | undefined) => reviews.find((r) => r.daily_review_id === id)?.review_date

  const index = new Map(
    indexRecords(data)
      .filter((r) => (r.record as { subject_id?: string }).subject_id === subjectId)
      .map((r) => [r.id, r]),
  )
  /** A finding's date: its review, else its latest supporting record. */
  const findingDate = (f: (typeof findings)[number]) =>
    reviewDate(f.review_id) ??
    f.supporting_record_ids.map((id) => index.get(id)?.date ?? '').sort().at(-1) ??
    ''

  // Events: findings and the follow-ups opened on them.
  const events: SummaryItem[] = [
    ...findings.map((f) => ({
      id: f.finding_id,
      date: findingDate(f),
      text: `${f.explanation} ${f.limitations}`.trim(),
    })),
    ...followUps.map((fu) => {
      const a = actions.find((x) => x.action_id === fu.action_id)
      return {
        id: fu.follow_up_id,
        date: fu.opened_at_utc.slice(0, 10),
        text: `Follow-up: ${FOLLOW_STATUS[fu.followup_status] ?? fu.followup_status}${a ? ` (${a.action_text})` : ''}`,
      }
    }),
  ].sort((a, b) => a.date.localeCompare(b.date))

  // Readings: what the findings rest on, plus the latest review's readings.
  const readingIds = new Set<string>()
  for (const f of findings) for (const id of f.supporting_record_ids) readingIds.add(id)
  if (latestReview) {
    for (const id of latestReview.reading_ids ?? []) readingIds.add(id)
    for (const id of [latestReview.sleep_record_id, latestReview.decode_session_id]) if (id) readingIds.add(id)
    for (const id of latestReview.self_report_ids ?? []) readingIds.add(id)
  }
  const measurements = [...readingIds]
    .map((id) => index.get(id))
    .filter((r): r is AnyRecord => !!r)
    .map((r) => readingItem(r, data))
    .filter((x): x is SummaryItem => !!x)
    .sort((a, b) => a.date.localeCompare(b.date) || a.text.localeCompare(b.text))

  const symptoms: SummaryItem[] = mine(data.self_report)
    .filter((s) => s.report_kind === 'symptom' && s.symptom_text)
    .map((s) => ({ id: s.self_report_id, date: s.report_date, text: s.symptom_text as string }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const tried: SummaryItem[] = actions
    .filter((a) => a.execution_status !== 'proposed')
    .map((a) => ({
      id: a.action_id,
      date: (a.completed_at_utc ?? a.scheduled_for_utc ?? '').slice(0, 10),
      text: `${a.action_text}: ${ACTION_STATUS[a.execution_status] ?? a.execution_status}`,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const q = question.trim()
  const sections: SummarySection[] = [
    { key: 'events', title: T.sections.events, items: events },
    { key: 'measurements', title: T.sections.measurements, items: measurements },
    { key: 'symptoms', title: T.sections.symptoms, items: symptoms },
    { key: 'actions', title: T.sections.actions, items: tried },
    { key: 'question', title: T.sections.question, items: q ? [{ id: 'question', date: '', text: q }] : [] },
  ]

  const previewedRecordIds = [
    ...new Set(sections.flatMap((s) => s.items.map((i) => i.id)).filter((id) => id !== 'question')),
  ]
  const isEmpty = previewedRecordIds.length === 0

  return {
    sections,
    previewedRecordIds,
    excludedFieldCodes: [...EXCLUDED_FIELD_CODES],
    summaryText: summaryToText(sections),
    isEmpty,
  }
}

/** Reason codes as words, e.g. weak_sensor_contact -> weak sensor contact. */
export const reasonText = (codes: string[]) => codes.map((c) => c.replace(/_/g, ' ')).join(', ')

/** Plain text form stored in share_package.summary_text: one block per section, heading first. */
export function summaryToText(sections: SummarySection[]): string {
  return sections
    .map((s) => {
      const lines = s.items.length
        ? s.items.map((i) => {
            const status = i.dataStatus ? ` [data: ${INFO_STATUS[i.dataStatus] ?? i.dataStatus}${i.reasons?.length ? `, ${reasonText(i.reasons)}` : ''}]` : ''
            return `- ${i.date ? `${i.date}: ` : ''}${i.text}${status}`
          })
        : [s.key === 'question' ? T.sections.noQuestion : T.sections.none]
      const limits = [...new Set(s.items.map((i) => i.limits).filter((l): l is string => !!l))]
      return [s.title, ...lines, ...limits.map((l) => `- Limits: ${l}`)].join('\n')
    })
    .join('\n\n')
}

/** Splits a stored summary_text back into titled blocks for display. */
export function parseSummaryText(text: string): { title: string; lines: { date: string; text: string }[] }[] {
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const [title, ...lines] = block.split('\n')
      return {
        title,
        lines: lines.map((l) => {
          const text = l.replace(/^- /, '')
          const m = /^(\d{4}-\d{2}-\d{2}): (.*)$/.exec(text)
          return m ? { date: m[1], text: m[2] } : { date: '', text }
        }),
      }
    })
    .filter((b) => b.title)
}

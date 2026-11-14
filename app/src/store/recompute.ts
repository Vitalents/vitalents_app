// FR-REV-02 / FR-REF-03: derive immutable review snapshots from saved inputs, not seeded outcomes.
// No I/O. The store commits the input batch and these outputs in one transaction.
import { RULES } from '../content/content'
import type { Action, DailyReview, Finding, FollowUp, PersonalReference } from '../data/contract'
import { buildReference, referenceForDate, type ReferenceResult } from '../engine/reference'
import { computeFacts, evaluateRules } from '../engine/rules'
import { indexRecords, infoStatusOf, isMeasurementRecord, recordTime } from '../engine/view'
import type { Data } from './store'

type Batch = Partial<Data>
type Context = { subjectId: string; reviewDate: string; now: string; triggerId?: string }
const digest = (value: unknown) => {
  let h = 2166136261
  for (const c of JSON.stringify(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  return h.toString(16)
}
const afterDays = (now: string, days: number) => new Date(Date.parse(now) + days * 86_400_000).toISOString()
const open = (f: FollowUp) => f.followup_status !== 'closed' && f.followup_status !== 'no_open_follow_up'

/** A hard refresh can leave only the last durable checkpoint. Keep it as an aborted, unscored-for-reference attempt. */
export function recoverUnfinishedRounds(data: Data): Batch {
  const interrupted = data.decode_session.filter((s) => s.session_state === 'started')
  if (!interrupted.length) return {}
  const ids = new Set(interrupted.map((s) => s.decode_session_id))
  return {
    decode_session: interrupted.map((s) => ({ ...s, session_state: 'aborted', interruption_reasons: [...new Set([...(s.interruption_reasons ?? []), 'aborted'])] })),
    information_status: data.information_status.filter((s) => ids.has(s.record_ref)).map((s) => ({
      ...s, status: 'incomplete', reference_eligible: false, reason_codes: [...new Set([...(s.reason_codes ?? []), 'aborted'])],
    })),
  }
}

export function recomputeRecords(data: Data, ctx: Context): Batch {
  const { subjectId, reviewDate, now, triggerId } = ctx
  const trigger = data.decode_session.find((s) => s.decode_session_id === triggerId)
  // Checkpoints are durable but do not repeatedly change the plan. Practice never satisfies a measurement.
  if (trigger && (trigger.session_state === 'started' || trigger.is_practice)) return {}
  const realm = subjectId.split(':')[0]
  const subjectKey = subjectId.split(':').slice(1).join('-')
  const common = { schema_version: '1.0', subject_id: subjectId, data_origin: 'application_generated' as const,
    is_simulated: realm === 'sim', created_at_utc: now }
  const mine = Object.fromEntries(Object.entries(data).map(([k, rows]) => [k, rows.filter((r) => !('subject_id' in r) || r.subject_id === subjectId)])) as Data
  const sessions = mine.decode_session.filter((s) => !s.is_practice && s.start_at_utc.slice(0, 10) <= reviewDate)
    .sort((a, b) => a.start_at_utc.localeCompare(b.start_at_utc) || a.decode_session_id.localeCompare(b.decode_session_id))
  const previous = referenceForDate(mine.personal_reference, 'decode_correct_count', reviewDate, subjectId, now)
  const prior: ReferenceResult | null = previous ? {
    reference_status: previous.reference_status, reference_value: previous.reference_value,
    range_low: previous.range_low ?? null, range_high: previous.range_high ?? null,
    valid_record_count: previous.valid_record_count, start_date: previous.start_date, end_date: previous.end_date,
    frozen: previous.frozen ?? false, source_record_ids: previous.source_record_ids,
  } : null
  const relevantOpen = mine.follow_up.filter(open).some((fu) => {
    const a = mine.action.find((a) => a.action_id === fu.action_id)
    const f = mine.finding.find((f) => f.finding_id === a?.finding_id)
    return f?.supporting_record_ids.some((id) => sessions.some((s) => s.decode_session_id === id)
      || mine.personal_reference.some((r) => r.personal_reference_id === id && r.metric_code === 'decode_correct_count'))
  })
  const built = buildReference({
    metric_code: 'decode_correct_count', target_date: reviewDate,
    history: sessions.map((s, i) => ({ record_id: s.decode_session_id, date: s.start_at_utc.slice(0, 10), value: s.correct_count,
      info_status: s.planned_duration_ms === 90000 && s.session_state === 'completed' ? infoStatusOf(mine, s.decode_session_id).status : 'not_comparable',
      is_practice: s.is_practice, session_index: i + 1 })),
    params: { lookback_days: 14, min_valid: 5, exclude_first_sessions: 2, method: 'median' },
    open_follow_up: relevantOpen, previous_reference: prior,
  })
  const sameRef = prior && JSON.stringify(prior) === JSON.stringify(built)
  const refKey = digest({ subjectId, built })
  const reference: PersonalReference = sameRef && previous ? previous : {
    ...common, ...built, personal_reference_id: `${realm}:personal_reference:computed-${subjectKey}-${refKey}`,
    metric_code: 'decode_correct_count', reference_version: `D10-${refKey}`, method: 'median; prior 14 days; valid 90 s sessions; first 2 excluded',
    comparison_target_date: reviewDate, unit: 'correct',
    eligibility_notes: 'Demonstration reference. Current-day sessions, practice and non-comparable readings are excluded.',
    freeze_reason: built.frozen ? `Open follow-up; retained ${previous?.personal_reference_id ?? 'previous reference'}.` : null,
    approved_by_role: null,
  }
  const references = mine.personal_reference.some((r) => r.personal_reference_id === reference.personal_reference_id)
    ? mine.personal_reference : [...mine.personal_reference, reference]
  const working = { ...mine, personal_reference: references }
  const facts = computeFacts(working, reviewDate, now)
  const steps = evaluateRules(facts, RULES)
  const records = indexRecords(working).filter((r) => r.entity !== 'personal_reference' && r.date <= reviewDate && isMeasurementRecord(r))
    .sort((a, b) => a.date.localeCompare(b.date) || recordTime(a).localeCompare(recordTime(b)))
  const today = records.filter((r) => r.date === reviewDate)
  const revision = digest({ subjectId, reviewDate, facts, reference: reference.personal_reference_id,
    inputs: records.map((r) => [r.id, r.record, infoStatusOf(working, r.id)]),
    rules: RULES.map((r) => [r.id, r.version, r.when, r.step, r.approval_state]) })
  const reviewId = `${realm}:daily_review:computed-${subjectKey}-${reviewDate}-${revision}`
  if (mine.daily_review.some((r) => r.daily_review_id === reviewId)) return {}
  // Two committed inputs may share millisecond precision. Preserve their revision order independently of hash IDs.
  const lastRevisionTime = Math.max(0, ...mine.daily_review.filter((r) => r.review_date === reviewDate).map((r) => Date.parse(r.created_at_utc)))
  const reviewCreatedAt = new Date(Math.max(Date.parse(now), lastRevisionTime + 1)).toISOString()
  const findings: Finding[] = []
  const actions: Action[] = []
  const followUps: FollowUp[] = []
  let selected: string | null = null
  for (const step of steps) {
    const key = `${subjectKey}-${reviewDate}-${revision}-${step.rule_id}`
    const families = new Set(step.facts_used.map((f) => f.split('.')[0]))
    const evidence = new Set<string>()
    for (const r of records) {
      if (families.has('decode') && r.entity === 'decode_session') evidence.add(r.id)
      if (families.has('sleep') && r.entity === 'sleep_record' && r.date >= new Date(Date.parse(`${reviewDate}T00:00:00Z`) - 2 * 86_400_000).toISOString().slice(0, 10)) evidence.add(r.id)
      if (families.has('pulse') && r.entity === 'measurement' && r.date === reviewDate && String(r.record.metric_code).startsWith('hr_')) evidence.add(r.id)
      if (families.has('symptom') && r.entity === 'self_report' && r.date === reviewDate && r.record.report_kind === 'symptom') evidence.add(r.id)
    }
    if (families.has('decode')) evidence.add(reference.personal_reference_id)
    if (families.has('help') || families.has('followup')) {
      for (const fu of mine.follow_up.filter(open)) {
        const action = mine.action.find((a) => a.action_id === fu.action_id)
        const old = mine.finding.find((f) => f.finding_id === action?.finding_id)
        if (families.has('help') && old?.rule_id !== 'rule:R-REV-01') continue
        for (const id of old?.supporting_record_ids ?? []) evidence.add(id)
      }
    }
    const finding: Finding = {
      ...common, finding_id: `${realm}:finding:computed-${key}`, review_id: reviewId,
      rule_id: `rule:${step.rule_id}`, rule_version: step.rule_version, finding_kind: step.finding_kind,
      supporting_record_ids: [...evidence], explanation: step.explanation, limitations: step.limitations, owner_role: step.owner_role,
    }
    findings.push(finding)
    // Keep an existing human-owned follow-up and its action state. A new observation never silently closes or resets it.
    const existing = mine.action.filter((a) => mine.follow_up.some((f) => f.action_id === a.action_id && open(f))
      && mine.finding.some((f) => f.finding_id === a.finding_id && f.rule_id === finding.rule_id
        && (!(families.has('symptom') || families.has('help')) || f.supporting_record_ids.some((id) => evidence.has(id)))))
      .sort((a, b) => a.created_at_utc.localeCompare(b.created_at_utc) || a.action_id.localeCompare(b.action_id)).at(-1)
    if (existing) {
      selected ??= existing.action_id
      continue
    }
    const request = step.step_category === 'request_review' && step.owner_role === 'medical'
    const action: Action = {
      ...common, action_id: `${realm}:action:computed-${key}`, finding_id: finding.finding_id,
      step_category: step.step_category, reason_text: step.explanation, action_text: step.title,
      source_reference_id: step.source_id, owner_role: step.owner_role, execution_status: request ? 'accepted' : 'proposed',
      follow_up_due_utc: afterDays(now, step.followup_days),
    }
    actions.push(action)
    selected ??= action.action_id
    if (request) followUps.push({ ...common, follow_up_id: `${realm}:follow_up:computed-${key}`, action_id: action.action_id,
      followup_status: 'review_requested', opened_at_utc: now, next_review_due_utc: action.follow_up_due_utc, assigned_role: 'medical' })
  }
  const latest = (entity: string) => today.filter((r) => r.entity === entity).at(-1)?.id ?? null
  const review: DailyReview = {
    ...common, created_at_utc: reviewCreatedAt, daily_review_id: reviewId, review_date: reviewDate,
    reading_ids: today.filter((r) => r.entity === 'measurement').map((r) => r.id), sleep_record_id: latest('sleep_record'),
    decode_session_id: latest('decode_session'), self_report_ids: today.filter((r) => r.entity === 'self_report').map((r) => r.id),
    finding_ids: findings.map((f) => f.finding_id), selected_action_id: selected,
    review_explanation: `Review recomputed from saved observations with reference ${reference.reference_version}. Earlier observations and open follow-ups are retained.`,
  }
  return { daily_review: [review], finding: findings, action: actions, follow_up: followUps,
    personal_reference: mine.personal_reference.some((r) => r.personal_reference_id === reference.personal_reference_id) ? [] : [reference] }
}

// Builders for records the astronaut creates (Request help, Report something). Pure and testable.
// Every record must validate against contracts/<entity>.schema.json (see records.test.ts).
import type { Action, Finding, FollowUp, SelfReport } from '../data/contract'
import { S } from '../content/strings'

export const SCHEMA_VERSION = '1.0'

/** `<realm>:<entity>:<uuid>`; the realm always follows the subject (contract D-1). */
export function newId(entity: string, subjectId: string, uuid: () => string = () => crypto.randomUUID()): string {
  const realm = subjectId.split(':')[0]
  return `${realm}:${entity}:${uuid()}`
}

interface Ctx {
  subjectId: string
  reviewId: string
  now?: string
  uuid?: () => string
}

function common(subjectId: string, now: string) {
  return {
    schema_version: SCHEMA_VERSION,
    subject_id: subjectId,
    data_origin: 'application_generated' as const,
    is_simulated: subjectId.startsWith('sim:'),
    created_at_utc: now,
  }
}

export interface HelpRecords {
  finding: Finding
  action: Action
  follow_up: FollowUp
}

/** FR-SH-06: a review request opens immediately and never waits for Decode. */
export function buildHelpRecords(ctx: Ctx & { note?: string }): HelpRecords {
  const now = ctx.now ?? new Date().toISOString()
  const base = common(ctx.subjectId, now)
  const note = ctx.note?.trim()
  const finding: Finding = {
    ...base,
    finding_id: newId('finding', ctx.subjectId, ctx.uuid),
    review_id: ctx.reviewId,
    rule_id: 'rule:R-REV-01',
    rule_version: '1.0',
    finding_kind: 'review_request',
    supporting_record_ids: [],
    explanation: note ? `${S.help.explanation} ${note}` : S.help.explanation,
    limitations: S.help.limitations,
    owner_role: 'medical',
  }
  const action: Action = {
    ...base,
    action_id: newId('action', ctx.subjectId, ctx.uuid),
    finding_id: finding.finding_id,
    step_category: 'request_review',
    reason_text: S.help.reason,
    action_text: S.help.actionText,
    source_reference_id: 'lib:nasa-medops',
    owner_role: 'medical',
    execution_status: 'accepted',
  }
  const follow_up: FollowUp = {
    ...base,
    follow_up_id: newId('follow_up', ctx.subjectId, ctx.uuid),
    action_id: action.action_id,
    followup_status: 'review_requested',
    opened_at_utc: now,
    assigned_role: 'medical',
  }
  return { finding, action, follow_up }
}

export interface ReportRecords extends HelpRecords {
  self_report: SelfReport
}

/** FR-SH-05: a symptom in the astronaut's own words, no medical category required. */
export function buildReportRecords(ctx: Ctx & { text: string; onset: string; severity: 'mild' | 'moderate' | 'severe'; reportDate: string }): ReportRecords {
  const now = ctx.now ?? new Date().toISOString()
  const base = common(ctx.subjectId, now)
  const text = ctx.text.trim()
  // TODO(question: contract needs symptom_onset_date and symptom_severity fields on self_report; until then they lead symptom_text)
  const self_report: SelfReport = {
    ...base,
    self_report_id: newId('self_report', ctx.subjectId, ctx.uuid),
    report_kind: 'symptom',
    report_date: ctx.reportDate,
    submitted_at_utc: now,
    symptom_text: `Onset ${ctx.onset} · Severity ${ctx.severity} · ${text}`,
  }
  const finding: Finding = {
    ...base,
    finding_id: newId('finding', ctx.subjectId, ctx.uuid),
    review_id: ctx.reviewId,
    rule_id: 'rule:R-REV-02',
    rule_version: '1.0',
    finding_kind: 'review_request',
    supporting_record_ids: [self_report.self_report_id],
    explanation: S.report.explanation(text),
    limitations: S.report.limitations,
    owner_role: 'medical',
  }
  const action: Action = {
    ...base,
    action_id: newId('action', ctx.subjectId, ctx.uuid),
    finding_id: finding.finding_id,
    step_category: 'request_review',
    reason_text: S.report.reason,
    action_text: S.report.actionText,
    source_reference_id: 'lib:nasa-medops',
    owner_role: 'medical',
    execution_status: 'accepted',
    follow_up_due_utc: new Date(Date.parse(now) + 86_400_000).toISOString(),
  }
  const follow_up: FollowUp = {
    ...base,
    follow_up_id: newId('follow_up', ctx.subjectId, ctx.uuid),
    action_id: action.action_id,
    followup_status: 'review_requested',
    opened_at_utc: now,
    assigned_role: 'medical',
    next_review_due_utc: action.follow_up_due_utc,
  }
  return { self_report, finding, action, follow_up }
}

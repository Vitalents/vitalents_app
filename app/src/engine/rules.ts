// Rules evaluator (SRS section 6) and fact computation (SRS 6.3). Pure: no UI imports.
// Rules state observations only; templates are filled from computed facts and nothing else.
import type { Action, DecodeSession, FollowUp, PersonalReference, SelfReport, SleepRecord, Measurement } from '../data/contract'
import { compareToReference } from './reference'
import { infoStatusOf, type InfoStatus } from './view'

export type RuleCategory = 'REVIEW_REQUEST' | 'MEASUREMENT_ISSUE' | 'PLAN_NEED' | 'INSUFFICIENT_REFERENCE'
/** Attention order: 1 help/urgent → 2 due follow-ups → 3 changes needing review → 4 missing information → 5 reference building. */
export type Attention = 'urgent' | 'due_follow_up' | 'change' | 'missing' | 'reference'
export const ATTENTION_ORDER: Record<Attention, number> = { urgent: 1, due_follow_up: 2, change: 3, missing: 4, reference: 5 }

export type Op = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in'
export interface Condition { fact: string; op: Op; value: FactValue | FactValue[] }
export interface When { all?: (Condition | When)[]; any?: (Condition | When)[] }
export type FactValue = string | number | boolean | null
export type Facts = Record<string, FactValue>

export interface Rule {
  id: string
  version: string
  category: RuleCategory
  attention: Attention
  priority: number
  when: When
  finding: string
  step: { title: string; decision_owner: 'astronaut' | 'medical' | 'planner'; followup_days: number; opens?: 'schedule_alternatives' }
  source_id: string
  limits: string
}

export type StepCategory = Action['step_category']
export const STEP_CATEGORY: Record<RuleCategory, StepCategory> = {
  REVIEW_REQUEST: 'request_review',
  MEASUREMENT_ISSUE: 'complete_measurement',
  PLAN_NEED: 'approved_plan_step',
  INSUFFICIENT_REFERENCE: 'observe',
}
export type FindingKind = 'missing_data' | 'descriptive_change' | 'context_conflict' | 'approved_plan_step' | 'review_request'
const FINDING_KIND: Record<RuleCategory, FindingKind> = {
  REVIEW_REQUEST: 'review_request',
  MEASUREMENT_ISSUE: 'missing_data',
  PLAN_NEED: 'descriptive_change',
  INSUFFICIENT_REFERENCE: 'descriptive_change',
}

export interface Step {
  rule_id: string
  rule_version: string
  category: RuleCategory
  attention: Attention
  step_category: StepCategory
  finding_kind: FindingKind
  title: string
  explanation: string
  limitations: string
  owner_role: Rule['step']['decision_owner']
  followup_days: number
  source_id: string
  opens: Rule['step']['opens'] | null
  facts_used: string[]
}

function test(c: Condition, facts: Facts): boolean {
  if (!(c.fact in facts)) return false // an unknown fact never satisfies a rule
  const v = facts[c.fact]
  switch (c.op) {
    case '==': return v === c.value
    case '!=': return v !== c.value
    case 'in': return Array.isArray(c.value) && c.value.includes(v)
    default: {
      if (typeof v !== 'number' || typeof c.value !== 'number') return false // null is never > or < anything
      return c.op === '>' ? v > c.value : c.op === '>=' ? v >= c.value : c.op === '<' ? v < c.value : v <= c.value
    }
  }
}

export function matches(w: When, facts: Facts): boolean {
  const ev = (x: Condition | When) => ('fact' in x ? test(x, facts) : matches(x, facts))
  if (w.all && !w.all.every(ev)) return false
  if (w.any && !w.any.some(ev)) return false
  return Boolean(w.all?.length || w.any?.length)
}

function factsIn(w: When): string[] {
  return [...(w.all ?? []), ...(w.any ?? [])].flatMap((x) => ('fact' in x ? [x.fact] : factsIn(x)))
}

/** Fills {fact.name} placeholders from facts only. */
export function fill(template: string, facts: Facts): string {
  return template.replace(/\{([a-z_.0-9]+)\}/g, (_, k: string) => (k in facts && facts[k] !== null ? String(facts[k]) : 'not available'))
}

export function evaluateRules(facts: Facts, rules: Rule[]): Step[] {
  return rules
    .filter((r) => matches(r.when, facts))
    .sort((a, b) => ATTENTION_ORDER[a.attention] - ATTENTION_ORDER[b.attention] || a.priority - b.priority || a.id.localeCompare(b.id))
    .map((r) => ({
      rule_id: r.id, rule_version: r.version, category: r.category, attention: r.attention,
      step_category: STEP_CATEGORY[r.category], finding_kind: r.category === 'PLAN_NEED' && r.step.opens ? 'descriptive_change' : FINDING_KIND[r.category],
      title: r.step.title, explanation: fill(r.finding, facts), limitations: r.limits, owner_role: r.step.decision_owner,
      followup_days: r.step.followup_days, source_id: r.source_id, opens: r.step.opens ?? null, facts_used: factsIn(r.when),
    }))
}

// ---- facts ----------------------------------------------------------------------------------

export interface FactData {
  sleep_record: SleepRecord[]
  measurement: Measurement[]
  self_report: SelfReport[]
  decode_session: DecodeSession[]
  information_status: { record_ref: string; status: string; reason_codes?: string[] | null; created_at_utc: string }[]
  personal_reference: PersonalReference[]
  follow_up: FollowUp[]
  action: Action[]
}

const shiftDay = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** Facts for one review date (SRS 6.3). Unknown values are null, never 0. */
export function computeFacts(d: FactData, reviewDate: string): Facts {
  const status = (id: string): InfoStatus => infoStatusOf(d as never, id).status
  const sleeps = d.sleep_record.filter((s) => s.observation_date <= reviewDate).sort((a, b) => a.observation_date.localeCompare(b.observation_date))
  const lastNight = sleeps.find((s) => s.observation_date === reviewDate) ?? null
  const hours = (s: SleepRecord) => (s.recorded_interval_ms === null ? null : s.recorded_interval_ms / 3_600_000)
  const last3 = [0, 1, 2].map((n) => shiftDay(reviewDate, -n))
  const short = sleeps.filter((s) => last3.includes(s.observation_date) && status(s.sleep_record_id) === 'valid' && (hours(s) ?? 99) < 6).length

  const sessions = d.decode_session
    .filter((s) => !s.is_practice && s.start_at_utc.slice(0, 10) <= reviewDate)
    .sort((a, b) => a.start_at_utc.localeCompare(b.start_at_utc))
  const today = [...sessions].reverse().find((s) => s.start_at_utc.slice(0, 10) === reviewDate) ?? null
  const refs = d.personal_reference.filter((p) => p.metric_code === 'decode_correct_count').sort((a, b) => a.created_at_utc.localeCompare(b.created_at_utc))
  const ref = refs[refs.length - 1] ?? null
  let below = 0
  if (ref) {
    for (const s of [...sessions].reverse()) {
      if (status(s.decode_session_id) !== 'valid') continue // interrupted sessions neither count nor break the run
      const c = compareToReference({ value: s.correct_count, reference: { ...ref, range_low: ref.range_low ?? null, range_high: ref.range_high ?? null } })
      if (c.position === 'below_range') below++
      else break
    }
  }
  const comparable = sessions.filter((s) => status(s.decode_session_id) === 'valid').length

  const symptomsToday = d.self_report.filter((r) => r.report_kind === 'symptom' && r.report_date === reviewDate)
  const pulseToday = d.measurement.find((m) => m.metric_code.startsWith('hr_') && m.observation_date === reviewDate) ?? null
  const open = d.follow_up.filter((f) => f.followup_status !== 'closed' && f.followup_status !== 'no_open_follow_up')
  const overdue = open.filter((f) => f.next_review_due_utc && f.next_review_due_utc.slice(0, 10) < reviewDate).length

  return {
    'sleep.last_night_h': lastNight ? (hours(lastNight) === null ? null : Math.round((hours(lastNight) as number) * 10) / 10) : null,
    'sleep.nights_under_6h_last3': short,
    'sleep.info_status': lastNight ? status(lastNight.sleep_record_id) : 'no_reading',
    'decode.info_status': today ? status(today.decode_session_id) : 'no_reading',
    'decode.reference_status': ref ? ref.reference_status : 'not_built',
    'decode.reference_range': ref && ref.range_low !== null && ref.range_high !== null ? `${ref.range_low}–${ref.range_high}` : null,
    'decode.below_reference_consecutive': ref ? below : null,
    'decode.session_count_comparable': comparable,
    'symptom.reported_today': symptomsToday.length > 0,
    'pulse.info_status': pulseToday ? status(pulseToday.measurement_id) : 'no_reading',
    'followup.overdue_count': overdue,
    'help.requested': open.some((f) => f.followup_status === 'review_requested'),
    // Not computable yet: no severity field, no temperature reference, no approved limits file. Kept null on purpose.
    'symptom.severity_max': null,
    'temperature.change_from_reference_c': null,
    'limits.any_exceeded': null,
  }
}

// Action and follow-up state changes (SRS 5.7, contract D-7). Pure functions: every write the UI makes comes from here,
// so the permission check lives in the data layer, not in which buttons are visible (CLAUDE.md rule 12).
import type { Action, FeedbackEntry, FollowUp } from '../../data/contract'

export type Role = Action['owner_role']

// TODO(question: Amr — move these templates to content/language.json; FR-FU-05 names that file but it does not exist yet).
export const OUTCOME_TEXT = {
  within: 'Your result was within your reference after this action. This does not show that the action caused it.',
  outside: 'Your result was outside your reference after this action. This does not show anything about the action.',
  no_reading: 'No reading after this action yet. The follow-up stays open until a result is recorded.',
} as const
export type LaterReading = { position: 'within' | 'outside'; record_id: string } | null

export class NotPermitted extends Error {}

/** Data-layer read filter (FR-SHR-04): the planner role sees operational requests only, never health steps. */
export function visibleTo(actions: Action[], role: Role): Action[] {
  if (role === 'planner') return actions.filter((a) => a.owner_role === 'planner' && a.finding_id == null)
  return [...actions]
}

const utc = (d: Date | string) => new Date(d).toISOString().replace('.000Z', 'Z')
const keyOf = (id: string) => id.split(':').slice(2).join(':')
const realmOf = (id: string) => id.split(':')[0]

function mustOwn(a: Action, role: Role) {
  if (a.owner_role !== role) throw new NotPermitted(`Only the ${a.owner_role} role decides this step.`)
}
function mustBe(a: Action, allowed: Action['execution_status'][]) {
  if (!allowed.includes(a.execution_status)) throw new NotPermitted(`Not possible while the step is ${a.execution_status}.`)
}

/** FR-FU-01: accepting a step opens a follow-up, or extends the open one. */
export function accept(a: Action, fu: FollowUp | null, role: Role, now: Date | string): { action: Action; follow_up: FollowUp } {
  mustOwn(a, role)
  mustBe(a, ['proposed', 'deferred'])
  const action: Action = { ...a, execution_status: 'accepted', rejection_reason: null }
  const follow_up: FollowUp = fu && fu.followup_status !== 'closed'
    ? { ...fu, followup_status: 'action_open', next_review_due_utc: a.follow_up_due_utc ?? fu.next_review_due_utc ?? null }
    : {
        follow_up_id: `${realmOf(a.action_id)}:follow_up:${keyOf(a.action_id)}`,
        schema_version: '1.0', subject_id: a.subject_id, data_origin: 'application_generated', is_simulated: a.is_simulated,
        created_at_utc: utc(now), action_id: a.action_id, followup_status: 'action_open', opened_at_utc: utc(now),
        next_review_due_utc: a.follow_up_due_utc ?? null, outcome_note: null, closing_reason: null, closed_at_utc: null,
        assigned_role: a.owner_role, specialist_note: null,
      }
  return { action, follow_up }
}

/** FR-FU-03: declining stores the optional reason as written. */
export function decline(a: Action, reason: string, role: Role): Action {
  mustOwn(a, role)
  mustBe(a, ['proposed', 'deferred', 'accepted'])
  return { ...a, execution_status: 'rejected', rejection_reason: reason.trim() || null }
}

export function start(a: Action, role: Role): Action {
  mustOwn(a, role)
  mustBe(a, ['accepted'])
  return { ...a, execution_status: 'in_progress' }
}

export function unable(a: Action, reason: string, role: Role): Action {
  mustOwn(a, role)
  mustBe(a, ['accepted', 'in_progress'])
  return { ...a, execution_status: 'unable', rejection_reason: reason.trim() || null }
}

/** FR-FU-05/06: done with no later reading → awaiting_impact_review; the follow-up never closes as recovered. */
export function markDone(a: Action, fu: FollowUp | null, later: LaterReading, role: Role, now: Date | string): { action: Action; follow_up: FollowUp | null } {
  mustOwn(a, role)
  mustBe(a, ['accepted', 'in_progress'])
  const action: Action = { ...a, execution_status: later ? 'completed' : 'awaiting_impact_review', completed_at_utc: utc(now) }
  const note = later ? OUTCOME_TEXT[later.position] : OUTCOME_TEXT.no_reading
  return { action, follow_up: fu ? { ...fu, outcome_note: note } : null }
}

/** FR-FU-06: the follow-up owner closes with a reason. Never when the action has no later reading. */
export function closeFollowUp(fu: FollowUp, a: Action, reason: string, role: Role, now: Date | string): FollowUp {
  if (fu.assigned_role !== role) throw new NotPermitted(`Only the ${fu.assigned_role} role closes this follow-up.`)
  if (a.execution_status === 'awaiting_impact_review') throw new NotPermitted('No reading after the action: the follow-up stays open.')
  if (!reason.trim()) throw new NotPermitted('A closing reason is required.')
  return { ...fu, followup_status: 'closed', closing_reason: reason.trim(), closed_at_utc: utc(now) }
}

export function continueFollowUp(fu: FollowUp, role: Role, nextDue: string): FollowUp {
  if (fu.assigned_role !== role) throw new NotPermitted(`Only the ${fu.assigned_role} role continues this follow-up.`)
  return { ...fu, followup_status: 'watching', next_review_due_utc: utc(nextDue) }
}

// TODO(question: confirm the usefulness scale; stored here as 1 = useful, 0 = not useful).
export const USEFUL = { useful: 1, not_useful: 0 } as const
export type Usefulness = keyof typeof USEFUL

/** FR-FU-07: the astronaut's usefulness rating. Logged as a feedback entry; it never changes references, limits or rules. */
export function rate(a: Action, value: Usefulness, now: Date | string): { action: Action; feedback_entry: FeedbackEntry } {
  mustBe(a, ['completed', 'awaiting_impact_review', 'unable', 'rejected'])
  const stamp = utc(now).replace(/[-:TZ]/g, '').slice(0, 14)
  return {
    action: { ...a, feedback_rating: USEFUL[value] },
    feedback_entry: {
      feedback_entry_id: `${realmOf(a.action_id)}:feedback_entry:${keyOf(a.action_id)}-${stamp}`,
      schema_version: '1.0', subject_id: a.subject_id, data_origin: 'application_generated', is_simulated: a.is_simulated,
      created_at_utc: utc(now), target_record_id: a.action_id, feedback_kind: 'action_usefulness',
      rating: USEFUL[value], comment: null, requires_specialist_review: false,
    },
  }
}

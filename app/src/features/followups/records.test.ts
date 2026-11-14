// Every record the act-and-follow screens write is validated against contracts/*.schema.json (CLAUDE.md rule 10).
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'
import type { Action, FollowUp, MissionSchedule } from '../../data/contract'
import { restOpportunity, scheduleInputFor } from '../../engine/schedule'
import { plannerRequest } from '../schedule/request'
import { laterReading } from './later'
import { accept, closeFollowUp, decline, markDone, NotPermitted, OUTCOME_TEXT, rate, start, unable } from './records'

const schemas = import.meta.glob('../../../../contracts/*.schema.json', { eager: true, import: 'default' }) as Record<string, object>
const ajv = new Ajv2020({ strict: false, allErrors: true })
addFormats(ajv)
const schema = (e: string) => ajv.compile(schemas[`../../../../contracts/${e}.schema.json`])
const V = { action: schema('action'), follow_up: schema('follow_up'), feedback_entry: schema('feedback_entry') }
function valid(entity: keyof typeof V, r: unknown) {
  const ok = V[entity](r)
  expect(ok, JSON.stringify(V[entity].errors)).toBe(true)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S1 = Object.values(import.meta.glob('../../../public/data/fixtures/S1.json', { eager: true, import: 'default' }))[0] as any
const actions = S1.action as Action[]
const fus = S1.follow_up as FollowUp[]
const rest = actions.find((a) => a.action_id === 'sim:action:rest-d27') as Action
const watch = actions.find((a) => a.action_id === 'sim:action:dec-d25') as Action
const pain = actions.find((a) => a.action_id === 'sim:action:pain-d20') as Action
const NOW = '2026-11-14T08:30:00Z'

describe('action and follow-up writes', () => {
  it('accept opens a follow-up (FR-FU-01) and both validate', () => {
    const { action, follow_up } = accept(rest, null, 'astronaut', NOW)
    expect(action.execution_status).toBe('accepted')
    expect(follow_up.follow_up_id).toBe('sim:follow_up:rest-d27')
    expect(follow_up.followup_status).toBe('action_open')
    valid('action', action)
    valid('follow_up', follow_up)
  })

  it('decline stores the optional reason (FR-FU-03)', () => {
    const withReason = decline(rest, '  Meeting cannot move tonight ', 'astronaut')
    expect(withReason.execution_status).toBe('rejected')
    expect(withReason.rejection_reason).toBe('Meeting cannot move tonight')
    expect(decline(rest, '', 'astronaut').rejection_reason).toBeNull()
    valid('action', withReason)
  })

  it('done with no later reading stays awaiting_impact_review and cannot close (FR-FU-06)', () => {
    const fu = fus.find((f) => f.action_id === watch.action_id) as FollowUp
    const later = laterReading(S1, watch, NOW)
    expect(later).toBeNull()
    const { action, follow_up } = markDone(watch, fu, later, 'astronaut', NOW)
    expect(action.execution_status).toBe('awaiting_impact_review')
    expect(follow_up?.followup_status).toBe('watching')
    expect(follow_up?.outcome_note).toBe(OUTCOME_TEXT.no_reading)
    valid('action', action)
    valid('follow_up', follow_up)
    expect(() => closeFollowUp(follow_up as FollowUp, action, 'Recovered', 'astronaut', NOW)).toThrow(NotPermitted)
  })

  it('done with a later reading uses the non-causal template (FR-FU-05)', () => {
    const fu = fus.find((f) => f.action_id === watch.action_id) as FollowUp
    const { action, follow_up } = markDone(watch, fu, { position: 'within', record_id: 'sim:decode_session:d28' }, 'astronaut', NOW)
    expect(action.execution_status).toBe('completed')
    expect(follow_up?.outcome_note).toBe('Your result was within your reference after this action. This does not show that the action caused it.')
    const closed = closeFollowUp(follow_up as FollowUp, action, 'Result recorded; owner closed', 'astronaut', NOW)
    expect(closed.followup_status).toBe('closed')
    valid('follow_up', closed)
  })

  it('in progress and unable validate', () => {
    const a = accept(rest, null, 'astronaut', NOW).action
    valid('action', start(a, 'astronaut'))
    valid('action', unable(start(a, 'astronaut'), 'EVA prep ran late', 'astronaut'))
  })

  it('usefulness rating is logged as a feedback entry (FR-FU-07)', () => {
    const done = markDone(watch, null, null, 'astronaut', NOW).action
    const { action, feedback_entry } = rate(done, 'useful', NOW)
    expect(action.feedback_rating).toBe(1)
    expect(feedback_entry.feedback_kind).toBe('action_usefulness')
    valid('action', action)
    valid('feedback_entry', feedback_entry)
  })

  it('permissions are enforced in the data layer: the astronaut cannot complete a medical step', () => {
    expect(() => markDone(pain, null, null, 'astronaut', NOW)).toThrow(NotPermitted)
    expect(() => decline(pain, '', 'astronaut')).toThrow(NotPermitted)
  })

  it('outcome wording never claims the action worked', () => {
    for (const t of Object.values(OUTCOME_TEXT)) expect(t).not.toMatch(/\b(worked|improved|caused by|because of|helped)\b/i)
  })
})

describe('planner request (FR-SCH-05)', () => {
  const items = S1.mission_schedule as MissionSchedule[]
  const r = restOpportunity(scheduleInputFor(items, '2026-11-14'))

  it('S1 shows the meeting move: 6 h → 7 h', () => {
    expect(r.status).toBe('improved')
    expect([r.current_minutes, r.best_minutes]).toEqual([360, 420])
  })

  it('S3 says there is no valid alternative (FR-SCH-04)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const S3 = Object.values(import.meta.glob('../../../public/data/fixtures/S3.json', { eager: true, import: 'default' }))[0] as any
    const r3 = restOpportunity(scheduleInputFor(S3.mission_schedule as MissionSchedule[], '2026-11-14'))
    expect(r3.status).toBe('no_valid_alternative')
    expect(r3.changes).toEqual([])
  })

  it('contains only the schedule change, no health data, and validates', () => {
    const a = plannerRequest(r.changes, items, r.current_minutes as number, r.best_minutes as number, NOW)
    valid('action', a)
    expect(a.owner_role).toBe('planner')
    expect(a.execution_status).toBe('proposed')
    expect(a.step_category).toBe('approved_plan_step')
    expect(a.finding_id).toBeNull()
    expect(a.action_text).toBe('Move "Planning meeting" from 23:00–00:00 to 22:00–23:00 UTC.')
    expect(JSON.stringify(Object.values(a))).not.toMatch(/decode|sleep|pulse|symptom|pain|finding:|reference/i)
  })
})

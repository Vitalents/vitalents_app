// FR-FU-04: on or after the follow-up date the owner says what happened; the answer is stored with data IDs.
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'
import type { Action, FollowUp } from '../../data/contract'
import { laterReading, readingsSince } from './later'
import {
  accept, answerReview, closeFollowUp, NotPermitted, OUTCOME_TEXT, REVIEW_TEXT, reviewDue, reviewLaterReading, splitOutcome,
} from './records'
import { T } from './strings'

const schemas = import.meta.glob('../../../../contracts/*.schema.json', { eager: true, import: 'default' }) as Record<string, object>
const ajv = new Ajv2020({ strict: false, allErrors: true })
addFormats(ajv)
const schema = (e: string) => ajv.compile(schemas[`../../../../contracts/${e}.schema.json`])
const V = { action: schema('action'), follow_up: schema('follow_up') }
function valid(entity: keyof typeof V, r: unknown) {
  expect(V[entity](r), JSON.stringify(V[entity].errors)).toBe(true)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S1 = Object.values(import.meta.glob('../../../public/data/fixtures/S1.json', { eager: true, import: 'default' }))[0] as any
const actions = S1.action as Action[]
const watch = actions.find((a) => a.action_id === 'sim:action:dec-d25') as Action // in_progress, follow-up due 15 Nov 07:00
const rest = actions.find((a) => a.action_id === 'sim:action:rest-d27') as Action
const pain = actions.find((a) => a.action_id === 'sim:action:pain-d20') as Action
const fu = (S1.follow_up as FollowUp[]).find((f) => f.action_id === watch.action_id) as FollowUp
const BEFORE = '2026-11-15T06:59:59Z'
const AT = '2026-11-15T07:00:00Z'
const AFTER = '2026-11-15T08:00:00Z'

describe('when the question shows (FR-FU-04)', () => {
  it('not before the follow-up date; on and after it', () => {
    expect(reviewDue(watch, fu, BEFORE)).toBe(false)
    expect(reviewDue(watch, fu, AT)).toBe(true)
    expect(reviewDue(watch, fu, AFTER)).toBe(true)
  })
  it('not for a closed follow-up, a missing date, or a step not under way', () => {
    expect(reviewDue(watch, { ...fu, followup_status: 'closed' }, AFTER)).toBe(false)
    expect(reviewDue(watch, { ...fu, next_review_due_utc: null }, AFTER)).toBe(false)
    expect(reviewDue(rest, fu, AFTER)).toBe(false) // proposed
    expect(reviewDue({ ...watch, execution_status: 'awaiting_impact_review' }, fu, AFTER)).toBe(false)
  })
  it('permissions in the data layer: the astronaut cannot answer for a medical step', () => {
    const pfu = (S1.follow_up as FollowUp[]).find((f) => f.action_id === pain.action_id) as FollowUp
    expect(() => answerReview(pain, pfu, 'done', '', [], null, 'astronaut', '2026-11-16T00:00:00Z')).toThrow(NotPermitted)
    expect(() => answerReview(watch, fu, 'done', '', [], null, 'astronaut', BEFORE)).toThrow(NotPermitted)
  })
})

describe('readings since the step started', () => {
  const r = readingsSince(S1, watch, fu.opened_at_utc, AFTER)
  it('S1: the Decode session after 12 Nov, with its data status and position, never a combined value', () => {
    expect(r.map((x) => x.record_id)).toEqual(['sim:decode_session:d26'])
    expect(r[0]).toMatchObject({ indicator: 'decode_session', value: 36, status: 'valid', position: 'below_range' })
  })
  it('the rest-window step shows Decode and sleep in separate indicators (side by side)', () => {
    const x = readingsSince(S1, rest, '2026-11-12T08:00:00Z', AFTER)
    expect(new Set(x.map((y) => y.indicator))).toEqual(new Set(['decode_session', 'sleep_record']))
    expect(x.filter((y) => y.indicator === 'sleep_record').map((y) => y.date)).toEqual(['2026-11-13', '2026-11-14'])
  })
  it('missing values stay null; a not-comparable session gets no position', () => {
    const d = {
      ...S1,
      decode_session: S1.decode_session.map((s: { decode_session_id: string }) => (s.decode_session_id === 'sim:decode_session:d26' ? { ...s, correct_count: null } : s)),
      information_status: [...S1.information_status, { record_ref: 'sim:decode_session:d26', status: 'not_comparable', reason_codes: ['pause'], created_at_utc: '2026-11-15T00:00:00Z' }],
    }
    const y = readingsSince(d, watch, fu.opened_at_utc, AFTER)[0]
    expect(y.value).toBeNull()
    expect(y.status).toBe('not_comparable')
    expect(y.reasons).toEqual(['pause'])
    expect(y.position).toBeNull()
  })
  it('no finding → no readings', () => {
    expect(readingsSince(S1, { ...watch, finding_id: null }, fu.opened_at_utc, AFTER)).toEqual([])
  })
})

describe('storing the answer (FR-FU-04, D-7)', () => {
  const ids = readingsSince(S1, watch, fu.opened_at_utc, AFTER).map((x) => x.record_id)

  it('deadline done records completion now; observations since opening cannot stand in for an observation after completion', () => {
    const later = laterReading(S1, watch, fu.opened_at_utc, AFTER)
    expect(later).toMatchObject({ position: 'outside', record_id: 'sim:decode_session:d26' })
    const { action, follow_up } = answerReview(watch, fu, 'done', '  Felt more focused in the afternoon ', ids, later, 'astronaut', AFTER)
    expect(action.execution_status).toBe('awaiting_impact_review')
    expect(action.completed_at_utc).toBe(AFTER)
    expect(follow_up.followup_status).toBe(fu.followup_status)
    expect(follow_up.closed_at_utc ?? null).toBeNull()
    const o = splitOutcome(follow_up.outcome_note as string)
    expect(o.text).toBe(`${OUTCOME_TEXT.no_reading} You noted: “Felt more focused in the afternoon”`)
    expect(o.ids).toEqual(['sim:decode_session:d26'])
    valid('action', action)
    valid('follow_up', follow_up)
    expect(() => closeFollowUp(follow_up, action, 'Reviewed the readings', 'astronaut', AFTER)).toThrow(NotPermitted)
    expect(laterReading(S1, action, AFTER, AFTER)).toBeNull()
    const laterSession = { ...S1.decode_session.find((s: { decode_session_id: string }) => s.decode_session_id === 'sim:decode_session:d26'),
      decode_session_id: 'sim:decode_session:after-deadline-completion', start_at_utc: '2026-11-15T09:00:00Z', end_at_utc: '2026-11-15T09:01:30Z', created_at_utc: '2026-11-15T09:01:30Z' }
    const afterCompletion = { ...S1, decode_session: [...S1.decode_session, laterSession],
      information_status: [...S1.information_status, { record_ref: laterSession.decode_session_id, status: 'valid', created_at_utc: laterSession.created_at_utc }] }
    const observation = laterReading(afterCompletion, action, AFTER, '2026-11-15T10:00:00Z')
    expect(observation?.record_id).toBe(laterSession.decode_session_id)
    const reviewed = reviewLaterReading(action, follow_up, observation, 'astronaut', '2026-11-15T10:00:00Z')
    expect(reviewed.action.execution_status).toBe('completed')
    expect(reviewed.action.completed_at_utc).toBe(AFTER)
    expect(reviewed.follow_up.followup_status).not.toBe('closed')
    // only the owner's separate explicit close moves it to closed
    const closed = closeFollowUp(reviewed.follow_up, reviewed.action, 'Reviewed the later observation', 'astronaut', '2026-11-15T10:01:00Z')
    expect(closed.followup_status).toBe('closed')
    valid('follow_up', closed)
  })

  it('done with no later reading → awaiting_impact_review and the follow-up cannot close', () => {
    const { action, follow_up } = answerReview(watch, fu, 'done', '', [], null, 'astronaut', AFTER)
    expect(action.execution_status).toBe('awaiting_impact_review')
    expect(splitOutcome(follow_up.outcome_note as string)).toEqual({ text: OUTCOME_TEXT.no_reading, ids: [] })
    expect(() => closeFollowUp(follow_up, action, 'Recovered', 'astronaut', AFTER)).toThrow(NotPermitted)
    valid('action', action)
    valid('follow_up', follow_up)
  })

  it('not done → deferred with the optional note; unable → unable', () => {
    const nd = answerReview(watch, fu, 'not_done', 'EVA prep took the evening', ids, null, 'astronaut', AFTER)
    expect(nd.action.execution_status).toBe('deferred')
    expect(nd.action.rejection_reason).toBe('EVA prep took the evening')
    expect(splitOutcome(nd.follow_up.outcome_note as string)).toEqual({ text: REVIEW_TEXT.not_done, ids })
    const un = answerReview(watch, fu, 'unable', '', ids, null, 'astronaut', AFTER)
    expect(un.action.execution_status).toBe('unable')
    expect(un.action.rejection_reason).toBeNull()
    for (const w of [nd, un]) { valid('action', w.action); valid('follow_up', w.follow_up) }
    // once answered, the question does not show again for the same date
    expect(reviewDue(nd.action, nd.follow_up, AFTER)).toBe(false)
    expect(reviewDue(un.action, un.follow_up, AFTER)).toBe(false)
  })

  it('accepting a fresh step and then reaching its date asks the question', () => {
    const { action, follow_up } = accept(rest, null, 'astronaut', '2026-11-14T08:30:00Z')
    expect(reviewDue(action, follow_up, AFTER)).toBe(true)
  })

  it('wording never claims the step worked or caused a change', () => {
    const texts = [...Object.values(REVIEW_TEXT), T.reviewQ, T.readingsLimits, T.readingsNone, ...Object.values(T.reviewOptions).flat()]
    for (const t of texts) expect(t).not.toMatch(/\b(worked|improved|caused by|because of|helped|effective)\b/i)
  })
})

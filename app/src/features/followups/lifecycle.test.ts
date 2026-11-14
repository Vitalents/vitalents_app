import { describe, expect, it } from 'vitest'
import fixture from '../../../public/data/fixtures/S1.json'
import type { Action, DecodeSession, FollowUp, PersonalReference } from '../../data/contract'
import { laterReading, readingsSince, type SinceData } from './later'
import { closeFollowUp, markDone, NotPermitted, reviewLaterReading, splitOutcome } from './records'

const DONE = '2026-11-14T08:30:00Z'
const READ = '2026-11-15T09:00:00Z'
const UNTIL = '2026-11-15T10:00:00Z'
const watch = fixture.action.find((a) => a.action_id === 'sim:action:dec-d25') as Action
const fu = fixture.follow_up.find((f) => f.action_id === watch.action_id) as FollowUp
const fresh = () => structuredClone(fixture) as unknown as SinceData

function addRound(d: SinceData, over: Partial<DecodeSession> = {}) {
  const session: DecodeSession = {
    ...d.decode_session.find((s) => s.session_state === 'completed')!,
    decode_session_id: 'sim:decode_session:later', subject_id: watch.subject_id,
    start_at_utc: READ, end_at_utc: '2026-11-15T09:01:30Z', created_at_utc: '2026-11-15T09:01:30Z',
    is_practice: false, planned_duration_ms: 90_000, session_state: 'completed', correct_count: 43,
    ...over,
  }
  d.decode_session.push(session)
  d.information_status.push({ record_ref: session.decode_session_id, status: 'valid', reason_codes: [], created_at_utc: session.end_at_utc! })
  return session
}

describe('FR-FU-04/06: a completed step can be reviewed after a later reading', () => {
  it('records the later observation, preserves completion time, and requires separate owner closure', () => {
    const waiting = markDone(watch, fu, null, 'astronaut', DONE)
    const d = fresh()
    addRound(d)
    const later = laterReading(d, waiting.action, DONE, UNTIL)
    expect(later).toMatchObject({ record_id: 'sim:decode_session:later', position: 'within' })
    const reviewed = reviewLaterReading(waiting.action, waiting.follow_up!, later, 'astronaut', UNTIL)
    expect(reviewed.action.execution_status).toBe('completed')
    expect(reviewed.action.completed_at_utc).toBe(DONE)
    expect(reviewed.follow_up.followup_status).toBe(fu.followup_status)
    expect(reviewed.follow_up.closed_at_utc).toBeUndefined()
    expect(splitOutcome(reviewed.follow_up.outcome_note!).ids).toEqual([later!.record_id, later!.reference_id])
    expect(reviewed.follow_up.outcome_note).toContain(`Reviewed at: ${UNTIL}`)
    expect(() => closeFollowUp(reviewed.follow_up, reviewed.action, '', 'astronaut', UNTIL)).toThrow(NotPermitted)
    const closed = closeFollowUp(reviewed.follow_up, reviewed.action, 'Reviewed the later observation', 'astronaut', UNTIL)
    expect(closed.followup_status).toBe('closed')
    expect(closed.closed_at_utc).toBe(UNTIL)
  })

  it('never closes with no eligible later reading, or lets another owner review it', () => {
    const waiting = markDone(watch, fu, null, 'astronaut', DONE)
    expect(laterReading(fresh(), watch, DONE, UNTIL)).toBeNull()
    expect(() => reviewLaterReading(waiting.action, waiting.follow_up!, null, 'astronaut', UNTIL)).toThrow(NotPermitted)
    const d = fresh(); addRound(d)
    expect(() => reviewLaterReading(waiting.action, waiting.follow_up!, laterReading(d, watch, DONE, UNTIL), 'planner', UNTIL)).toThrow(NotPermitted)
    expect(() => closeFollowUp(waiting.follow_up!, waiting.action, 'A reason', 'astronaut', UNTIL)).toThrow(NotPermitted)
    expect(() => closeFollowUp(fu, watch, 'A reason', 'astronaut', UNTIL)).toThrow(NotPermitted)
  })
})

describe('later readings preserve subject, time, quality and reference boundaries', () => {
  it.each([
    { label: 'another subject', over: { subject_id: 'sim:crew:other' } },
    { label: 'practice', over: { is_practice: true } },
    { label: 'a shorter protocol', over: { planned_duration_ms: 30_000 } },
    { label: 'an incomplete session', over: { session_state: 'aborted' as const } },
    { label: 'a future measurement', over: { start_at_utc: '2026-11-16T09:00:00Z', end_at_utc: '2026-11-16T09:01:30Z' } },
    { label: 'a future persistence record', over: { created_at_utc: '2026-11-16T09:01:30Z' } },
  ])('does not count $label', ({ over }) => {
    const d = fresh(); addRound(d, over)
    expect(laterReading(d, watch, DONE, UNTIL)).toBeNull()
  })

  it('uses the latest quality record available by review time, including correction of an earlier status', () => {
    const d = fresh(); const s = addRound(d)
    d.information_status.push({ record_ref: s.decode_session_id, status: 'not_comparable', created_at_utc: '2026-11-15T09:02:00Z' })
    expect(laterReading(d, watch, DONE, UNTIL)).toBeNull()
    d.information_status.push({ record_ref: s.decode_session_id, status: 'valid', created_at_utc: '2026-11-16T09:00:00Z' })
    expect(laterReading(d, watch, DONE, UNTIL)).toBeNull() // future correction cannot count today
    d.information_status.push({ record_ref: s.decode_session_id, status: 'valid', created_at_utc: '2026-11-15T09:03:00Z' })
    expect(laterReading(d, watch, DONE, UNTIL)?.record_id).toBe(s.decode_session_id)
  })

  it('does not assume valid quality when there is no quality record', () => {
    const d = fresh(); const s = addRound(d)
    d.information_status = d.information_status.filter((q) => q.record_ref !== s.decode_session_id)
    expect(laterReading(d, watch, DONE, UNTIL)).toBeNull()
  })

  it('permits a reference computed after the same-day round from prior days, but excludes later-day versions', () => {
    const d = fresh(); addRound(d)
    const reference: PersonalReference = {
      ...d.personal_reference[0], personal_reference_id: 'sim:personal_reference:same-day',
      created_at_utc: '2026-11-15T09:02:00Z', comparison_target_date: '2026-11-15', end_date: '2026-11-14',
      reference_value: 43, range_low: 41, range_high: 44,
    }
    d.personal_reference.push(reference, {
      ...reference, personal_reference_id: 'sim:personal_reference:future', created_at_utc: '2026-11-16T07:00:00Z',
      comparison_target_date: '2026-11-16', range_low: 90, range_high: 100,
    })
    expect(laterReading(d, watch, DONE, UNTIL)).toMatchObject({ position: 'within', reference_id: reference.personal_reference_id })
    expect(laterReading(d, watch, DONE, '2026-11-17T10:00:00Z')).toMatchObject({ position: 'within', reference_id: reference.personal_reference_id })
  })

  it('accepts valid sleep or pulse observations without inventing a personal range', () => {
    const d = fresh()
    const original = d.sleep_record[0]
    const sleep = { ...original, sleep_record_id: 'sim:sleep_record:later', observation_date: '2026-11-15', created_at_utc: '2026-11-15T07:00:00Z', minutes_asleep: 390 }
    d.sleep_record.push(sleep)
    d.information_status.push({ record_ref: sleep.sleep_record_id, status: 'valid', created_at_utc: sleep.created_at_utc })
    const f = d.finding.find((x) => x.finding_id === watch.finding_id)!
    f.supporting_record_ids = [original.sleep_record_id]
    expect(laterReading(d, watch, DONE, UNTIL)).toEqual({ position: 'observed', record_id: sleep.sleep_record_id })
    const m = d.measurement[0]
    const pulse = { ...m, measurement_id: 'sim:measurement:later', observed_at_utc: READ, observation_date: READ.slice(0, 10), created_at_utc: READ, value: 65 }
    d.measurement.push(pulse)
    d.information_status.push({ record_ref: pulse.measurement_id, status: 'valid', created_at_utc: READ })
    f.supporting_record_ids = [m.measurement_id]
    expect(laterReading(d, watch, DONE, UNTIL)).toEqual({ position: 'observed', record_id: pulse.measurement_id })
    expect(readingsSince(d, watch, DONE, UNTIL)[0].position).toBeNull()
  })
})

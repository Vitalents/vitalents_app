import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixtures/S1.json'
import { DOMAINS } from '../content/content'
import { buildDomainViews, buildReview, infoStatusOf, type DataSet } from './view'
import { computeFacts } from './rules'
import { referenceForDate } from './reference'
import { sleepDecodePattern } from './patterns'

const date = '2026-11-14'
const data = () => structuredClone(fixture) as unknown as DataSet
const cognition = (d: DataSet) => buildDomainViews(d, DOMAINS, date).find((x) => x.content.id === 'cognition')!.indicators.find((x) => x.content.id === 'decode_correct_count')!
const session = (id: string, time: string, count: number, practice = false) => ({ ...data().decode_session[0],
  decode_session_id: `sim:decode_session:${id}`, start_at_utc: `${date}T${time}:00Z`, end_at_utc: `${date}T${time}:30Z`,
  planned_duration_ms: practice ? 30000 : 90000, correct_count: count, is_practice: practice, session_state: 'completed' as const })
const quality = (id: string) => ({ record_ref: id, status: 'valid', created_at_utc: `${date}T12:00:00Z`, reason_codes: [] })

describe('review selection invariants', () => {
  it('uses the actual time, not lexical ID, for the latest reading inside a day', () => {
    const d = data(); const old = session('zzzz', '07:00', 36); const recent = session('aaaa', '09:00', 48)
    d.decode_session.push(recent, old); d.information_status.push(quality(old.decode_session_id), quality(recent.decode_session_id))
    expect(cognition(d).today?.id).toBe(recent.decode_session_id)
    expect(cognition(d).value).toBe(48)
  })
  it('a 30-second practice cannot replace a measured result or satisfy today’s missing measurement', () => {
    const d = data(); const practice = session('practice', '10:00', 14, true)
    d.decode_session.push(practice); d.information_status.push(quality(practice.decode_session_id))
    expect(cognition(d).today).toBeNull()
    const rv = buildReview(d, DOMAINS, { daily_review_id: 'sim:daily_review:probe', review_date: date })
    expect(rv.missing.map((x) => x.indicator.id)).toContain('decode_correct_count')
    expect(rv.recorded.some((x) => x.record.id === practice.decode_session_id)).toBe(true)
    const measured = session('measured', '09:00', 43)
    d.decode_session.push(measured); d.information_status.push(quality(measured.decode_session_id))
    expect(cognition(d).today?.id).toBe(measured.decode_session_id)
    expect(cognition(d).comparison?.position).toBe('within_range')
  })
  it('missing quality does not authorize comparison', () => {
    const d = data(); const raw = session('unassessed', '09:00', 48); d.decode_session.push(raw)
    expect(infoStatusOf(d, raw.decode_session_id).status).toBe('incomplete')
    expect(cognition(d).comparison).toBeNull()
  })
  it('a future reference revision cannot change a past review', () => {
    const d = data(); const before = cognition(d).comparison
    d.personal_reference.push({ ...d.personal_reference[0], personal_reference_id: 'sim:personal_reference:future',
      created_at_utc: '2027-01-01T00:00:00Z', comparison_target_date: '2027-01-01', reference_value: 100, range_low: 95, range_high: 105 })
    expect(cognition(d).comparison).toEqual(before)
    expect(computeFacts(d, date)['decode.reference_range']).toBe('41–44')
  })
  it('three versions of one short night count as one night', () => {
    const d = data(); const latest = d.sleep_record.at(-1)!
    d.sleep_record = [1, 2, 3].map((i) => ({ ...latest, sleep_record_id: `sim:sleep_record:copy-${i}`, observation_date: date, recorded_interval_ms: 5 * 3600000 }))
    d.information_status.push(...d.sleep_record.map((s) => quality(s.sleep_record_id)))
    expect(computeFacts(d, date)['sleep.nights_under_6h_last3']).toBe(1)
  })
  it('a later same-day reference does not rewrite an earlier review timestamp', () => {
    const d = data(); const old = d.personal_reference[0]
    d.personal_reference.push({ ...old, personal_reference_id: 'sim:personal_reference:afternoon', created_at_utc: `${date}T15:00:00Z`,
      comparison_target_date: date, range_low: 95, range_high: 105, reference_value: 100 })
    const asOf = `${date}T12:00:00Z`
    expect(referenceForDate(d.personal_reference, 'decode_correct_count', date, undefined, asOf)?.personal_reference_id).toBe(old.personal_reference_id)
    expect(computeFacts(d, date, asOf)['decode.reference_range']).toBe('41–44')
    expect(sleepDecodePattern(d, { to: date, asOf }).decodeReference?.personal_reference_id).toBe(old.personal_reference_id)
  })
})

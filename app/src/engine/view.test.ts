// View derivation on the S1 Fahim fixture: separate statuses, FR-MAP-04, FR-REV-01/03.
import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixtures/S1.json'
import { DOMAINS, type DomainContent } from '../content/content'
import { buildDomainViews, buildReview, type DataSet } from './view'
import { formatDay, missionDay } from './mission'

const data = fixture as unknown as DataSet
const DATE = '2026-11-14'
const views = buildDomainViews(data, DOMAINS, DATE)
const byId = (id: string) => views.find((v) => v.content.id === id)!

describe('domain views (S1, mission day 27)', () => {
  it('FR-MAP-04: a region with one valid and one missing daily indicator shows no_reading', () => {
    const cognition = byId('cognition')
    const alert = cognition.indicators.find((i) => i.content.id === 'alertness_self')!
    const decode = cognition.indicators.find((i) => i.content.id === 'decode_correct_count')!
    expect(alert.status).toBe('valid')
    expect(decode.status).toBe('no_reading')
    expect(alert.value).toBe(8)
    expect(cognition.dataStatus).toBe('no_reading')
  })

  it('FR-MAP-04 on a synthetic domain: never fine because one indicator is fine', () => {
    const synthetic: DomainContent = {
      ...DOMAINS.find((d) => d.id === 'heart')!,
      indicators: [
        { id: 'hr_resting_bpm', name: 'Resting pulse', unit: 'bpm', frequency: 'daily', source_entity: 'measurement' },
        { id: 'hr_daily_bpm', name: 'Daily pulse', unit: 'bpm', frequency: 'daily', source_entity: 'measurement' },
      ],
    }
    const noLimited = { ...data, information_status: data.information_status.filter((s) => s.record_ref !== 'sim:measurement:hr-d27') }
    const [v] = buildDomainViews(noLimited, [synthetic], DATE)
    expect(v.indicators[0].status).toBe('incomplete') // no quality record is not an implicit pass
    expect(v.indicators[1].status).toBe('no_reading')
    expect(v.dataStatus).toBe('no_reading')
  })

  it('the pain follow-up maps to symptoms with under_specialist_review', () => {
    const s = byId('symptoms')
    expect(s.followStatus).toBe('under_specialist_review')
    expect(s.followUps.map((f) => f.follow_up_id)).toContain('sim:follow_up:pain-d20')
  })

  it('cognition shows watching; failed pulse acquisition stays no_reading with no open follow-up', () => {
    expect(byId('cognition').followStatus).toBe('watching')
    expect(byId('heart').dataStatus).toBe('no_reading')
    expect(byId('heart').indicators[0].value).toBeNull()
    expect(byId('heart').followStatus).toBe('no_open_follow_up')
    expect(byId('heart').indicators[0].reasons).toContain('weak_sensor_contact')
  })

  it('data status and follow-up status are independent fields', () => {
    for (const v of views) {
      expect(v).toHaveProperty('dataStatus')
      expect(v).toHaveProperty('followStatus')
    }
    expect(byId('sleep').dataStatus).toBe('valid')
    expect(byId('sleep').followStatus).toBe('no_open_follow_up')
  })

  it('sample domains have no data status', () => {
    for (const id of ['nutrition', 'movement', 'radiation']) expect(byId(id).dataStatus).toBeNull()
  })

  it('compares the last Decode session with the frozen reference', () => {
    const decode = byId('cognition').indicators.find((i) => i.content.id === 'decode_correct_count')!
    expect(decode.value).toBe(36)
    expect(decode.reference?.frozen).toBe(true)
    expect(decode.comparison?.position).toBe('below_range')
  })
})

describe('mission calendar', () => {
  it('day 27 is 14 Nov 2026, for dates and UTC timestamps alike', () => {
    expect(missionDay('2026-11-14')).toBe(27)
    expect(formatDay('2026-11-15T09:00:00Z')).toBe('15 Nov (day 28)')
  })
})

describe("today's review", () => {
  const review = buildReview(data, DOMAINS, fixture.daily_review[0])

  it('missing includes today’s Decode', () => {
    expect(review.missing.map((m) => m.indicator.id)).toContain('decode_correct_count')
  })
  it('recorded includes sleep, pulse and alertness for today', () => {
    const ids = review.recorded.map((r) => r.record.id)
    expect(ids).toEqual(expect.arrayContaining(['sim:sleep_record:d27', 'sim:measurement:hr-d27', 'sim:self_report:alert-d27']))
  })
  it('next step is the rest-window review and the pain follow-up stays visible (FR-REV-03)', () => {
    expect(review.nextStep?.action_id).toBe('sim:action:rest-d27')
    expect(review.otherFollowUps.map((f) => f.follow_up_id)).toContain('sim:follow_up:pain-d20')
  })
})

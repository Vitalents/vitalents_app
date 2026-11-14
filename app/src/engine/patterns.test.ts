// FR-PE-07: descriptive sleep / Decode pattern on the astronaut's own record (S1 Fahim, S3, S4 fixtures).
import { describe, expect, it } from 'vitest'
import s1 from '../../public/data/fixtures/S1.json'
import s3 from '../../public/data/fixtures/S3.json'
import s4 from '../../public/data/fixtures/S4.json'
import type { PersonalReference } from '../data/contract'
import { SHORT_NIGHT_RULE_HOURS, shortNightBasis, sleepDecodePattern } from './patterns'
import type { DataSet } from './view'

const S1 = s1 as unknown as DataSet
const DATE = '2026-11-14'
const clone = (d: DataSet): DataSet => JSON.parse(JSON.stringify(d))

describe('sleepDecodePattern on S1', () => {
  const p = sleepDecodePattern(S1, { to: DATE })

  it('shows the pattern: after short nights, Decode below the personal range', () => {
    expect(p.state).toBe('pattern')
    expect(p.from).toBe('2026-11-12') // the day after the reference period ends
    expect(p.short.nights).toBe(3)
    expect(p.short.compared).toBe(2)
    expect(p.short.below).toBe(2)
  })

  it('keeps the morning with no Decode round as no_decode, never as a value', () => {
    const d27 = p.short.pairs.find((x) => x.date === DATE)!
    expect(d27.outcome).toBe('no_decode')
    expect(d27.decode).toBeNull()
    expect(d27.decodeId).toBeNull()
  })

  it('uses the rule threshold when there is no personal sleep reference, with its rule id and source', () => {
    expect(p.shortNight).toMatchObject({ basis: 'rule', hours: SHORT_NIGHT_RULE_HOURS, ruleId: 'R-PLAN-01', ruleVersion: '0.1', sourceId: 'lib:nasa-sleep-risk' })
  })

  it('pairs each night with the Decode round of the same morning', () => {
    for (const x of [...p.short.pairs, ...p.other.pairs]) {
      const sleep = S1.sleep_record.find((s) => s.sleep_record_id === x.sleepId)!
      expect(sleep.observation_date).toBe(x.date)
      if (x.decodeId) expect(S1.decode_session.find((s) => s.decode_session_id === x.decodeId)!.start_at_utc.slice(0, 10)).toBe(x.date)
    }
  })

  it('says plainly when there is nothing to contrast with', () => {
    expect(p.other.nights).toBe(0)
    expect(p.other.compared).toBe(0)
  })

  it('lists every supporting record for Why?, including the reference', () => {
    expect(p.recordIds).toContain('sim:decode_session:d25')
    expect(p.recordIds).toContain('sim:sleep_record:d27')
    expect(p.recordIds).toContain('sim:personal_reference:decode-d25')
  })

  it('ignores records after the review date', () => {
    const q = sleepDecodePattern(S1, { to: '2026-11-12' })
    expect(q.short.nights).toBe(1)
    expect(q.short.below).toBe(1)
  })
})

describe('sleepDecodePattern edge cases', () => {
  it('does not compare a not-comparable Decode round', () => {
    const d = clone(S1)
    const st = d.information_status.find((s) => s.record_ref === 'sim:decode_session:d25')!
    st.status = 'not_comparable'
    const p = sleepDecodePattern(d, { to: DATE })
    expect(p.short.pairs.find((x) => x.date === '2026-11-12')!.outcome).toBe('not_comparable')
    expect(p.short.compared).toBe(1)
  })

  it('without a usable Decode reference there is no pattern', () => {
    const p = sleepDecodePattern(s4 as unknown as DataSet, { to: DATE })
    expect(p.state).toBe('no_decode_reference')
    expect(p.short.nights).toBe(0)
  })

  it('S3: one short night with a Decode round below the range, one with none yet', () => {
    const p = sleepDecodePattern(s3 as unknown as DataSet, { to: DATE })
    expect(p.state).toBe('pattern')
    expect(p.short.nights).toBe(2)
    expect(p.short.compared).toBe(1)
    expect(p.short.below).toBe(1)
  })

  it('uses the personal sleep reference range when one is usable', () => {
    const d = clone(S1)
    const sleepRef = { ...d.personal_reference[0], personal_reference_id: 'sim:personal_reference:sleep-x', metric_code: 'sleep_duration', range_low: 5.2, range_high: 7.3, reference_value: 7 } as PersonalReference
    d.personal_reference.push(sleepRef)
    expect(shortNightBasis(d)).toMatchObject({ basis: 'sleep_reference', hours: 5.2, referenceId: 'sim:personal_reference:sleep-x' })
    const p = sleepDecodePattern(d, { to: DATE })
    expect(p.short.nights).toBe(1) // only 5.1 h is below 5.2 h
    expect(p.other.nights).toBe(2)
    expect(p.recordIds).toContain('sim:personal_reference:sleep-x')
  })

  it('no short nights in the period gives the no_short_nights state', () => {
    const d = clone(S1)
    for (const s of d.sleep_record) if (s.recorded_interval_ms !== null) s.recorded_interval_ms = 7 * 3_600_000
    expect(sleepDecodePattern(d, { to: DATE }).state).toBe('no_short_nights')
  })

  it('a sleep record with no recorded interval is not a night, never 0 h', () => {
    const d = clone(S1)
    d.sleep_record.find((s) => s.sleep_record_id === 'sim:sleep_record:d27')!.recorded_interval_ms = null
    const p = sleepDecodePattern(d, { to: DATE })
    expect(p.short.pairs.some((x) => x.sleepId === 'sim:sleep_record:d27')).toBe(false)
  })
})

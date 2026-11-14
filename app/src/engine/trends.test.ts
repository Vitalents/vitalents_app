// Record & trends helpers on the S1 Fahim fixture: FR-REF-03, FR-REF-04, FR-REF-07, contract D-3.
import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixtures/S1.json'
import { DOMAINS } from '../content/content'
import type { PersonalReference } from '../data/contract'
import { buildDomainViews, type DataSet } from './view'
import {
  trendTicks, buildTrend, excludedFromReference, openFollowUpsForReference, referenceChangeLog, referenceVersions, summarizeTrend, trendDomain,
} from './trends'

const data = fixture as unknown as DataSet
const DATE = '2026-11-14'
const views = buildDomainViews(data, DOMAINS, DATE)
const ind = (domain: string, id: string) => views.find((v) => v.content.id === domain)!.indicators.find((i) => i.content.id === id)!
const decode = ind('cognition', 'decode_correct_count')
const ref = decode.reference!
const points = buildTrend(decode.history, { to: DATE, daily: true, reference: ref })

describe('buildTrend', () => {
  it('fills a daily day with no record as a No reading gap, never 0', () => {
    const d27 = points.find((p) => p.date === DATE)!
    expect(d27.kind).toBe('no_reading')
    expect(d27.value).toBeNull()
    expect(d27.valid).toBeNull()
    expect(d27.problem).toBeNull()
    expect(d27.id).toBeNull()
  })

  it('leaves a gap for the interrupted round with no published score', () => {
    const d23 = points.find((p) => p.id === 'sim:decode_session:d23')!
    expect(decode.history.find((p) => p.id === d23.id)?.status).toBe('not_comparable')
    expect(d23.kind).toBe('no_reading')
    expect(d23.valid).toBeNull()
    expect(d23.problem).toBeNull()
  })

  it('keeps an observed not-comparable value on the problem channel', () => {
    const [point] = buildTrend([{ date: DATE, value: 30, status: 'not_comparable', id: 'sim:decode_session:example' }], { to: DATE, daily: false })
    expect(point.status).toBe('not_comparable')
    expect(point.kind).toBe('problem')
    expect(point.valid).toBeNull()
    expect(point.problem).toBe(30)
  })

  it('compares only valid values after the reference period (change from your reference)', () => {
    const d26 = points.find((p) => p.id === 'sim:decode_session:d26')!
    expect(d26.comparison?.position).toBe('below_range')
    expect(d26.comparison?.absolute_change).toBe(-7)
    const d20 = points.find((p) => p.id === 'sim:decode_session:d20')!
    expect(d20.inReference).toBe(true)
    expect(d20.comparison).toBeNull()
  })

  it('leaves a gap when weak wrist contact yields no pulse value on day 27', () => {
    const hr = ind('heart', 'hr_resting_bpm')
    const p = buildTrend(hr.history, { to: DATE, daily: true }).at(-1)!
    expect(hr.status).toBe('limited')
    expect(p.kind).toBe('no_reading')
    expect(p.value).toBeNull()
    expect(p.valid).toBeNull()
    expect(p.problem).toBeNull()
  })

  it('as-needed indicators are not padded with No reading days', () => {
    const p = buildTrend([{ date: '2026-11-07', value: 36.5, status: 'valid', id: 'sim:measurement:t' }], { to: DATE, daily: false })
    expect(p).toHaveLength(1)
  })

  it('a null value with a valid status still shows as No reading', () => {
    const p = buildTrend([{ date: DATE, value: null, status: 'valid', id: 'sim:sleep_record:x' }], { to: DATE, daily: true })
    expect(p[0].kind).toBe('no_reading')
  })

  it('summary counts each kind', () => {
    const s = summarizeTrend(points)
    expect(s.valid).toBe(13)
    expect(s.problem).toBe(0)
    expect(s.noReading).toBe(2)
    expect(s.latest?.date).toBe(DATE)
    expect(s.latestWithValue?.id).toBe('sim:decode_session:d26')
  })
})

describe('trendDomain', () => {
  it('holds values and the reference band, without forcing a 0 floor', () => {
    const [lo, hi] = trendDomain(points, ref)!
    expect(lo).toBeGreaterThan(0)
    expect(lo).toBeLessThanOrEqual(35)
    expect(hi).toBeGreaterThanOrEqual(44)
  })
  it('ticks are round and at most six', () => {
    expect(trendTicks([4.5, 8])).toEqual([5, 6, 7, 8])
    expect(trendTicks([25, 50])).toEqual([25, 30, 35, 40, 45, 50])
    expect(trendTicks([6.5, 8.5]).length).toBeLessThanOrEqual(6)
  })
  it('is null when there is nothing to draw', () => {
    expect(trendDomain([], null)).toBeNull()
  })
})

describe('reference versions and change log (FR-REF-03)', () => {
  it('one version: no change log entries', () => {
    const v = referenceVersions(data.personal_reference, 'decode_correct_count')
    expect(v).toHaveLength(1)
    expect(referenceChangeLog(v)).toEqual([])
  })

  it('two versions: one entry naming every changed field and record', () => {
    const v2: PersonalReference = {
      ...ref, personal_reference_id: 'sim:personal_reference:decode-d26', reference_version: 'ref-1.1', created_at_utc: '2026-11-15T06:00:00Z',
      reference_value: 42, valid_record_count: 10, source_record_ids: [...ref.source_record_ids, 'sim:decode_session:d25'], end_date: '2026-11-12',
    }
    const log = referenceChangeLog(referenceVersions([v2, ref], 'decode_correct_count'))
    expect(log).toHaveLength(1)
    expect(log[0].from.reference_version).toBe('ref-1.0')
    expect(log[0].to.reference_version).toBe('ref-1.1')
    expect(log[0].changes.map((c) => c.field).sort()).toEqual(['end_date', 'reference_value', 'valid_record_count'])
    expect(log[0].addedRecords).toEqual(['sim:decode_session:d25'])
    expect(log[0].removedRecords).toEqual([])
  })
})

describe('FR-REF-07 data used and FR-REF-04 frozen', () => {
  it('lists records inside the period that the reference did not use', () => {
    const ex = excludedFromReference(points, ref).map((p) => p.id)
    expect(ex).toContain('sim:decode_session:d23')
    expect(ex).not.toContain('sim:decode_session:d20')
  })

  it('finds the open follow-up that keeps the S1 Decode reference frozen', () => {
    expect(ref.frozen).toBe(true)
    const fus = openFollowUpsForReference(data, ref)
    expect(fus.map((f) => f.follow_up_id)).toContain('sim:follow_up:dec-d25')
    expect(fus.map((f) => f.follow_up_id)).not.toContain('sim:follow_up:pain-d20')
  })
})

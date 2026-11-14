// FR-DEC-07 (SRS 7.3): pause and device_change rules, and how they reach the stored information_status.
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'
import decodeSessionSchema from '../../../contracts/decode_session.schema.json'
import infoSchema from '../../../contracts/information_status.schema.json'
import type { DecodeSession } from '../data/contract'
import { buildRoundRecords, type RawResponse } from './decodeSession'
import {
  baselineSessions, deviceChange, deviceClassFrom, deviceClassOf, findPauses, validityReasons, type DeviceClass,
} from './decodeValidity'

const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const vSession = ajv.compile(decodeSessionSchema)
const vInfo = ajv.compile(infoSchema)

const r = (trial: number, stim: number, resp: number | null): RawResponse => ({
  trial_index: trial, symbol_id: 'g1', correct_digit: 4, stimulus_ms: stim, response_ms: resp, response_digit: resp === null ? null : 4,
})
/** A steady round: one correct answer every 1 s, with optional long waits inserted before given trials. */
function steady(waits: Record<number, number> = {}, until = 90_000): RawResponse[] {
  const out: RawResponse[] = []
  let t = 0
  for (let i = 1; ; i++) {
    const stim = t
    const resp = stim + 850 + (waits[i] ?? 0)
    if (resp >= until) { out.push(r(i, stim, null)); break }
    out.push(r(i, stim, resp))
    t = resp + 150
  }
  return out
}

describe('pauses (SRS 7.3: two or more pauses of 5 s or more without a response)', () => {
  it('a steady round has no pause', () => {
    expect(findPauses(steady(), 90_000)).toEqual([])
  })
  it('one pause is reported but is not enough', () => {
    const p = findPauses(steady({ 10: 5_000 }), 90_000)
    expect(p).toHaveLength(1)
    expect(p[0].duration_ms).toBe(5_850)
    expect(validityReasons({ pauses: p, deviceChanged: false })).toEqual([])
  })
  it('two pauses of exactly 5 s each → pause', () => {
    const p = findPauses(steady({ 10: 4_150, 30: 4_150 }), 90_000)
    expect(p.map((x) => x.duration_ms)).toEqual([5_000, 5_000])
    expect(validityReasons({ pauses: p, deviceChanged: false })).toEqual(['pause'])
  })
  it('waits just under 5 s are not pauses', () => {
    expect(findPauses(steady({ 10: 4_149, 30: 4_149 }), 90_000)).toEqual([])
  })
  it('time with the page hidden is not counted (existing hidden rule covers it)', () => {
    // a 6 s wait: 1.5 s hidden → 4.5 s visible, not a pause; 0.5 s hidden → 5.5 s visible, a pause
    const raw = steady({ 10: 5_150 })
    const stim = raw[9].stimulus_ms
    expect(findPauses(raw, 90_000, [[stim + 1_000, stim + 2_500]])).toEqual([])
    expect(findPauses(raw, 90_000, [[stim + 1_000, stim + 1_500]])[0].duration_ms).toBe(5_500)
  })
  it('the open trial at the end of the window counts up to the window end only', () => {
    const raw = [...steady({}, 80_000).slice(0, -1)]
    const last = raw[raw.length - 1]
    raw.push(r(last.trial_index + 1, (last.response_ms as number) + 150, null))
    const p = findPauses(raw, 90_000)
    expect(p).toHaveLength(1)
    expect(p[0].at_ms + p[0].duration_ms).toBe(90_000)
  })
  it('a duplicate press does not shorten the wait; the first response ends it', () => {
    const raw = [r(1, 0, 6_000), r(1, 0, 6_050), r(2, 6_150, 7_000)]
    expect(findPauses(raw, 90_000).map((p) => p.trial_index)).toEqual([1])
  })
})

const sess = (id: string, day: number, input: string, cls: DeviceClass | null): DecodeSession => ({
  decode_session_id: `sim:decode_session:${id}`, schema_version: '1.0', subject_id: 'sim:crew:fahim', data_origin: 'simulated_mission',
  is_simulated: true, created_at_utc: '2026-11-14T06:00:00Z', protocol_version: 'decode-1.0', key_version: 'k', start_at_utc: `2026-11-${String(day).padStart(2, '0')}T07:30:00Z`,
  end_at_utc: null, planned_duration_ms: 90_000, is_practice: false, session_state: 'completed', input_method: input, app_version: 'sim',
  technical_context: cls ? JSON.stringify({ device_class: cls }) : null,
  accepted_responses: 40, correct_count: 40, accuracy_percent: 100, median_correct_rt_ms: 900,
})

describe('device change (SRS 7.3 device_change)', () => {
  const touchTablets = [1, 2, 3, 4, 5].map((d) => sess(`d${d}`, d, 'touch', 'tablet'))
  it('same device class and input method → no change', () => {
    expect(deviceChange({ device_class: 'tablet', input_method: 'touch' }, touchTablets)).toBe(false)
  })
  it('a different input method → change', () => {
    expect(deviceChange({ device_class: 'tablet', input_method: 'keyboard' }, touchTablets)).toBe(true)
  })
  it('a different device class → change', () => {
    expect(deviceChange({ device_class: 'phone', input_method: 'touch' }, touchTablets)).toBe(true)
  })
  it('no baseline → never a change (first rounds)', () => {
    expect(deviceChange({ device_class: 'laptop', input_method: 'keyboard' }, [])).toBe(false)
  })
  it('a class not recorded on either side is not compared; input method still is', () => {
    const noClass = [1, 2, 3].map((d) => sess(`n${d}`, d, 'touch', null))
    expect(deviceChange({ device_class: 'laptop', input_method: 'touch' }, noClass)).toBe(false)
    expect(deviceChange({ device_class: null, input_method: 'touch' }, touchTablets)).toBe(false)
    expect(deviceChange({ device_class: 'laptop', input_method: 'keyboard' }, noClass)).toBe(true)
  })
  it('the usual device is the most frequent one; one odd session does not move it', () => {
    const mixed = [...touchTablets, sess('d6', 6, 'keyboard', 'laptop')]
    expect(deviceChange({ device_class: 'tablet', input_method: 'touch' }, mixed)).toBe(false)
    expect(deviceChange({ device_class: 'laptop', input_method: 'keyboard' }, mixed)).toBe(true)
  })
  it('device class from the browser', () => {
    expect(deviceClassFrom({ coarsePointer: false, shortSidePx: 900 })).toBe('laptop')
    expect(deviceClassFrom({ coarsePointer: true, shortSidePx: 390 })).toBe('phone')
    expect(deviceClassFrom({ coarsePointer: true, shortSidePx: 820 })).toBe('tablet')
    expect(deviceClassOf({ technical_context: 'not json' })).toBeNull()
  })
})

describe('baseline sessions', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const S1 = Object.values(import.meta.glob('../../public/data/fixtures/S1.json', { eager: true, import: 'default' }))[0] as any
  it('S1 uses the sessions behind the Decode reference', () => {
    const b = baselineSessions(S1, 'sim:crew:fahim')
    expect(b.map((s) => s.decode_session_id)).toEqual(S1.personal_reference[0].source_record_ids)
  })
  it('without a reference: earlier valid measured sessions only', () => {
    const b = baselineSessions({ ...S1, personal_reference: [] }, 'sim:crew:fahim')
    expect(b.length).toBeGreaterThan(0)
    expect(b.map((s) => s.decode_session_id)).not.toContain('sim:decode_session:d23') // not comparable (hidden)
  })
})

describe('the round writes these reasons into its information_status (FR-DEC-07)', () => {
  let n = 0
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
  const base = {
    subjectId: 'sim:crew:fahim', seed: 42, plannedMs: 90_000, isPractice: false, state: 'completed' as const,
    interruptionReasons: [], interruptedAtMs: null, startedAt: new Date('2026-11-14T10:05:00.000Z'), elapsedMs: 90_000, uuid,
  }
  const reference = [1, 2, 3, 4, 5].map((d) => sess(`d${d}`, d, 'touch', null))

  it('steady round on the same input → valid, context recorded', () => {
    const b = buildRoundRecords({ ...base, raw: steady(), inputMethod: 'touch', deviceClass: 'tablet', baseline: reference })
    expect(b.info.status).toBe('valid')
    expect(b.info.method_consistent).toBe(true)
    expect(deviceClassOf(b.session)).toBe('tablet')
    expect(vSession(b.session), JSON.stringify(vSession.errors)).toBe(true)
    expect(vInfo(b.info), JSON.stringify(vInfo.errors)).toBe(true)
  })
  it('two pauses → not_comparable with reason pause; the score is unchanged', () => {
    const raw = steady({ 10: 5_000, 30: 6_000 })
    const plain = buildRoundRecords({ ...base, raw, inputMethod: 'touch', baseline: [] })
    expect(plain.info.status).toBe('not_comparable')
    expect(plain.info.reason_codes).toEqual(['pause'])
    expect(plain.info.reference_eligible).toBe(false)
    expect(plain.session.interruption_reasons).toEqual(['pause'])
    expect(plain.session.session_state).toBe('completed')
    expect(JSON.parse(plain.session.technical_context as string).pauses).toHaveLength(2)
    expect(vSession(plain.session), JSON.stringify(vSession.errors)).toBe(true)
    expect(vInfo(plain.info), JSON.stringify(vInfo.errors)).toBe(true)
  })
  it('keyboard round against a touch history → not_comparable, device_change, method_consistent false', () => {
    const b = buildRoundRecords({ ...base, raw: steady(), inputMethod: 'keyboard', deviceClass: 'laptop', baseline: reference })
    expect(b.info.status).toBe('not_comparable')
    expect(b.info.reason_codes).toEqual(['device_change'])
    expect(b.info.method_consistent).toBe(false)
    expect(vInfo(b.info), JSON.stringify(vInfo.errors)).toBe(true)
  })
  it('hidden-tab handling stays: an interrupted round keeps its reason, and both rules add theirs', () => {
    const b = buildRoundRecords({
      ...base, state: 'interrupted', interruptionReasons: ['interrupted_page_hidden'], interruptedAtMs: 40_000, elapsedMs: 40_000,
      raw: steady({ 10: 5_000, 20: 5_000 }, 40_000), inputMethod: 'keyboard', baseline: reference, hidden: [[40_000, 42_100]],
    })
    expect(b.info.status).toBe('not_comparable')
    expect(b.info.reason_codes).toEqual(['interrupted_page_hidden', 'pause', 'device_change'])
  })
  it('missing values stay null: no device class recorded is null, never a guess', () => {
    const b = buildRoundRecords({ ...base, raw: steady(), inputMethod: 'touch' })
    expect(JSON.parse(b.session.technical_context as string).device_class).toBeNull()
  })
})

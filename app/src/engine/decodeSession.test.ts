// FR-DEC-02, FR-DEC-05..07: key, sequence, event classification and record validity.
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'
import decodeSessionSchema from '../../../contracts/decode_session.schema.json'
import eventSchema from '../../../contracts/decode_response_event.schema.json'
import infoSchema from '../../../contracts/information_status.schema.json'
import {
  SYMBOL_IDS, buildRoundRecords, finaliseRound, makeDifferentKey, makeKey, makeSequence, sessionQuality, type RawResponse,
} from './decodeSession'

const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const vSession = ajv.compile(decodeSessionSchema)
const vEvent = ajv.compile(eventSchema)
const vInfo = ajv.compile(infoSchema)

describe('key and sequence (FR-DEC-02)', () => {
  it('key is a permutation of 1-9 over the nine fixed symbols', () => {
    const k = makeKey(42)
    expect(Object.keys(k)).toEqual([...SYMBOL_IDS])
    expect(Object.values(k).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
  it('is deterministic by seed and differs between seeds', () => {
    expect(makeKey(7)).toEqual(makeKey(7))
    expect(makeSequence(7, 50)).toEqual(makeSequence(7, 50))
    expect(makeKey(7)).not.toEqual(makeKey(8))
  })
  it('practice key differs from the measurement key', () => {
    const k = makeKey(5)
    expect(makeDifferentKey(5, k)).not.toEqual(k)
  })
  it('never shows the same symbol twice in a row', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const s = makeSequence(seed, 500)
      for (let i = 1; i < s.length; i++) expect(s[i]).not.toBe(s[i - 1])
    }
  })
})

const r = (trial: number, stim: number, resp: number | null, correct: number, digit: number | null): RawResponse => ({
  trial_index: trial, symbol_id: 'g1', correct_digit: correct, stimulus_ms: stim, response_ms: resp, response_digit: digit,
})

describe('event classification (D-9)', () => {
  it('correct, incorrect, duplicate, late, missed', () => {
    const raw = [r(1, 0, 800, 6, 6), r(2, 950, 1900, 3, 5), r(2, 950, 1990, 3, 3), r(3, 2100, null, 4, null), r(4, 89_500, 90_200, 2, 2)]
    const { score } = finaliseRound(raw, 90_000, 'completed')
    expect(score.response_states).toEqual(['correct', 'incorrect', 'duplicate', 'missed', 'late'])
    expect(score.accepted_responses).toBe(2)
    expect(score.correct_count).toBe(1)
    expect(score.accuracy_percent).toBe(50)
  })
  it('open trial in an interrupted round is interrupted, not missed or wrong', () => {
    const raw = [r(1, 0, 700, 6, 6), r(2, 850, null, 3, null)]
    const { score } = finaliseRound(raw, 90_000, 'interrupted', 5_000)
    expect(score.response_states).toEqual(['correct', 'interrupted'])
    expect(score.accepted_responses).toBe(1)
  })
  it('zero accepted gives null accuracy, not 0', () => {
    const { score } = finaliseRound([r(1, 0, null, 4, null)], 90_000, 'completed')
    expect(score.accuracy_percent).toBeNull()
    expect(score.median_correct_rt_ms).toBeNull()
  })
})

describe('session quality (FR-DEC-07)', () => {
  const ok = { response_states: [], accepted_responses: 40, correct_count: 39, accuracy_percent: 97.5, median_correct_rt_ms: 1100 }
  it('slow but steady stays valid', () => {
    expect(sessionQuality({ ...ok, median_correct_rt_ms: 2600 }, 'completed', []).status).toBe('valid')
  })
  it('random pressing is not comparable', () => {
    expect(sessionQuality({ ...ok, accuracy_percent: 40 }, 'completed', []).reason_codes).toContain('random_pressing')
    expect(sessionQuality({ ...ok, median_correct_rt_ms: 180 }, 'completed', []).status).toBe('not_comparable')
  })
  it('interrupted and aborted rounds', () => {
    expect(sessionQuality(ok, 'interrupted', ['interrupted_help'])).toEqual({ status: 'not_comparable', reason_codes: ['interrupted_help'] })
    expect(sessionQuality(ok, 'aborted', []).status).toBe('incomplete')
  })
  it('a reported interruption makes a completed round not comparable', () => {
    expect(sessionQuality(ok, 'completed', ['reported_interruption']).status).toBe('not_comparable')
  })
})

describe('records validate against the contract (FR-DEC-05)', () => {
  let n = 0
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
  const raw = [r(1, 0, 800, 6, 6), r(2, 950, 1900, 3, 5), r(3, 2050, null, 1, null)]
  for (const [state, practice] of [['completed', false], ['interrupted', false], ['completed', true]] as const) {
    it(`${state}${practice ? ' (demo length)' : ''}`, () => {
      const built = buildRoundRecords({
        subjectId: 'sim:crew:fahim', seed: 42, raw, plannedMs: practice ? 30_000 : 90_000, isPractice: practice, state,
        interruptionReasons: state === 'interrupted' ? ['interrupted_help'] : [], interruptedAtMs: state === 'interrupted' ? 2_500 : null,
        startedAt: new Date('2026-11-14T10:05:00.000Z'), elapsedMs: state === 'interrupted' ? 2_500.4 : 89_997,
        inputMethod: 'keyboard', uuid,
      })
      expect(vSession(built.session), JSON.stringify(vSession.errors)).toBe(true)
      for (const e of built.events) expect(vEvent(e), JSON.stringify(vEvent.errors)).toBe(true)
      expect(vInfo(built.info), JSON.stringify(vInfo.errors)).toBe(true)
      expect(built.session.played_live_into_simulation).toBe(true)
      expect(built.session.data_origin).toBe('live_decode')
      expect(built.events.every((e) => e.decode_session_id === built.session.decode_session_id)).toBe(true)
      const span = Date.parse(built.session.end_at_utc as string) - Date.parse(built.session.start_at_utc)
      expect(span).toBe(built.session.elapsed_monotonic_ms)
      if (state === 'completed') expect(built.session.elapsed_monotonic_ms).toBe(built.session.planned_duration_ms)
      if (built.session.accepted_responses) expect(built.session.accuracy_percent).toBe((100 * built.session.correct_count!) / built.session.accepted_responses)
      expect(built.info.reference_eligible).toBe(!practice && state === 'completed' && built.quality.status === 'valid')
    })
  }
})

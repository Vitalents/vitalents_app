// Decode session engine (task version decode-1.0, contract D-9). Pure: no React, no I/O.
// Builds the seeded key and trial sequence, finalises raw responses with scoreDecode,
// sets the information status, and builds contract records.
import type { DecodeResponseEvent, DecodeSession, InformationStatus } from '../data/contract'
import { scoreDecode, type DecodeScore, type ResponseState, type TrialEvent } from './decode'
import {
  deviceChange, encodeContext, findPauses, validityReasons, type DeviceClass, type Pause, type Span,
} from './decodeValidity'

export const TASK_VERSION = 'decode-1.0'
export const APP_VERSION = 'demo-0.1'
export const MEASURE_MS = 90_000
export const DEMO_MS = 30_000
export const PRACTICE_MS = 10_000
export const NEXT_ITEM_DELAY_MS = 150
export const HIDDEN_LIMIT_MS = 2_000
export const SYMBOL_IDS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9'] as const
export type SymbolId = (typeof SYMBOL_IDS)[number]
export type DecodeKey = Record<SymbolId, number>

/** mulberry32: small deterministic PRNG, enough for a reproducible key and sequence. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function newSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]
}

/** A random permutation of digits 1-9 assigned to the nine fixed symbols. */
export function makeKey(seed: number): DecodeKey {
  const r = rng(seed)
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[digits[i], digits[j]] = [digits[j], digits[i]]
  }
  return Object.fromEntries(SYMBOL_IDS.map((s, i) => [s, digits[i]])) as DecodeKey
}

/** A key guaranteed to differ from `other` in at least one symbol (used for practice). */
export function makeDifferentKey(seed: number, other: DecodeKey): DecodeKey {
  for (let s = seed; ; s++) {
    const k = makeKey(s)
    if (SYMBOL_IDS.some((id) => k[id] !== other[id])) return k
  }
}

/** The full trial sequence, generated before the round starts; never the same symbol twice in a row. */
export function makeSequence(seed: number, length = 400): SymbolId[] {
  const r = rng(seed ^ 0x9e3779b9)
  const out: SymbolId[] = []
  for (let i = 0; i < length; i++) {
    let s: SymbolId
    do s = SYMBOL_IDS[Math.floor(r() * SYMBOL_IDS.length)]
    while (i > 0 && s === out[i - 1])
    out.push(s)
  }
  return out
}

export const keyVersion = (seed: number) => `seed-${seed}`

/** One logged press, or the trial still open when the round ended (response null). */
export interface RawResponse {
  trial_index: number
  symbol_id: SymbolId
  correct_digit: number
  stimulus_ms: number
  response_ms: number | null
  response_digit: number | null
}

export type SessionState = DecodeSession['session_state']

export interface FinalisedRound {
  score: DecodeScore
  states: ResponseState[]
}

/** Classify every raw response with scoreDecode. In an interrupted round the trial left open is 'interrupted', not missed. */
export function finaliseRound(raw: RawResponse[], plannedMs: number, state: SessionState, interruptedAtMs: number | null = null): FinalisedRound {
  const events: TrialEvent[] = raw.map((r) => ({
    trial_index: r.trial_index,
    correct_digit: r.correct_digit,
    response_digit: r.response_digit,
    stimulus_monotonic_ms: r.stimulus_ms,
    response_monotonic_ms: r.response_ms,
  }))
  const base = scoreDecode({ planned_duration_ms: plannedMs, session_state: state, events, interrupted_at_ms: interruptedAtMs })
  const states = base.response_states.map((s, i) =>
    state === 'interrupted' && s === 'missed' && raw[i].response_ms === null ? ('interrupted' as const) : s,
  )
  return { score: { ...base, response_states: states }, states }
}

export interface Quality {
  status: 'valid' | 'not_comparable' | 'incomplete'
  reason_codes: string[]
}

/** Information status for a session (contract D-6, D-9). Slowness alone never invalidates. */
export function sessionQuality(score: DecodeScore, state: SessionState, interruptionReasons: string[]): Quality {
  if (state === 'aborted' || state === 'started') return { status: 'incomplete', reason_codes: ['aborted'] }
  const reasons: string[] = []
  if (state === 'interrupted') reasons.push(...(interruptionReasons.length ? interruptionReasons : ['interrupted_page_hidden']))
  else if (interruptionReasons.length) reasons.push(...interruptionReasons)
  const randomPressing =
    score.accepted_responses > 0 &&
    ((score.accuracy_percent !== null && score.accuracy_percent < 60) || (score.median_correct_rt_ms !== null && score.median_correct_rt_ms < 250))
  if (randomPressing) reasons.push('random_pressing')
  return reasons.length ? { status: 'not_comparable', reason_codes: [...new Set(reasons)] } : { status: 'valid', reason_codes: [] }
}

export interface BuildInput {
  subjectId: string // e.g. sim:crew:fahim
  seed: number
  raw: RawResponse[]
  plannedMs: number
  isPractice: boolean // true for demo-length rounds: never enters a reference
  state: SessionState
  interruptionReasons: string[]
  interruptedAtMs: number | null
  startedAt: Date // UTC moment the measurement window opened
  elapsedMs: number // monotonic ms from window open to the cut (ignored for completed rounds)
  inputMethod: 'keyboard' | 'touch' | 'other'
  focusStates?: ('foreground' | 'background')[]
  /** Device class of this round (SRS 7.3 device_change); null when it cannot be told. */
  deviceClass?: DeviceClass | null
  /** Spans (monotonic ms) with the page hidden; hidden time is never counted as a pause. */
  hidden?: Span[]
  /** The astronaut's reference sessions (baselineSessions); a different device class or input method → device_change. */
  baseline?: DecodeSession[]
  uuid?: () => string
}

export interface BuiltRecords {
  session: DecodeSession
  events: DecodeResponseEvent[]
  info: InformationStatus
  score: DecodeScore
  quality: Quality
  pauses: Pause[]
}

const realmOf = (id: string) => id.split(':', 1)[0]

/** Contract records for one round (decode_session + one decode_response_event per raw response + information_status). */
export function buildRoundRecords(i: BuildInput): BuiltRecords {
  const uuid = i.uuid ?? (() => crypto.randomUUID())
  const realm = realmOf(i.subjectId)
  const now = new Date().toISOString()
  const { score, states } = finaliseRound(i.raw, i.plannedMs, i.state, i.interruptedAtMs)
  // A completed round lasted exactly the planned window; other rounds the measured time to the cut.
  // end_at_utc is derived from start + elapsed so the two clocks always agree (status-0.3.0 checks this).
  const elapsed = i.state === 'completed' ? i.plannedMs : Math.max(0, Math.ceil(i.elapsedMs))
  // SRS 7.3: pauses and device change are added as reasons; they never end the round or change the score.
  const pauses = findPauses(i.raw, i.state === 'completed' ? i.plannedMs : (i.interruptedAtMs ?? elapsed), i.hidden ?? [])
  const deviceChanged = deviceChange({ device_class: i.deviceClass ?? null, input_method: i.inputMethod }, i.baseline ?? [])
  const extra = validityReasons({ pauses, deviceChanged })
  const interruptionReasons = [...new Set([...i.interruptionReasons, ...extra])]
  const quality = sessionQuality(score, i.state, interruptionReasons)
  const hiddenMs = (i.hidden ?? []).reduce((n, [f, t]) => n + Math.max(0, t - f), 0)
  const sessionId = `${realm}:decode_session:${uuid()}`
  const infoId = `${realm}:information_status:${uuid()}`
  const inSimulation = realm === 'sim'
  const endedAt = new Date(i.startedAt.getTime() + elapsed)
  const session: DecodeSession = {
    decode_session_id: sessionId,
    schema_version: '1.0',
    subject_id: i.subjectId,
    data_origin: 'live_decode',
    is_simulated: false,
    created_at_utc: now,
    protocol_version: TASK_VERSION,
    key_version: keyVersion(i.seed),
    start_at_utc: i.startedAt.toISOString(),
    end_at_utc: endedAt.toISOString(),
    planned_duration_ms: i.plannedMs,
    elapsed_monotonic_ms: elapsed,
    is_practice: i.isPractice,
    session_state: i.state,
    interruption_reasons: interruptionReasons,
    input_method: i.inputMethod,
    app_version: APP_VERSION,
    technical_context: encodeContext({ device_class: i.deviceClass ?? null, pauses, hidden_ms: Math.round(hiddenMs * 10) / 10 }),
    accepted_responses: score.accepted_responses,
    correct_count: score.correct_count,
    accuracy_percent: score.accuracy_percent,
    // averaging two 0.1 ms times leaves float noise (508.3500000000058); keep the engine's 3-decimal precision
    median_correct_rt_ms: score.median_correct_rt_ms == null ? null : Math.round(score.median_correct_rt_ms * 1000) / 1000,
    quality_record_id: infoId,
    ...(inSimulation ? { played_live_into_simulation: true } : {}),
  }
  const events: DecodeResponseEvent[] = i.raw.map((r, n) => ({
    decode_response_event_id: `${realm}:decode_response_event:${uuid()}`,
    schema_version: '1.0',
    subject_id: i.subjectId,
    data_origin: 'live_decode',
    is_simulated: false,
    created_at_utc: now,
    decode_session_id: sessionId,
    trial_index: r.trial_index,
    symbol_id: r.symbol_id,
    correct_digit: r.correct_digit,
    response_digit: r.response_digit,
    stimulus_monotonic_ms: Math.round(r.stimulus_ms * 10) / 10,
    response_monotonic_ms: r.response_ms === null ? null : Math.round(r.response_ms * 10) / 10,
    response_time_ms: r.response_ms === null ? null : Math.round((r.response_ms - r.stimulus_ms) * 10) / 10,
    response_state: states[n],
    is_accepted: states[n] === 'correct' || states[n] === 'incorrect',
    input_method: i.inputMethod,
    focus_state: i.focusStates?.[n] ?? 'foreground',
  }))
  const info: InformationStatus = {
    information_status_id: infoId,
    schema_version: '1.0',
    subject_id: i.subjectId,
    data_origin: 'application_generated',
    // the status record follows its realm, like the daily-check self_report (validator R4);
    // only the live_decode session and events carry is_simulated false (D-11)
    is_simulated: inSimulation,
    created_at_utc: now,
    record_ref: sessionId,
    status: quality.status,
    reason_codes: quality.reason_codes,
    source_known: true,
    unit_verified: true,
    measurement_time_known: true,
    method_consistent: !deviceChanged,
    reference_eligible: quality.status === 'valid' && !i.isPractice,
    ruleset_version: 'status-1.0',
  }
  return { session, events, info, score, quality, pauses }
}

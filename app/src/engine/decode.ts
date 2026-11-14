// Decode scoring (contract D-9). Pure function; must reproduce contracts/vectors/score_decode.
import { median } from './reference'

export interface TrialEvent {
  trial_index: number
  correct_digit: number
  response_digit: number | null
  stimulus_monotonic_ms: number
  response_monotonic_ms: number | null
}

export type ResponseState = 'correct' | 'incorrect' | 'missed' | 'late' | 'duplicate' | 'interrupted'

export interface DecodeScore {
  response_states: ResponseState[]
  accepted_responses: number
  correct_count: number
  accuracy_percent: number | null
  median_correct_rt_ms: number | null
}

export function scoreDecode(input: {
  planned_duration_ms: number
  session_state: string
  events: TrialEvent[]
  interrupted_at_ms?: number | null
}): DecodeScore {
  const { planned_duration_ms, events } = input
  const cut = input.interrupted_at_ms ?? null
  const answered = new Set<number>()
  const rts: number[] = []
  const states: ResponseState[] = events.map((e) => {
    if (cut !== null && (e.response_monotonic_ms ?? e.stimulus_monotonic_ms) >= cut) return 'interrupted'
    if (e.response_monotonic_ms === null || e.response_digit === null) return 'missed'
    if (e.response_monotonic_ms > planned_duration_ms) return 'late'
    if (answered.has(e.trial_index)) return 'duplicate'
    answered.add(e.trial_index)
    if (e.response_digit === e.correct_digit) {
      rts.push(e.response_monotonic_ms - e.stimulus_monotonic_ms)
      return 'correct'
    }
    return 'incorrect'
  })
  const accepted = states.filter((s) => s === 'correct' || s === 'incorrect').length
  const correct = states.filter((s) => s === 'correct').length
  return {
    response_states: states,
    accepted_responses: accepted,
    correct_count: correct,
    accuracy_percent: accepted ? Math.round((1000 * correct) / accepted) / 10 : null,
    median_correct_rt_ms: rts.length ? median(rts) : null,
  }
}

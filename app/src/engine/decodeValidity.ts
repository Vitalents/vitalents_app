// Decode validity rules that need more than the score (SRS 7.3, FR-DEC-07). Pure: no React, no DOM, no I/O.
//  - pause: two or more pauses of 5 s or more without a response while the page was visible
//  - device_change: device class or input method differs from the astronaut's reference sessions
// Hidden-page handling (> 2 s hidden ends the round) stays in useRound / sessionQuality.
import type { DecodeSession, InformationStatus, PersonalReference } from '../data/contract'
import type { RawResponse } from './decodeSession'

export const PAUSE_MIN_MS = 5_000 // SRS 7.3, illustrative documented threshold
export const PAUSE_LIMIT = 2 // two or more pauses → not comparable

export type DeviceClass = 'laptop' | 'tablet' | 'phone'
export type InputMethod = 'keyboard' | 'touch' | 'other'
/** A [from, to) span in monotonic ms from the window opening, during which the page was hidden. */
export type Span = [number, number]

export interface Pause {
  trial_index: number
  at_ms: number // when the wait started (stimulus shown)
  duration_ms: number // visible time with no response
}

const overlap = (a: number, b: number, spans: Span[]) =>
  spans.reduce((sum, [f, t]) => sum + Math.max(0, Math.min(b, t) - Math.max(a, f)), 0)

/**
 * Pauses: for every trial, the visible time from the symbol appearing to its first response
 * (or to the end of the window when no response came). Time while the page was hidden is not a pause.
 * Responses at or after the window end (late) do not extend a pause past the window.
 */
export function findPauses(raw: RawResponse[], windowEndMs: number, hidden: Span[] = []): Pause[] {
  const firstByTrial = new Map<number, RawResponse>()
  for (const r of raw) {
    const prev = firstByTrial.get(r.trial_index)
    if (!prev || (prev.response_ms === null && r.response_ms !== null)) firstByTrial.set(r.trial_index, r)
  }
  const out: Pause[] = []
  for (const r of [...firstByTrial.values()].sort((x, y) => x.trial_index - y.trial_index)) {
    if (r.stimulus_ms >= windowEndMs) continue
    const end = Math.min(r.response_ms ?? windowEndMs, windowEndMs)
    const visible = end - r.stimulus_ms - overlap(r.stimulus_ms, end, hidden)
    if (visible >= PAUSE_MIN_MS) out.push({ trial_index: r.trial_index, at_ms: r.stimulus_ms, duration_ms: Math.round(visible * 10) / 10 })
  }
  return out
}

export const tooManyPauses = (pauses: Pause[]) => pauses.length >= PAUSE_LIMIT

/** Device class from what the browser reports. Pure so it can be tested; the UI passes the values in. */
export function deviceClassFrom(i: { coarsePointer: boolean; shortSidePx: number }): DeviceClass {
  if (!i.coarsePointer) return 'laptop'
  return i.shortSidePx < 600 ? 'phone' : 'tablet'
}

/** technical_context is a free string in the contract; we store compact JSON so it can be read back. */
export interface TechnicalContext {
  device_class: DeviceClass | null
  pauses?: Pause[]
  hidden_ms?: number
}
export function encodeContext(c: TechnicalContext): string {
  return JSON.stringify(c)
}
export function deviceClassOf(s: Pick<DecodeSession, 'technical_context'>): DeviceClass | null {
  if (!s.technical_context) return null
  try {
    const v = (JSON.parse(s.technical_context) as TechnicalContext).device_class
    return v === 'laptop' || v === 'tablet' || v === 'phone' ? v : null
  } catch {
    return null
  }
}

export interface DeviceSignature {
  device_class: DeviceClass | null // null = not recorded (e.g. simulated history)
  input_method: string
}
export const signatureOf = (s: Pick<DecodeSession, 'technical_context' | 'input_method'>): DeviceSignature => ({
  device_class: deviceClassOf(s),
  input_method: s.input_method,
})

/**
 * The sessions a new round is compared with: the sessions behind the newest Decode reference;
 * if there is none yet, the subject's earlier valid measured sessions. Practice and demo rounds never count.
 */
export function baselineSessions(
  d: { decode_session: DecodeSession[]; personal_reference: PersonalReference[]; information_status: Pick<InformationStatus, 'record_ref' | 'status' | 'created_at_utc'>[] },
  subjectId: string,
  asOf?: string,
): DecodeSession[] {
  const mine = d.decode_session.filter((s) => s.subject_id === subjectId && !s.is_practice && (!asOf || (s.end_at_utc !== null && Date.parse(s.end_at_utc) < Date.parse(asOf))))
  const ref = d.personal_reference
    .filter((p) => p.subject_id === subjectId && p.metric_code === 'decode_correct_count' && (p.source_record_ids?.length ?? 0) > 0
      && (!asOf || (Date.parse(p.created_at_utc) <= Date.parse(asOf) && p.end_date < asOf.slice(0, 10))))
    .sort((a, b) => a.created_at_utc.localeCompare(b.created_at_utc))
    .pop()
  if (ref) {
    const ids = new Set(ref.source_record_ids)
    const used = mine.filter((s) => ids.has(s.decode_session_id))
    if (used.length) return used
  }
  const latest = new Map<string, { status: string; at: string }>()
  for (const x of d.information_status) {
    const p = latest.get(x.record_ref)
    if (!p || x.created_at_utc >= p.at) latest.set(x.record_ref, { status: x.status, at: x.created_at_utc })
  }
  return mine.filter((s) => latest.get(s.decode_session_id)?.status === 'valid')
}

/**
 * device_change when the round's device class or input method differs from the baseline's usual one
 * (most frequent; ties go to the most recent session). A field not recorded on either side is not compared.
 * No baseline → no comparison, so the first rounds can never be a "change".
 */
export function deviceChange(current: DeviceSignature, baseline: DecodeSession[]): boolean {
  if (!baseline.length) return false
  const sorted = [...baseline].sort((a, b) => a.start_at_utc.localeCompare(b.start_at_utc))
  const usual = <T,>(vals: T[]): T | null => {
    const n = new Map<T, number>()
    let best: T | null = null
    for (const v of vals) {
      if (v === null) continue
      n.set(v, (n.get(v) ?? 0) + 1)
      if (best === null || (n.get(v) as number) >= (n.get(best) as number)) best = v
    }
    return best
  }
  const sigs = sorted.map(signatureOf)
  const method = usual(sigs.map((s) => s.input_method))
  const cls = usual(sigs.map((s) => s.device_class))
  if (method !== null && current.input_method !== method) return true
  if (cls !== null && current.device_class !== null && current.device_class !== cls) return true
  return false
}

/** Reason codes added by these two rules (contract reason code device_change; SRS 7.3 code pause). */
export function validityReasons(i: { pauses: Pause[]; deviceChanged: boolean }): string[] {
  const out: string[] = []
  if (tooManyPauses(i.pauses)) out.push('pause')
  if (i.deviceChanged) out.push('device_change')
  return out
}

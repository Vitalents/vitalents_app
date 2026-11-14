// Consult-summary client (FR-AS-09). Live mode asks ai/ask_nasa.py POST /consult to word the share summary into
// five fixed sections. The app never depends on it: the caller builds the same sections from the record when
// this returns anything but a checked live draft. Only labelled values are sent; never ids or private notes.
import type { Summary, SummaryItem } from '../features/sharing/summary'
import { assistantMode, assistantUrl, type AskMode } from './client'

/** One labelled value, as ConsultItem in ai/ask_nasa.py (extra fields are rejected there). */
export interface ConsultItem {
  label: string
  date: string | null
  data_status: string | null
  reasons: string[]
  limits: string | null
}

/** The structured share summary sent to /consult (ConsultSummary in ai/ask_nasa.py). */
export interface ConsultInput {
  events: ConsultItem[]
  measurements: ConsultItem[]
  symptoms: ConsultItem[]
  actions: ConsultItem[]
  question: string | null
}

export const CONSULT_KEYS = ['trend', 'context', 'what_was_tried', 'crew_question', 'requested_decision'] as const
export type ConsultKey = (typeof CONSULT_KEYS)[number]
export type ConsultSections = Record<ConsultKey, string>

/** Shape returned by POST /consult. */
export interface ConsultResponse {
  status: 'drafted' | 'blocked'
  consult_id: string
  sections: ConsultSections | null
  note: string | null
  unsupported_numbers: string[]
  reason?: string | null
  limits: string
  model: string
}

export type ConsultResult =
  /** A live draft that passed the server's checks and the client's own number check. */
  | { source: 'live'; sections: ConsultSections; model: string }
  /** The service answered but the draft was blocked (by the server or by the client re-check). */
  | { source: 'blocked'; unsupported: string[]; reason: string; model?: string }
  /** Live mode, but the service is down, timed out or answered with an error. */
  | { source: 'unavailable'; error: string }
  /** Cached (public) mode: the assistant is never called. */
  | { source: 'not_live' }

const LIVE_TIMEOUT_MS = 90_000

const item = (i: SummaryItem): ConsultItem => ({
  label: i.text,
  date: i.date || null,
  data_status: i.dataStatus ?? null,
  reasons: i.reasons ?? [],
  limits: i.limits ?? null,
})

/** The share summary as labelled values only. Built from the preview, so it holds exactly what the astronaut sees. */
export function toConsultInput(summary: Summary): ConsultInput {
  const items = (key: string) => summary.sections.find((s) => s.key === key)?.items ?? []
  const q = items('question')[0]?.text.trim()
  return {
    events: items('events').map(item),
    measurements: items('measurements').map(item),
    symptoms: items('symptoms').map(item),
    actions: items('actions').map(item),
    question: q ? q : null,
  }
}

// ---------------------------------------------------------------- number check (mirrors ask_nasa.unsupported_numbers)
const NUM = /\d+(?:\.\d+)?/g

/** Every number that appears anywhere in the input, compared as values (5.20 equals 5.2). */
export function allowedNumbers(input: ConsultInput): Set<number> {
  return new Set((JSON.stringify(input).match(NUM) ?? []).map(Number))
}

export interface NumberSpan {
  start: number
  end: number
  value: string
}

/** Numbers in `text` that are not in the input, with their positions (for highlighting). */
export function unsupportedSpans(text: string, allowed: Set<number>): NumberSpan[] {
  const out: NumberSpan[] = []
  for (const m of text.matchAll(NUM)) {
    const start = m.index ?? 0
    if (!allowed.has(Number(m[0]))) out.push({ start, end: start + m[0].length, value: m[0] })
  }
  return out
}

export const unsupportedNumbers = (text: string, allowed: Set<number>) => [...new Set(unsupportedSpans(text, allowed).map((s) => s.value))]

// ---------------------------------------------------------------- request
const isSections = (s: unknown): s is ConsultSections =>
  !!s && typeof s === 'object' && CONSULT_KEYS.every((k) => typeof (s as Record<string, unknown>)[k] === 'string')

export async function requestConsult(
  input: ConsultInput,
  opts: { mode?: AskMode; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<ConsultResult> {
  const mode = opts.mode ?? assistantMode()
  if (mode !== 'live') return { source: 'not_live' }
  const fetchImpl = opts.fetchImpl ?? fetch
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? LIVE_TIMEOUT_MS)
  try {
    const res = await fetchImpl(`${assistantUrl()}/consult`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: input }),
      signal: ctrl.signal,
    })
    if (!res.ok) return { source: 'unavailable', error: `HTTP ${res.status}` }
    const r = (await res.json()) as ConsultResponse
    if (r.status !== 'drafted' || !isSections(r.sections)) {
      return { source: 'blocked', unsupported: r.unsupported_numbers ?? [], reason: r.reason ?? 'blocked', model: r.model }
    }
    // Defence in depth: check the model's sections again here. The crew question is replaced by the caller.
    const allowed = allowedNumbers(input)
    const written = CONSULT_KEYS.filter((k) => k !== 'crew_question').map((k) => r.sections![k]).join(' ')
    const bad = unsupportedNumbers(written, allowed)
    if (bad.length) return { source: 'blocked', unsupported: bad, reason: 'unsupported numbers (client check)', model: r.model }
    return { source: 'live', sections: r.sections, model: r.model }
  } catch (err) {
    return { source: 'unavailable', error: String(err) }
  } finally {
    clearTimeout(timer)
  }
}

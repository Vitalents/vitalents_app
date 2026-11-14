// Ask NASA client (FR-AS-02, FR-AS-06, FR-AS-07). Live mode calls the local service on the demo laptop;
// cached mode (the public site) reads answers recorded from that service. Never invents an answer.
import type { DomainId } from '../content/content'
import type { Data } from '../store/store'

export interface Citation {
  id: string
  source_id: string | null
  title: string | null
  url: string | null
  page: number | string | null
  excerpt: string
}

/** Shape returned by ai/ask_nasa.py POST /ask. */
export interface AskResponse {
  status: 'answered' | 'not_in_library' | 'blocked'
  question_id: string
  your_data: string | null
  science: string | null
  citations: Citation[]
  limits: string
  model: string
  reason?: string
}

export interface CachedEntry {
  question: string
  response: AskResponse
  label: string
}

export type AskSource = 'live' | 'cached' | 'unavailable'

export interface AskResult {
  source: AskSource
  response: AskResponse | null
  /** Cached mode only: the label stored with the recorded answer. */
  label?: string
  /** Cached mode only: the recorded question that was matched, if not identical. */
  matchedQuestion?: string
  error?: string
}

export type AskMode = 'live' | 'cached' | 'auto'

/**
 * live: always the onboard model at VITE_ASSISTANT_URL · cached: recorded answers only ·
 * auto: the onboard model when it answers /health (for example the team laptop through the tunnel),
 * otherwise recorded answers, so the site keeps working when the laptop is off.
 */
export const assistantMode = (): AskMode => {
  const m = import.meta.env.VITE_ASSISTANT_MODE
  return m === 'live' || m === 'auto' ? m : 'cached'
}
/** Public tunnel to the team laptop (scripts/mac/start_assistant.sh). */
export const PUBLIC_ASSISTANT_URL = 'https://ask.vitalents.life'
export const assistantUrl = (): string =>
  (import.meta.env.VITE_ASSISTANT_URL as string | undefined) ||
  (assistantMode() === 'auto' ? PUBLIC_ASSISTANT_URL : 'http://localhost:8008')

const LIVE_TIMEOUT_MS = 60_000
const HEALTH_TIMEOUT_MS = 4_000
const HEALTH_TTL_MS = 30_000
let lastHealth: { at: number; ok: boolean } | null = null

/** Resolves auto mode by asking /health (cached for 30 s). live and cached pass through. */
export async function resolveMode(mode: AskMode = assistantMode(), fetchImpl: typeof fetch = fetch): Promise<'live' | 'cached'> {
  if (mode !== 'auto') return mode
  const now = Date.now()
  if (lastHealth && now - lastHealth.at < HEALTH_TTL_MS) return lastHealth.ok ? 'live' : 'cached'
  const h = await health(fetchImpl, HEALTH_TIMEOUT_MS)
  lastHealth = { at: now, ok: h.ok === true }
  return lastHealth.ok ? 'live' : 'cached'
}

/** Test helper: forget the last health check. */
export function resetHealthCache(): void {
  lastHealth = null
}

export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'is', 'on', 'in', 'my', 'do', 'does', 'what', 'why', 'how', 'we', 'i', 'for', 'and', 'it', 'be'])
const tokens = (q: string) => new Set(normalizeQuestion(q).split(' ').filter((w) => w && !STOP.has(w)))

/** Exact match on the normalized question, otherwise the closest recorded question by word overlap (Jaccard >= 0.5). */
export function matchCached(question: string, entries: CachedEntry[]): CachedEntry | null {
  const n = normalizeQuestion(question)
  const exact = entries.find((e) => normalizeQuestion(e.question) === n)
  if (exact) return exact
  const t = tokens(question)
  if (!t.size) return null
  let best: CachedEntry | null = null
  let bestScore = 0
  for (const e of entries) {
    const u = tokens(e.question)
    const inter = [...t].filter((w) => u.has(w)).length
    const score = inter / (t.size + u.size - inter || 1)
    if (score > bestScore) {
      bestScore = score
      best = e
    }
  }
  return bestScore >= 0.5 ? best : null
}

let cachedEntries: Promise<CachedEntry[]> | null = null
export function loadCached(fetchImpl: typeof fetch = fetch): Promise<CachedEntry[]> {
  if (!cachedEntries) {
    cachedEntries = fetchImpl('/data/cached_answers.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((j: unknown) => (Array.isArray(j) ? (j as CachedEntry[]).filter((e) => e && typeof e.question === 'string' && e.response) : []))
      .catch(() => [] as CachedEntry[])
  }
  return cachedEntries
}
export const resetCachedForTests = () => {
  cachedEntries = null
}

export async function ask(
  question: string,
  context: Record<string, unknown>,
  opts: { mode?: AskMode; fetchImpl?: typeof fetch } = {},
): Promise<AskResult> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const mode = await resolveMode(opts.mode ?? assistantMode(), fetchImpl)
  if (mode === 'cached') {
    const entry = matchCached(question, await loadCached(fetchImpl))
    if (!entry) return { source: 'cached', response: null }
    return {
      source: 'cached',
      response: entry.response,
      label: entry.label,
      matchedQuestion: normalizeQuestion(entry.question) === normalizeQuestion(question) ? undefined : entry.question,
    }
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), LIVE_TIMEOUT_MS)
  try {
    const res = await fetchImpl(`${assistantUrl()}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context }),
      signal: ctrl.signal,
    })
    if (!res.ok) return { source: 'unavailable', response: null, error: `HTTP ${res.status}` }
    return { source: 'live', response: (await res.json()) as AskResponse }
  } catch (err) {
    return { source: 'unavailable', response: null, error: String(err) }
  } finally {
    clearTimeout(timer)
  }
}

export async function health(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = HEALTH_TIMEOUT_MS,
): Promise<{ ok: boolean; model?: string; library_sources?: number }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(`${assistantUrl()}/health`, { signal: ctrl.signal })
    return res.ok ? await res.json() : { ok: false }
  } catch {
    return { ok: false }
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------- context
const ANCHOR = { date: '2026-11-14', day: 27 } // S1 fictional calendar (contract D-2)
export const missionDay = (date: string) => ANCHOR.day + Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${ANCHOR.date}T00:00:00Z`)) / 86_400_000)

type Row = Record<string, unknown>
function latestOnOrBefore<T extends Row>(rows: T[], dateOf: (r: T) => string, date: string): T | undefined {
  const sorted = rows.filter((r) => dateOf(r) <= date).sort((a, b) => dateOf(a).localeCompare(dateOf(b)))
  return sorted[sorted.length - 1]
}

/**
 * Builds the `context` sent to /ask: values only, for the current review day. Private notes and
 * free-text fields are never included (CLAUDE.md rule 9). Keys match ai/ask_nasa.py CONTEXT_LABELS.
 */
export function buildContext(data: Data, domainId?: DomainId): Record<string, unknown> {
  const review = [...data.daily_review].sort((a, b) => a.review_date.localeCompare(b.review_date)).pop()
  const date = review?.review_date ?? ANCHOR.date
  const ctx: Record<string, unknown> = { crew_id: 'sim:crew:fahim', mission_day: missionDay(date) }
  const want = (d: DomainId) => !domainId || domainId === d

  if (want('sleep')) {
    const s = latestOnOrBefore(data.sleep_record as unknown as Row[], (r) => String(r.observation_date), date)
    const ms = s?.recorded_interval_ms
    if (s && s.observation_date === date && typeof ms === 'number') ctx.recorded_sleep_h = Math.round((ms / 3_600_000) * 10) / 10
  }
  if (want('heart')) {
    const m = latestOnOrBefore(
      (data.measurement as unknown as Row[]).filter((r) => String(r.metric_code).startsWith('hr_resting')),
      (r) => String(r.observation_date),
      date,
    )
    if (m && m.observation_date === date && typeof m.value === 'number') {
      ctx.hr_resting_bpm = m.value
      const st = data.information_status.filter((i) => i.record_ref === m.measurement_id).pop()
      if (st) ctx.data_status = st.status
    }
  }
  if (want('cognition')) {
    const a = latestOnOrBefore(
      (data.self_report as unknown as Row[]).filter((r) => r.report_kind === 'daily_check_alertness'),
      (r) => String(r.report_date),
      date,
    )
    if (a && a.report_date === date && typeof a.alertness_rating === 'number') ctx.alertness_rating = a.alertness_rating
    const dec = latestOnOrBefore(
      (data.decode_session as unknown as Row[]).filter((r) => r.is_practice !== true),
      (r) => String(r.start_at_utc).slice(0, 10),
      date,
    )
    // Today's round only: an older score must never be shown as today's (no reading today -> omitted).
    if (dec && String(dec.start_at_utc).slice(0, 10) === date && typeof dec.correct_count === 'number') ctx.decode_correct_count = dec.correct_count
    const ref = [...data.personal_reference].filter((p) => p.metric_code === 'decode_correct_count').pop()
    if (ref && typeof ref.reference_value === 'number') ctx.reference_value = ref.reference_value
  }
  const open = data.follow_up.filter((f) => f.followup_status !== 'closed' && f.followup_status !== 'no_open_follow_up')
  if (!domainId && open.length) ctx.followup_status = open.map((f) => f.followup_status).join(', ')
  return ctx
}

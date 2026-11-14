// FR-AS-02 / FR-AS-06 / FR-AS-07: cached matching, live calls, and the context never carrying private notes.
import { beforeEach, describe, expect, it } from 'vitest'
import { ENTITY_NAMES, type SelfReport } from '../data/contract'
import type { Data } from '../store/store'
import fixture from '../../public/data/fixtures/S1.json'
import cachedFile from '../../public/data/cached_answers.json'
import { ask, buildContext, matchCached, normalizeQuestion, resetCachedForTests, type AskResponse, type CachedEntry } from './client'

const resp = (over: Partial<AskResponse> = {}): AskResponse => ({
  status: 'answered',
  question_id: 'q1',
  your_data: 'Your recorded sleep last night: 6.1 h.',
  science: 'Sleep is tracked because the light cycle changes in orbit [1].',
  citations: [{ id: '1', source_id: 'lib:source:x', title: 'Test source', url: null, page: 3, excerpt: 'excerpt' }],
  limits: 'Library text only.',
  model: 'test-model',
  ...over,
})
const entries: CachedEntry[] = [
  { question: 'Why do we measure sleep on a long mission?', response: resp(), label: 'Recorded from the onboard model' },
  { question: 'How does light affect the sleep cycle in space?', response: resp({ question_id: 'q2' }), label: 'Recorded from the onboard model' },
]
const jsonFetch = (body: unknown, ok = true) =>
  (async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as unknown as typeof fetch

const loadData = (): Data => {
  const d = Object.fromEntries(ENTITY_NAMES.map((e) => [e, []])) as unknown as Data
  for (const [k, v] of Object.entries(fixture)) if (Array.isArray(v)) (d as Record<string, unknown[]>)[k] = structuredClone(v)
  return d
}

beforeEach(() => resetCachedForTests())

describe('matchCached', () => {
  it('matches exactly, ignoring case and punctuation', () => {
    expect(normalizeQuestion('  Why DO we measure sleep?? ')).toBe('why do we measure sleep')
    expect(matchCached('why do we measure sleep on a long mission', entries)?.response.question_id).toBe('q1')
  })
  it('matches the closest recorded question', () => {
    expect(matchCached('How does light change the sleep cycle in space', entries)?.response.question_id).toBe('q2')
  })
  it('returns null rather than a guess when nothing is close', () => {
    expect(matchCached('What is the radiation dose on the ISS?', entries)).toBeNull()
    expect(matchCached('', entries)).toBeNull()
  })
})

describe('ask', () => {
  it('cached mode answers from the recorded file with its label', async () => {
    const r = await ask('Why do we measure sleep on a long mission?', {}, { mode: 'cached', fetchImpl: jsonFetch(entries) })
    expect(r.source).toBe('cached')
    expect(r.label).toBe('Recorded from the onboard model')
    expect(r.response?.citations).toHaveLength(1)
    expect(r.matchedQuestion).toBeUndefined()
  })
  it('cached mode with no match returns no response', async () => {
    const r = await ask('Something unrelated about pumps', {}, { mode: 'cached', fetchImpl: jsonFetch(entries) })
    expect(r).toEqual({ source: 'cached', response: null })
  })
  it('live mode returns the server answer', async () => {
    let sent: unknown = null
    const f = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body))
      return { ok: true, status: 200, json: async () => resp() }
    }) as unknown as typeof fetch
    const r = await ask('Why sleep?', { crew_id: 'sim:crew:fahim' }, { mode: 'live', fetchImpl: f })
    expect(r.source).toBe('live')
    expect(r.response?.model).toBe('test-model')
    expect(sent).toEqual({ question: 'Why sleep?', context: { crew_id: 'sim:crew:fahim' } })
  })
  it('live mode reports unavailable when the assistant is unreachable (FR-AS-06)', async () => {
    const down = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    expect((await ask('q', {}, { mode: 'live', fetchImpl: down })).source).toBe('unavailable')
    expect((await ask('q', {}, { mode: 'live', fetchImpl: jsonFetch({}, false) })).source).toBe('unavailable')
  })
})

describe('cached_answers.json', () => {
  it('keeps recorded answers cited and abstentions free of science and citations', () => {
    const list = cachedFile as CachedEntry[]
    expect(list).toHaveLength(5)
    for (const { question, response, label } of list) {
      expect(question).not.toBe('')
      expect(label).toBe('Recorded from the onboard model')
      expect(response.limits).not.toBe('')
      expect(['answered', 'not_in_library', 'blocked']).toContain(response.status)
      if (response.status === 'answered') {
        expect(response.science).toEqual(expect.any(String))
        expect(response.citations.length).toBeGreaterThan(0)
        for (const { id, source_id, excerpt } of response.citations) {
          expect(response.science).toContain(`[${id}]`)
          expect(source_id).toMatch(/^lib:/)
          expect(excerpt).not.toBe('')
        }
      } else {
        expect(response.science).toBeNull()
        expect(response.citations).toEqual([])
      }
    }
  })
})

describe('buildContext', () => {
  const NOTE = 'PRIVATE-NOTE-do-not-share-7731'
  const withNote = (): Data => {
    const d = loadData()
    const base = d.self_report[d.self_report.length - 1] as SelfReport
    d.self_report.push({ ...base, self_report_id: 'sim:self_report:private-test', private_note: NOTE, symptom_text: NOTE })
    return d
  }
  it('never includes private notes or free text, for any domain', () => {
    for (const domain of [undefined, 'cognition', 'sleep', 'heart', 'symptoms'] as const) {
      const ctx = buildContext(withNote(), domain)
      const flat = JSON.stringify(ctx)
      expect(flat).not.toContain(NOTE)
      expect(Object.keys(ctx)).not.toContain('private_note')
      expect(Object.keys(ctx)).not.toContain('symptom_text')
    }
  })
  it('identifies Fahim and uses null, never 0, for missing values', () => {
    const ctx = buildContext(loadData(), 'cognition')
    expect(ctx.crew_id).toBe('sim:crew:fahim')
    for (const v of Object.values(ctx)) expect(v).not.toBeUndefined()
    const empty = buildContext(Object.fromEntries(ENTITY_NAMES.map((e) => [e, []])) as unknown as Data, 'sleep')
    expect(Object.values(empty).filter((v) => v === 0)).toEqual([])
  })
})

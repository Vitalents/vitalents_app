// FR-AS-09: the consult client sends labelled values only, never calls the service in cached mode,
// and re-checks every number the model wrote against the input.
import { describe, expect, it } from 'vitest'
import { FAHIM, SECRET, loadS1WithPrivate } from '../sync/testkit'
import { buildSummary } from '../features/sharing/summary'
import { allowedNumbers, requestConsult, toConsultInput, unsupportedNumbers, unsupportedSpans, type ConsultResponse } from './consult'

const summary = buildSummary(loadS1WithPrivate(), FAHIM, 'Should I change my exercise plan?')
const input = toConsultInput(summary)

const sections = {
  trend: 'Decode correct answers were below your personal range (37 vs 41-44).',
  context: 'Lower back pain after exercise, mild, was reported.',
  what_was_tried: 'A review by the medical team was requested.',
  crew_question: 'Should I change my exercise plan?',
  requested_decision: 'Keep the current plan, change it, or request a new measurement.',
}
const drafted = (over: Partial<ConsultResponse> = {}): ConsultResponse => ({
  status: 'drafted',
  consult_id: 'c1',
  sections,
  note: null,
  unsupported_numbers: [],
  reason: null,
  limits: 'Draft.',
  model: 'test-model',
  ...over,
})

type Call = { url: string; init: RequestInit }
function mockFetch(body: unknown, opts: { ok?: boolean; status?: number; reject?: boolean } = {}) {
  const calls: Call[] = []
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    if (opts.reject) throw new TypeError('Failed to fetch')
    return { ok: opts.ok ?? true, status: opts.status ?? 200, json: async () => body }
  }) as unknown as typeof fetch
  return { impl, calls }
}

describe('toConsultInput', () => {
  it('holds labelled values from the preview only: no ids, no private note', () => {
    const json = JSON.stringify(input)
    expect(json).not.toContain(SECRET)
    expect(json).not.toContain('sim:')
    expect(json).not.toContain('private')
    expect(Object.keys(input)).toEqual(['events', 'measurements', 'symptoms', 'actions', 'question'])
    expect(Object.keys(input.measurements[0]).sort()).toEqual(['data_status', 'date', 'label', 'limits', 'reasons'])
    expect(input.question).toBe('Should I change my exercise plan?')
  })
  it('sends null, not an empty string, when there is no question', () => {
    expect(toConsultInput(buildSummary(loadS1WithPrivate(), FAHIM, '   ')).question).toBeNull()
  })
})

describe('number check', () => {
  const allowed = allowedNumbers(input)
  it('accepts numbers from the input, compared as values', () => {
    expect(unsupportedNumbers('37 vs 41-44 on 2026-11-14', allowed)).toEqual([])
    expect(unsupportedNumbers('37.0', allowed)).toEqual([])
  })
  it('reports numbers that are not in the input, with positions', () => {
    expect(unsupportedNumbers('Sleep was 9.5 h on 9.5 nights and 123 days', allowed)).toEqual(['9.5', '123'])
    const [s] = unsupportedSpans('about 9.5 h', allowed)
    expect(s).toEqual({ start: 6, end: 9, value: '9.5' })
  })
})

describe('requestConsult', () => {
  it('cached (public) mode never calls the service', async () => {
    const f = mockFetch(drafted())
    expect(await requestConsult(input, { mode: 'cached', fetchImpl: f.impl })).toEqual({ source: 'not_live' })
    expect(f.calls).toHaveLength(0)
  })

  it('live mode posts the summary to /consult and returns the checked sections', async () => {
    const f = mockFetch(drafted())
    const r = await requestConsult(input, { mode: 'live', fetchImpl: f.impl })
    expect(r).toEqual({ source: 'live', sections, model: 'test-model' })
    expect(f.calls[0].url).toMatch(/\/consult$/)
    expect(f.calls[0].init.method).toBe('POST')
    const body = JSON.parse(String(f.calls[0].init.body))
    expect(body).toEqual({ summary: input })
    expect(String(f.calls[0].init.body)).not.toContain(SECRET)
  })

  it('a draft the server blocked is reported as blocked', async () => {
    const f = mockFetch(drafted({ status: 'blocked', sections: null, unsupported_numbers: ['9.5'], reason: 'unsupported numbers' }))
    const r = await requestConsult(input, { mode: 'live', fetchImpl: f.impl })
    expect(r).toMatchObject({ source: 'blocked', unsupported: ['9.5'] })
  })

  it('re-checks the numbers itself, even when the server says drafted', async () => {
    const f = mockFetch(drafted({ sections: { ...sections, trend: 'Sleep was 4.5 h over 99 nights.' } }))
    const r = await requestConsult(input, { mode: 'live', fetchImpl: f.impl })
    expect(r).toMatchObject({ source: 'blocked', unsupported: ['4.5', '99'] })
  })

  it('a malformed draft (missing section) is blocked', async () => {
    const { what_was_tried: _drop, ...partial } = sections
    void _drop
    const f = mockFetch(drafted({ sections: partial as typeof sections }))
    expect((await requestConsult(input, { mode: 'live', fetchImpl: f.impl })).source).toBe('blocked')
  })

  it('service down or HTTP error means unavailable, never an invented draft', async () => {
    expect((await requestConsult(input, { mode: 'live', fetchImpl: mockFetch(null, { reject: true }).impl })).source).toBe('unavailable')
    expect(await requestConsult(input, { mode: 'live', fetchImpl: mockFetch(null, { ok: false, status: 503 }).impl })).toEqual({
      source: 'unavailable',
      error: 'HTTP 503',
    })
  })

  it('times out to unavailable', async () => {
    const hang = ((_u: string, init: RequestInit) =>
      new Promise((_r, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as unknown as typeof fetch
    expect((await requestConsult(input, { mode: 'live', fetchImpl: hang, timeoutMs: 10 })).source).toBe('unavailable')
  })
})

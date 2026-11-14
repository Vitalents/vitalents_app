// FR-RT-01: the research screen only loads simulated models, and the published files keep their label and limits.
import { describe, expect, it } from 'vitest'
import { isSimulatedModel, loadResearchModel } from './load'
import type { ResearchIndex, ResearchModel } from './types'

const FILES = import.meta.glob('../../../public/data/research/*.json', { eager: true, import: 'default' }) as Record<string, unknown>
const byName = Object.fromEntries(Object.entries(FILES).map(([k, v]) => [k.split('/').pop()!, v]))
const read = <T,>(f: string) => byName[f] as T
const index = read<ResearchIndex>('index.json')

function fakeFetch(files: Record<string, unknown>): typeof fetch {
  return (async (url: string) => {
    const name = String(url).split('/').pop()!
    return name in files ? new Response(JSON.stringify(files[name])) : new Response('', { status: 404 })
  }) as unknown as typeof fetch
}

describe('published research models', () => {
  it('every model file is simulated, labelled and names independent validation', () => {
    const files = Object.keys(byName).filter((f) => f.startsWith('model_'))
    expect(files.length).toBe(index.models.length)
    for (const f of files) {
      const m = read<ResearchModel>(f)
      expect(isSimulatedModel(m)).toBe(true)
      expect(m.label).toBe('Research prototype on simulated data — not used for any step or alert')
      expect(m.limits.some((l) => l.includes('independent validation'))).toBe(true)
      for (const d of m.evaluation.leave_one_day_out?.days ?? []) expect(d.record_ids.every((id) => id.startsWith('sim:'))).toBe(true)
    }
  })

  it("Fahim's model is reported as not clearly beating the baseline", () => {
    const m = read<ResearchModel>('model_fahim.json')
    expect(m.verdict).toBe('mixed')
    expect(m.evaluation.forward_only?.summary?.beats_baseline).toBe(false)
  })
})

describe('loadResearchModel', () => {
  const fahim = read<ResearchModel>('model_fahim.json')

  it('loads the model for the subject', async () => {
    const r = await loadResearchModel('sim:crew:fahim', fakeFetch({ 'index.json': index, 'model_fahim.json': fahim }))
    expect(r.state).toBe('ok')
  })

  it('refuses a non-simulated subject without fetching', async () => {
    expect((await loadResearchModel('live:crew:x', fakeFetch({}))).state).toBe('missing')
  })

  it('refuses a file that is not marked simulated', async () => {
    const bad = { ...fahim, is_simulated: false }
    const r = await loadResearchModel('sim:crew:fahim', fakeFetch({ 'index.json': index, 'model_fahim.json': bad }))
    expect(r.state).toBe('failed')
  })

  it('reports missing when no model exists for the subject', async () => {
    expect((await loadResearchModel('sim:crew:nobody', fakeFetch({ 'index.json': index }))).state).toBe('missing')
  })
})

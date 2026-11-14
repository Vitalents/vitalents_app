// Loads the published research model for one simulated subject. Refuses anything not marked simulated,
// so a live or research-realm record can never be shown on this screen (CLAUDE.md rule 10).
import type { ResearchIndex, ResearchModel } from './types'

export type LoadResult = { state: 'ok'; model: ResearchModel } | { state: 'missing' } | { state: 'failed'; error: string }

export const RESEARCH_BASE = '/data/research'

export function isSimulatedModel(m: unknown): m is ResearchModel {
  const r = m as Partial<ResearchModel> | null
  return !!r && r.is_simulated === true && typeof r.research_model_id === 'string' && r.research_model_id.startsWith('sim:')
    && typeof r.subject_id === 'string' && r.subject_id.startsWith('sim:')
}

export async function loadResearchModel(subjectId: string | null, fetchImpl: typeof fetch = fetch): Promise<LoadResult> {
  if (!subjectId || !subjectId.startsWith('sim:')) return { state: 'missing' }
  try {
    const res = await fetchImpl(`${RESEARCH_BASE}/index.json`)
    if (!res.ok) return { state: 'missing' }
    const index = (await res.json()) as ResearchIndex
    const entry = index.models.find((m) => m.subject_id === subjectId)
    if (!entry || !/^model_[a-z0-9_-]+\.json$/.test(entry.file)) return { state: 'missing' }
    const r2 = await fetchImpl(`${RESEARCH_BASE}/${entry.file}`)
    if (!r2.ok) return { state: 'missing' }
    const model = (await r2.json()) as unknown
    if (!isSimulatedModel(model) || model.subject_id !== subjectId) return { state: 'failed', error: 'not simulated or wrong subject' }
    return { state: 'ok', model }
  } catch (e) {
    return { state: 'failed', error: String(e) }
  }
}

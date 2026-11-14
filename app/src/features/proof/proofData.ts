// Shape of app/public/data/proof.json, written by scripts/publish_proof.py (FR-SIM-04, FR-AS-08).
// The page only displays what this file holds: a missing or malformed file reads as "not generated", never as 0.

export type SectionStatus = 'generated' | 'not_generated' | 'invalid'
export type ProofStatus = 'generated' | 'partial' | 'not_generated'
export const AREA_IDS = ['execution_integrity', 'measurement_analysis', 'knowledge_assistant', 'use'] as const
export type AreaId = (typeof AREA_IDS)[number]

export interface ProofCheck {
  id: string
  label: string
  method: string | null
  value: number | null
  unit: string | null
  numerator: number | null
  denominator: number | null
  passed: boolean | null
  scenario: string | null
}

export interface ValidationSection {
  status: SectionStatus
  source: string
  source_generated_at_utc: string | null
  source_generated_by: string | null
  seed: number | null
  areas: Record<AreaId, { checks: ProofCheck[] } | null> | null
  illustrative_parameters: string[] | null
  problems: string[]
}

export interface ModelEval {
  source: string
  source_modified_at_utc: string
  derived_by: string
  model: string | null
  library_version: string | null
  total: number | null
  answerable: number | null
  unanswerable: number | null
  passed: number | null
  correct_source: number | null
  correct_abstention: number | null
  blocked: number | null
  answered: number | null
  correct_source_rate: number | null
  abstention_rate: number | null
  blocked_rate: number | null
}

export interface EvalSection {
  status: SectionStatus
  source_pattern: string
  models: ModelEval[] | null
  problems: string[]
}

export interface Proof {
  proof_version: string
  generated_by: string
  generated_at_utc: string
  status: ProofStatus
  validation: ValidationSection
  assistant_eval: EvalSection
}

export const PROOF_URL = '/data/proof.json'
export const PROOF_FILE = 'app/public/data/proof.json'

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Accepts the file only when its frame is what publish_proof.py writes; anything else is "not generated". */
export function parseProof(raw: unknown): Proof | null {
  if (!isObj(raw)) return null
  if (raw.generated_by !== 'scripts/publish_proof.py' || typeof raw.generated_at_utc !== 'string') return null
  const v = raw.validation
  const a = raw.assistant_eval
  if (!isObj(v) || !isObj(a)) return null
  if (typeof v.status !== 'string' || typeof a.status !== 'string') return null
  if (!Array.isArray(v.problems) || !Array.isArray(a.problems)) return null
  if (v.areas !== null && !isObj(v.areas)) return null
  if (a.models !== null && !Array.isArray(a.models)) return null
  return raw as unknown as Proof
}

export async function loadProof(fetchImpl: typeof fetch = fetch): Promise<Proof | null> {
  try {
    const res = await fetchImpl(PROOF_URL, { cache: 'no-store' })
    if (!res.ok) return null
    return parseProof(await res.json())
  } catch {
    return null
  }
}

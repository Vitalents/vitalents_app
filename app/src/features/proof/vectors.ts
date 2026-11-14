// Golden vectors (NFR-11): the shared files in contracts/vectors/, bundled at build time and run through the
// TypeScript engine in this build. The counts on the Proof screen are computed here, not typed in.
import { buildReference, compareToReference } from '../../engine/reference'
import { scoreDecode } from '../../engine/decode'
import { restOpportunity } from '../../engine/schedule'

export interface VectorFile {
  vector_id: string
  function: string
  input: Record<string, unknown>
  expected: Record<string, unknown>
  tolerance?: number
}

export type VectorOutcome = 'reproduced' | 'differs' | 'not_run'
export interface VectorResult {
  path: string
  vectorId: string
  fn: string
  tolerance: number
  outcome: VectorOutcome
  detail: string | null
}

const FILES = import.meta.glob('../../../../contracts/vectors/*/*.json', { eager: true, import: 'default' }) as Record<string, VectorFile>

const FNS: Record<string, (input: never) => unknown> = {
  build_reference: buildReference as never,
  compare_to_reference: compareToReference as never,
  score_decode: scoreDecode as never,
  rest_opportunity: restOpportunity as never,
}

/** First difference between actual and expected (numbers within tolerance), or null when they agree. */
export function firstDifference(actual: unknown, expected: unknown, tol: number, path = ''): string | null {
  if (typeof expected === 'number' && typeof actual === 'number') {
    return Math.abs(actual - expected) <= tol ? null : `${path || 'value'}: ${actual} vs ${expected}`
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return `${path || 'value'}: not a list`
    if (actual.length !== expected.length) return `${path || 'value'}: ${actual.length} items vs ${expected.length}`
    for (let i = 0; i < expected.length; i++) {
      const d = firstDifference(actual[i], expected[i], tol, `${path}[${i}]`)
      if (d) return d
    }
    return null
  }
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') return `${path || 'value'}: missing`
    for (const [k, v] of Object.entries(expected)) {
      const d = firstDifference((actual as Record<string, unknown>)[k], v, tol, path ? `${path}.${k}` : k)
      if (d) return d
    }
    return null
  }
  return Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected) ? null : `${path || 'value'}: ${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`
}

export function runVector(path: string, v: VectorFile, fns = FNS): VectorResult {
  const tolerance = v.tolerance ?? 0.001
  const base = { path: path.replace(/^(\.\.\/)+/, ''), vectorId: v.vector_id, fn: v.function, tolerance }
  const fn = fns[v.function]
  if (!fn) return { ...base, outcome: 'not_run', detail: null }
  try {
    const d = firstDifference(fn(v.input as never), v.expected, tolerance)
    return { ...base, outcome: d ? 'differs' : 'reproduced', detail: d }
  } catch (e) {
    return { ...base, outcome: 'differs', detail: String(e) }
  }
}

export function runAllVectors(files: Record<string, VectorFile> = FILES): VectorResult[] {
  return Object.entries(files)
    .map(([p, v]) => runVector(p, v))
    .sort((a, b) => a.path.localeCompare(b.path))
}

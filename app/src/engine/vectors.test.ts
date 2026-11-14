// Runs every shared test vector in contracts/vectors against the TypeScript engine (NFR-11).
import { describe, expect, it } from 'vitest'
import { buildReference, compareToReference } from './reference'
import { scoreDecode } from './decode'
import { restOpportunity } from './schedule'

const files = import.meta.glob('../../../contracts/vectors/*/*.json', { eager: true, import: 'default' }) as Record<
  string,
  { vector_id: string; function: string; input: Record<string, unknown>; expected: Record<string, unknown>; tolerance: number }
>

const fns: Record<string, (input: never) => unknown> = {
  build_reference: buildReference as never,
  compare_to_reference: compareToReference as never,
  score_decode: scoreDecode as never,
  rest_opportunity: restOpportunity as never,
}

function close(actual: unknown, expected: unknown, tol: number, path = ''): void {
  if (typeof expected === 'number' && typeof actual === 'number') {
    expect(Math.abs(actual - expected), `${path}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tol)
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual), path).toBe(true)
    expect((actual as unknown[]).length, `${path} length`).toBe(expected.length)
    expected.forEach((v, i) => close((actual as unknown[])[i], v, tol, `${path}[${i}]`))
  } else if (expected && typeof expected === 'object') {
    for (const [k, v] of Object.entries(expected)) close((actual as Record<string, unknown>)[k], v, tol, `${path}.${k}`)
  } else {
    expect(actual, path).toEqual(expected)
  }
}

describe('contract vectors', () => {
  const entries = Object.entries(files)
  it('finds vectors', () => expect(entries.length).toBeGreaterThan(0))
  for (const [path, v] of entries) {
    const fn = fns[v.function]
    it.skipIf(!fn)(`${v.function} / ${v.vector_id}`, () => {
      close(fn(v.input as never), v.expected, v.tolerance ?? 0.001, path)
    })
  }
})

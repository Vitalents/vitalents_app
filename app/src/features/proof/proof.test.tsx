// Proof screen (FR-SIM-04, FR-AS-08, NFR-11): numbers only from proof.json or from running contracts/vectors/.
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import committed from '../../../public/data/proof.json'
import { ProofPage, formatCheckValue, formatCount } from './ProofPage'
import { LAYOUT_SAMPLE } from './layoutSample'
import { loadProof, parseProof } from './proofData'
import { firstDifference, runAllVectors, runVector } from './vectors'
import { P } from './strings'

const vectorFiles = import.meta.glob('../../../../contracts/vectors/*/*.json')

describe('golden vectors in this build', () => {
  const results = runAllVectors()
  it('runs every bundled vector file', () => {
    expect(results.length).toBe(Object.keys(vectorFiles).length)
    expect(results.length).toBeGreaterThan(0)
  })
  it('the TS engine reproduces every vector', () => {
    expect(results.filter((r) => r.outcome !== 'reproduced')).toEqual([])
    expect(results[0].path.startsWith('contracts/vectors/')).toBe(true)
  })
  it('reports a difference instead of hiding it', () => {
    expect(firstDifference({ a: 1.0004 }, { a: 1 }, 0.001)).toBeNull()
    expect(firstDifference({ a: 1.01 }, { a: 1 }, 0.001)).toContain('a: 1.01 vs 1')
    expect(firstDifference({ a: [1, 2] }, { a: [1] }, 0.001)).toContain('2 items vs 1')
    expect(firstDifference({ s: 'x' }, { s: 'y' }, 0.001)).toContain('s:')
    const r = runVector('../x.json', { vector_id: 'v', function: 'no_such_fn', input: {}, expected: {} })
    expect(r.outcome).toBe('not_run')
    const bad = runVector('x.json', { vector_id: 'v', function: 'f', input: {}, expected: { y: 2 } }, { f: () => ({ y: 3 }) })
    expect(bad.outcome).toBe('differs')
  })
})

describe('proof.json', () => {
  it('the committed file parses and holds no invented numbers when inputs are missing', () => {
    const p = parseProof(committed)
    expect(p).not.toBeNull()
    expect(p!.generated_by).toBe('scripts/publish_proof.py')
    if (p!.validation.status !== 'generated') expect(p!.validation.areas).toBeNull()
    if (p!.assistant_eval.status !== 'generated') expect(p!.assistant_eval.models).toBeNull()
  })
  it('rejects files that publish_proof.py did not write', () => {
    expect(parseProof(null)).toBeNull()
    expect(parseProof([])).toBeNull()
    expect(parseProof({ ...LAYOUT_SAMPLE, generated_by: 'by hand' })).toBeNull()
    expect(parseProof({ ...LAYOUT_SAMPLE, validation: undefined })).toBeNull()
  })
  it('a missing or non-JSON file loads as null, never as zeros', async () => {
    const notFound = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch
    const html = (async () => ({ ok: true, json: async () => { throw new SyntaxError('<!doctype') } })) as unknown as typeof fetch
    const down = (async () => { throw new TypeError('offline') }) as unknown as typeof fetch
    expect(await loadProof(notFound)).toBeNull()
    expect(await loadProof(html)).toBeNull()
    expect(await loadProof(down)).toBeNull()
  })
})

describe('formatting keeps the file value', () => {
  it('null stays "no value", never 0', () => {
    expect(formatCheckValue({ value: null, unit: 'rate' })).toBe(P.noValue)
    expect(formatCount({ numerator: null, denominator: null })).toBe(P.noCount)
  })
  it('a rate never rounds to 100 % or 0 % unless it is exactly that', () => {
    expect(formatCheckValue({ value: 1, unit: 'rate' })).toBe('100 %')
    expect(formatCheckValue({ value: 0, unit: 'rate' })).toBe('0 %')
    expect(formatCheckValue({ value: 0.9996, unit: 'rate' })).not.toBe('100 %')
    expect(formatCheckValue({ value: 0.0001, unit: 'rate' })).not.toBe('0 %')
    expect(formatCheckValue({ value: 0.725, unit: 'rate' })).toBe('72.5 %')
  })
  it('units and counts', () => {
    expect(formatCheckValue({ value: 151.5, unit: 's' })).toBe('151.5 s')
    expect(formatCheckValue({ value: 3, unit: 'count' })).toBe('3')
    expect(formatCount({ numerator: 9, denominator: 10 })).toBe('9 of 10')
    expect(formatCount({ numerator: null, denominator: 9 })).toBe('out of 9')
  })
})

describe('ProofPage', () => {
  it('shows "Not generated yet" with the expected files when there is no evidence', () => {
    const html = renderToStaticMarkup(<ProofPage proof={null} vectors={[]} />)
    expect(html).toContain(P.notGenerated)
    expect(html).toContain('science/out/validation.json')
    expect(html).toContain('science/out/assistant_eval*.json')
    expect(html).not.toContain('%')
    for (const l of P.limits) expect(html).toContain(l)
  })
  it('shows each figure with its source file and time', () => {
    const html = renderToStaticMarkup(<ProofPage proof={LAYOUT_SAMPLE} vectors={[]} />)
    expect(html).toContain('Layout sample: every measurement has a unit')
    expect(html).toContain('9 of 10')
    expect(html).toContain('14 Nov 2026, 09:12 UTC')
    expect(html).toContain('science/out/assistant_eval_sample.json')
    expect(html).toContain('1 of 2') // correct source of answerable
    expect(html).toContain(P.noValue) // null value stays visible as missing
    expect(html).not.toContain(P.notGeneratedBody('science/out/validation.json'))
  })
  it('lists the five kinds of check and the limits', () => {
    const html = renderToStaticMarkup(<ProofPage proof={null} vectors={runAllVectors()} />)
    for (const m of P.methods) expect(html).toContain(m.title)
    expect(html).toContain(P.vectorsTail)
    expect(html).toContain('need independent validation')
  })
})

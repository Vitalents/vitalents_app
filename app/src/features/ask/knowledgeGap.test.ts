// FR-AS-04: "Add this question for review" writes a knowledge_gap that validates against the contract.
import { describe, expect, it } from 'vitest'
import schema from '../../../../contracts/knowledge_gap.schema.json'
import { makeKnowledgeGap, redactQuestion } from './knowledgeGap'

type Prop = { type?: string | string[]; enum?: string[]; pattern?: string; items?: { type?: string } }
const typeOf = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)

/** A small checker for the keywords this schema uses (required, type, enum, pattern, items, additionalProperties). */
function validate(rec: Record<string, unknown>): string[] {
  const errs: string[] = []
  const props = schema.properties as Record<string, Prop>
  for (const k of schema.required) if (!(k in rec)) errs.push(`missing ${k}`)
  for (const [k, v] of Object.entries(rec)) {
    const p = props[k]
    if (!p) {
      if (schema.additionalProperties === false) errs.push(`extra ${k}`)
      continue
    }
    if (p.type) {
      const types = Array.isArray(p.type) ? p.type : [p.type]
      if (!types.includes(typeOf(v))) errs.push(`${k}: type ${typeOf(v)}`)
    }
    if (p.enum && !p.enum.includes(v as string)) errs.push(`${k}: not in enum`)
    if (p.pattern && typeof v === 'string' && !new RegExp(p.pattern).test(v)) errs.push(`${k}: pattern`)
    if (p.items?.type && Array.isArray(v) && v.some((x) => typeOf(x) !== p.items!.type)) errs.push(`${k}: items`)
  }
  return errs
}

describe('makeKnowledgeGap', () => {
  it('validates against contracts/knowledge_gap.schema.json', () => {
    const rec = makeKnowledgeGap('Why does my Decode score drop after a late shift?', ['lib:source:hrp-sleep'])
    expect(validate(rec as unknown as Record<string, unknown>)).toEqual([])
    expect(rec.knowledge_gap_id).toMatch(/^sim:knowledge_gap:[0-9a-f-]{36}$/)
    expect(rec.data_origin).toBe('application_generated')
    expect(rec.status).toBe('open')
    expect(rec.created_at_utc.endsWith('Z')).toBe(true)
  })
  it('gives every record its own id', () => {
    expect(makeKnowledgeGap('a').knowledge_gap_id).not.toBe(makeKnowledgeGap('a').knowledge_gap_id)
  })
  it('the checker rejects a broken record', () => {
    expect(validate({ knowledge_gap_id: 'bad id', status: 'maybe' }).length).toBeGreaterThan(0)
  })
  it('redacts emails and long numbers from the question', () => {
    const q = redactQuestion('Mail fahim@example.org about badge 123456789 please')
    expect(q).not.toContain('fahim@example.org')
    expect(q).not.toContain('123456789')
  })
})

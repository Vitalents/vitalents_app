// FR-SHR-01: the summary carries events, readings with data status and limits, symptoms,
// steps tried and the question, and never a private note.
import { describe, expect, it } from 'vitest'
import { FAHIM, SECRET, loadS1WithPrivate } from '../../sync/testkit'
import { buildSummary, parseSummaryText } from './summary'

describe('buildSummary (FR-SHR-01)', () => {
  const data = loadS1WithPrivate()
  const s = buildSummary(data, FAHIM, 'Should I change my exercise plan?')
  const section = (k: string) => s.sections.find((x) => x.key === k)!

  it('never contains private note text, in sections or summary text', () => {
    expect(s.summaryText).not.toContain(SECRET)
    expect(JSON.stringify(s.sections)).not.toContain(SECRET)
    expect(s.excludedFieldCodes).toEqual(['self_report.private_note'])
  })

  it('lists the five parts in order', () => {
    expect(s.sections.map((x) => x.key)).toEqual(['events', 'measurements', 'symptoms', 'actions', 'question'])
  })

  it('includes readings with their data status and limits', () => {
    const hr = section('measurements').items.find((i) => i.id === 'sim:measurement:hr-d27')!
    expect(hr.dataStatus).toBe('limited')
    expect(hr.reasons).toEqual(['weak_sensor_contact'])
    expect(hr.limits).toBeTruthy()
    expect(s.summaryText).toContain('[data: Limited, weak sensor contact]')
    expect(s.summaryText).toContain('Limits: ')
  })

  it('includes symptoms, steps tried (not proposed ones) and the question', () => {
    expect(section('symptoms').items.map((i) => i.text)).toEqual(['Lower back pain after exercise, mild'])
    const tried = section('actions').items.map((i) => i.id)
    expect(tried).toContain('sim:action:dec-d25')
    expect(tried).not.toContain('sim:action:rest-d27') // still proposed
    expect(section('question').items[0].text).toBe('Should I change my exercise plan?')
  })

  it('previews every record it sends, and only records of this subject', () => {
    expect(s.previewedRecordIds).toContain('sim:self_report:pain-d20')
    expect(s.previewedRecordIds).toContain('sim:finding:dec-d27')
    expect(s.previewedRecordIds.every((id) => !id.includes('other-crew'))).toBe(true)
    expect(new Set(s.previewedRecordIds).size).toBe(s.previewedRecordIds.length)
  })

  it('round-trips through the stored text for the medical view', () => {
    const blocks = parseSummaryText(s.summaryText)
    expect(blocks.map((b) => b.title)).toEqual(s.sections.map((x) => x.title))
  })

  it('uses no forbidden wording', () => {
    expect(s.summaryText).not.toMatch(/\b(healthy|normal|all clear|diagnosed|caused by|ready|not ready)\b/i)
  })
})

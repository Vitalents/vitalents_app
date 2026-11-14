// FR-AS-09: the deterministic draft has the five fixed sections, restates only input numbers,
// never holds a private note, and its package text reads like the rest of the summary.
import { describe, expect, it } from 'vitest'
import { CONSULT_KEYS, allowedNumbers, toConsultInput, unsupportedNumbers } from '../../assistant/consult'
import { FAHIM, SECRET, loadS1WithPrivate } from '../../sync/testkit'
import { buildSummary, parseSummaryText } from '../sharing/summary'
import { checkSections, draftToText, failingSections, liveSections, templateSections } from './draft'
import { C } from './strings'

const Q = 'Should I change my exercise plan?'
const input = toConsultInput(buildSummary(loadS1WithPrivate(), FAHIM, Q))
const allowed = allowedNumbers(input)

describe('templateSections', () => {
  const s = templateSections(input)

  it('has the five fixed sections, all filled', () => {
    expect(Object.keys(s)).toEqual([...CONSULT_KEYS])
    for (const k of CONSULT_KEYS) expect(s[k].trim()).not.toBe('')
  })

  it('note contains only input numbers', () => {
    expect(unsupportedNumbers(Object.values(s).join('\n'), allowed)).toEqual([])
    expect(failingSections(checkSections(s, allowed))).toEqual([])
  })

  it('restates the record: trend in date order with data status, symptoms and limits as context, steps tried', () => {
    expect(s.trend).toContain('37 vs 41-44')
    const dates = s.trend.split('\n').map((l) => l.slice(0, 10)).filter((d) => /^\d{4}/.test(d))
    expect(dates).toEqual([...dates].sort())
    expect(s.trend).toContain('(data: No reading, weak sensor contact)')
    expect(s.context).toContain('Lower back pain after exercise')
    expect(s.context).toContain('Limits: ')
    expect(s.what_was_tried).toContain('Send your report to the medical team')
    expect(s.crew_question).toBe(Q)
    expect(s.requested_decision).toBe(C.template.decisionWithQuestion)
  })

  it('never contains a private note', () => {
    expect(JSON.stringify(s)).not.toContain(SECRET)
  })

  it('says so when a part of the record is empty, and never writes 0 for missing', () => {
    const empty = templateSections({ events: [], measurements: [], symptoms: [], actions: [], question: null })
    expect(empty).toEqual({
      trend: C.template.noTrend,
      context: C.template.noContext,
      what_was_tried: C.template.noTried,
      crew_question: C.template.noQuestion,
      requested_decision: C.template.decision,
    })
    expect(Object.values(empty).join(' ')).not.toMatch(/\d/)
  })
})

describe('liveSections', () => {
  it('replaces the model crew question with the astronaut question, verbatim', () => {
    const model = { ...templateSections(input), crew_question: 'Something the model made up' }
    expect(liveSections(model, input).crew_question).toBe(Q)
    expect(liveSections(model, { ...input, question: null }).crew_question).toBe(C.template.noQuestion)
  })
})

describe('checkSections', () => {
  it('finds an edited number that is not in the record, per section', () => {
    const edited = { ...templateSections(input), context: 'Pain was 8.5 on a 10 point scale.' }
    const check = checkSections(edited, allowed)
    expect(failingSections(check)).toEqual(['context'])
    expect(check.context.map((x) => x.value)).toContain('8.5')
  })
})

describe('draftToText', () => {
  it('produces titled blocks that parseSummaryText reads back, with the origin', () => {
    const text = draftToText({ origin: { kind: 'template', why: 'not_live' }, sections: templateSections(input) })
    const blocks = parseSummaryText(text)
    expect(blocks.map((b) => b.title)).toEqual([C.packageTitle, ...CONSULT_KEYS.map((k) => C.sections[k])])
    expect(blocks[0].lines.map((l) => l.text)).toEqual([C.withoutAssistant, C.packageReviewed])
    expect(blocks[4].lines[0].text).toBe(Q)
    expect(text).not.toContain(SECRET)
  })
  it('keeps blank lines out of a section so a block never splits', () => {
    const t = draftToText({
      origin: { kind: 'assistant', model: 'm' },
      sections: { ...templateSections(input), trend: 'one\n\n\ntwo', context: '   ' },
    })
    const blocks = parseSummaryText(t)
    expect(blocks).toHaveLength(6)
    expect(blocks[1].lines.map((l) => l.text)).toEqual(['one', 'two'])
    expect(blocks[2].lines.map((l) => l.text)).toEqual([C.template.blank])
  })
})

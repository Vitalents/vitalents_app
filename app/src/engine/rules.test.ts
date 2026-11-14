import { describe, expect, it } from 'vitest'
import { computeFacts, evaluateRules, fill, matches, type Facts } from './rules'
import { STARTER_RULES } from './rules.starter'
import type { FactData } from './rules'

const fixture = Object.values(import.meta.glob('../../public/data/fixtures/S1.json', { eager: true, import: 'default' }))[0] as FactData
const D27 = '2026-11-14'
const base: Facts = {
  'help.requested': false, 'symptom.reported_today': false, 'followup.overdue_count': 0,
  'decode.below_reference_consecutive': 0, 'sleep.nights_under_6h_last3': 0, 'decode.info_status': 'valid',
  'sleep.info_status': 'valid', 'pulse.info_status': 'valid', 'decode.reference_status': 'usable_for_question',
  'decode.reference_range': '41–44', 'decode.session_count_comparable': 10,
}

describe('rules evaluator', () => {
  it('help request ranks first, above everything else', () => {
    const steps = evaluateRules({ ...base, 'help.requested': true, 'decode.below_reference_consecutive': 2, 'sleep.nights_under_6h_last3': 3, 'decode.info_status': 'no_reading' }, STARTER_RULES)
    expect(steps[0].rule_id).toBe('R-REV-01')
    expect(steps[0].step_category).toBe('request_review')
  })

  it('a good Decode never hides a symptom', () => {
    const steps = evaluateRules({ ...base, 'symptom.reported_today': true }, STARTER_RULES)
    expect(steps.map((s) => s.rule_id)).toContain('R-REV-02')
    expect(steps[0].rule_id).toBe('R-REV-02')
  })

  it('unknown facts never satisfy a rule, and null is never compared', () => {
    expect(matches({ all: [{ fact: 'missing.fact', op: '==', value: null }] }, base)).toBe(false)
    expect(matches({ all: [{ fact: 'x', op: '>=', value: 1 }] }, { x: null })).toBe(false)
  })

  it('templates are filled from facts only', () => {
    expect(fill('{a} and {b}', { a: 2 })).toBe('2 and not available')
  })

  it('wording never claims a cause or a verdict', () => {
    const banned = /\b(caused by|because of|proves|healthy|normal|ready|diagnos\w*|worked)\b/i
    for (const r of STARTER_RULES) {
      expect(r.finding).not.toMatch(banned)
      expect(r.step.title).not.toMatch(banned)
    }
  })
})

describe('Fahim, mission day 27 (S1 fixture)', () => {
  const facts = computeFacts(fixture, D27)

  it('computes the facts from the record', () => {
    expect(facts['sleep.nights_under_6h_last3']).toBe(3)
    expect(facts['sleep.last_night_h']).toBe(5.2)
    expect(facts['decode.below_reference_consecutive']).toBe(2)
    expect(facts['decode.info_status']).toBe('no_reading')
    expect(facts['pulse.info_status']).toBe('no_reading')
    expect(facts['help.requested']).toBe(false)
    expect(facts['limits.any_exceeded']).toBeNull()
  })

  it('produces the rest-window step, ahead of missing-information steps', () => {
    const steps = evaluateRules(facts, STARTER_RULES)
    expect(steps[0].rule_id).toBe('R-PLAN-01')
    expect(steps[0].opens).toBe('schedule_alternatives')
    expect(steps[0].step_category).toBe('observe') // draft team workflow, not an approved medical plan
    expect(steps[0].explanation).toContain('2 sessions in a row below your personal range (41–44)')
    expect(steps.map((s) => s.rule_id)).toEqual(expect.arrayContaining(['R-MEAS-03', 'R-MEAS-04']))
    expect(steps.map((s) => s.rule_id)).not.toContain('R-PLAN-02')
  })
})

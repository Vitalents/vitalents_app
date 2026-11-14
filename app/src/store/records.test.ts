// Records created in the app must validate against the contract schemas (CLAUDE.md rule 10).
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'
import { buildHelpRecords, buildReportRecords, newId } from './records'

const schemas = import.meta.glob('../../../contracts/*.schema.json', { eager: true, import: 'default' }) as Record<string, { title: string }>
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validators = new Map(Object.values(schemas).map((s) => [s.title, ajv.compile(s)]))

function expectValid(entity: string, record: unknown) {
  const v = validators.get(entity)
  expect(v, `schema for ${entity}`).toBeDefined()
  const ok = v!(record)
  expect(ok, `${entity}: ${ajv.errorsText(v!.errors)}`).toBe(true)
}

const ctx = { subjectId: 'sim:crew:fahim', reviewId: 'sim:daily_review:d27', now: '2026-11-14T10:00:00.123Z' }

describe('record builders', () => {
  it('newId keeps the subject realm', () => {
    expect(newId('finding', 'sim:crew:fahim', () => 'abc')).toBe('sim:finding:abc')
    expect(newId('finding', 'live:player:001', () => 'abc')).toBe('live:finding:abc')
  })

  it('Request help builds valid finding, action and follow-up (FR-SH-06)', () => {
    const r = buildHelpRecords({ ...ctx, note: 'The pain is worse' })
    expectValid('finding', r.finding)
    expectValid('action', r.action)
    expectValid('follow_up', r.follow_up)
    expect(r.follow_up.followup_status).toBe('review_requested')
    expect(r.follow_up.assigned_role).toBe('medical')
    expect(r.action.step_category).toBe('request_review')
    expect(r.follow_up.action_id).toBe(r.action.action_id)
    expect(r.action.finding_id).toBe(r.finding.finding_id)
  })

  it('Report something builds a valid symptom self-report and a watching follow-up (FR-SH-05)', () => {
    const r = buildReportRecords({ ...ctx, text: 'Headache since the morning', onset: '2026-11-14', severity: 'mild', reportDate: '2026-11-14' })
    expectValid('self_report', r.self_report)
    expectValid('finding', r.finding)
    expectValid('action', r.action)
    expectValid('follow_up', r.follow_up)
    expect(r.self_report.report_kind).toBe('symptom')
    expect(r.finding.supporting_record_ids).toEqual([r.self_report.self_report_id])
    expect(r.follow_up.followup_status).toBe('watching')
    expect(r.self_report.private_note).toBeUndefined()
  })
})

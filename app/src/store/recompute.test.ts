import Ajv2020 from 'ajv/dist/2020'
import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixtures/S1.json'
import { ENTITY_NAMES } from '../data/contract'
import type { Data } from './store'
import { recomputeRecords, recoverUnfinishedRounds } from './recompute'
import { buildReportRecords } from './records'

const schemas = import.meta.glob('../../../contracts/*.schema.json', { eager: true, import: 'default' }) as Record<string, { title: string }>
const ajv = new Ajv2020({ strict: false, allErrors: true })
const validators = new Map(Object.values(schemas).map((s) => [s.title, ajv.compile(s)]))
const load = (): Data => Object.fromEntries(ENTITY_NAMES.map((k) => [k, structuredClone((fixture as Record<string, unknown>)[k] ?? [])])) as Data
const ctx = { subjectId: 'sim:crew:fahim', reviewDate: '2026-11-14', now: '2026-11-14T12:02:00Z' }
function live(d: Data, count = 43) {
  const s = { ...d.decode_session[0], decode_session_id: 'sim:decode_session:live-test',
    created_at_utc: ctx.now, start_at_utc: '2026-11-14T12:00:00Z', end_at_utc: '2026-11-14T12:01:30Z',
    correct_count: count, accepted_responses: count, accuracy_percent: 100, median_correct_rt_ms: 900,
    is_practice: false, session_state: 'completed' as const, data_origin: 'live_decode' as const, is_simulated: false, played_live_into_simulation: true }
  d.decode_session.push(s)
  d.information_status.push({ ...d.information_status[0], information_status_id: 'sim:information_status:live-test',
    record_ref: s.decode_session_id, created_at_utc: ctx.now, status: 'valid', reference_eligible: true, reason_codes: [] })
  return s
}
function merge(d: Data, b: Partial<Data>): Data {
  const next = structuredClone(d)
  for (const [key, records] of Object.entries(b)) {
    const all = new Map((next[key as keyof Data] as unknown as Record<string, unknown>[]).map((r) => [r[`${key}_id`], r]))
    for (const r of records) all.set((r as unknown as Record<string, unknown>)[`${key}_id`], r as unknown as Record<string, unknown>)
    ;(next as unknown as Record<string, unknown[]>)[key] = [...all.values()]
  }
  return next
}

describe('live review pipeline', () => {
  it('derives a new review and traceable comparison from a new valid round, preserving prior follow-ups', () => {
    const d = load(); const s = live(d)
    const out = recomputeRecords(d, { ...ctx, triggerId: s.decode_session_id })
    expect(out.daily_review).toHaveLength(1)
    expect(out.daily_review![0].decode_session_id).toBe(s.decode_session_id)
    const f = out.finding!.find((f) => f.rule_id === 'rule:R-OBS-02')!
    expect(f.supporting_record_ids).toContain(s.decode_session_id)
    expect(f.supporting_record_ids).toContain(d.personal_reference[0].personal_reference_id)
    expect(f.explanation).toContain('within your range')
    expect(out.personal_reference).toEqual([]) // open Decode follow-up freezes the existing version
    expect(merge(d, out).follow_up).toEqual(d.follow_up)
    for (const [key, rows] of Object.entries(out)) for (const r of rows) {
      const check = validators.get(key)!
      expect(check(r), `${key}: ${ajv.errorsText(check.errors)}`).toBe(true)
    }
  })
  it('is idempotent for the same committed input snapshot', () => {
    const d = load(); const s = live(d)
    const c = { ...ctx, triggerId: s.decode_session_id }; const out = recomputeRecords(d, c)
    expect(recomputeRecords(merge(d, out), c)).toEqual({})
  })
  it('orders distinct review revisions even when inputs commit in the same millisecond', () => {
    const d = load(); const s = live(d)
    const c = { ...ctx, triggerId: s.decode_session_id }; const first = recomputeRecords(d, c)
    const next = merge(d, first)
    next.decode_session.find((r) => r.decode_session_id === s.decode_session_id)!.correct_count = 44
    const second = recomputeRecords(next, c)
    expect(Date.parse(second.daily_review![0].created_at_utc)).toBe(Date.parse(first.daily_review![0].created_at_utc) + 1)
    expect(second.daily_review![0].daily_review_id).not.toBe(first.daily_review![0].daily_review_id)
    expect(recomputeRecords(merge(next, second), c)).toEqual({})
  })
  it('builds an explicit prior-day reference when none was stored', () => {
    const d = load(); d.personal_reference = []; d.follow_up = []
    const s = live(d); const out = recomputeRecords(d, { ...ctx, triggerId: s.decode_session_id })
    const r = out.personal_reference![0]
    expect(r.reference_status).toBe('usable_for_question')
    expect(r.source_record_ids).not.toContain(s.decode_session_id)
    expect(r.source_record_ids).not.toContain(d.decode_session[0].decode_session_id)
    expect(r.source_record_ids).not.toContain(d.decode_session[1].decode_session_id)
    expect(r.end_date < ctx.reviewDate).toBe(true)
    expect(r.reference_version).toMatch(/^D10-/)
  })
  it('practice and in-progress checkpoints never generate a new review', () => {
    const d = load(); const s = live(d)
    s.is_practice = true
    expect(recomputeRecords(d, { ...ctx, triggerId: s.decode_session_id })).toEqual({})
    s.is_practice = false; d.decode_session.at(-1)!.session_state = 'started'
    expect(recomputeRecords(d, { ...ctx, triggerId: s.decode_session_id })).toEqual({})
  })
  it('an incomplete measurement gets a repeat step without a comparison', () => {
    const d = load(); const s = live(d); d.decode_session.at(-1)!.session_state = 'aborted'
    d.information_status.at(-1)!.status = 'incomplete'
    const out = recomputeRecords(d, { ...ctx, triggerId: s.decode_session_id })
    expect(out.finding!.map((f) => f.rule_id)).toContain('rule:R-MEAS-01')
    expect(out.finding!.map((f) => f.rule_id)).not.toContain('rule:R-OBS-02')
  })
  it('a new symptom reuses its medical follow-up, never a generic help request or a second medical action', () => {
    const d = load(); const symptom = buildReportRecords({ subjectId: ctx.subjectId, reviewId: d.daily_review[0].daily_review_id,
      now: ctx.now, text: 'Headache', severity: 'severe', onset: ctx.reviewDate, reportDate: ctx.reviewDate })
    const withReport = merge(d, { self_report: [symptom.self_report], finding: [symptom.finding], action: [symptom.action], follow_up: [symptom.follow_up] })
    const out = recomputeRecords(withReport, { ...ctx, triggerId: symptom.self_report.self_report_id })
    expect(out.daily_review![0].selected_action_id).toBe(symptom.action.action_id)
    expect(out.finding!.some((f) => f.rule_id === 'rule:R-REV-02')).toBe(true)
    expect(out.finding!.some((f) => f.rule_id === 'rule:R-REV-01')).toBe(false)
    expect(out.follow_up).toEqual([])
  })
  it('recovers a persisted started checkpoint without inventing a later end time', () => {
    const d = load(); const s = live(d); d.decode_session.at(-1)!.session_state = 'started'
    const out = recoverUnfinishedRounds(d)
    expect(out.decode_session![0].session_state).toBe('aborted')
    expect(out.decode_session![0].end_at_utc).toBe(s.end_at_utc)
    expect(out.information_status![0]).toMatchObject({ status: 'incomplete', reference_eligible: false })
  })
})

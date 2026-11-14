// FR-PE-01..04: feedback records, the data-layer permissions around them, and FR-PE-03 (feedback changes nothing else).
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The store writes to IndexedDB first; jsdom has none, so the table write is a no-op here. The in-memory state is what we check.
vi.mock('../../store/db', () => ({
  db: { entity: () => ({ bulkPut: async () => undefined }), table: () => ({ toArray: async () => [] }), meta: { get: async () => undefined } },
}))

import type { DecodeSession, FeedbackEntry, KnowledgeGap } from '../../data/contract'
import { STARTER_RULES } from '../../engine/rules.starter'
import { auditLog, canWrite, filterData, ruleReviewItems, PermissionError } from '../../store/permissions'
import { useStore } from '../../store/store'
import { FAHIM, SECRET, loadS1, loadS1WithPrivate, schemaErrors } from '../../sync/testkit'
import { makeKnowledgeGap } from '../ask/knowledgeGap'
import { rate } from '../followups/records'
import { alertFeedback, gapDomains, latestFeedback, ruleGroups, triedActions } from './records'
import { saveAlertRating } from './write'

const ctx = { subjectId: FAHIM }
const NOW = '2026-11-14T09:00:00.000Z'
const finding = (id: string) => loadS1().finding.find((f) => f.finding_id === id)!

beforeEach(() => {
  auditLog.length = 0
})

describe('alert rating records (FR-PE-02)', () => {
  it('Useful and False alarm both validate against feedback_entry.schema.json', () => {
    const f = finding('sim:finding:dec-d25')
    const u = alertFeedback(f, 'useful', 'ignored for useful', NOW)
    const fa = alertFeedback(f, 'false_alarm', '  I was on a call during the session ', NOW)
    expect(schemaErrors('feedback_entry', u)).toBeNull()
    expect(schemaErrors('feedback_entry', fa)).toBeNull()
    expect(u).toMatchObject({ feedback_kind: 'alert_usefulness', rating: 1, comment: null, requires_specialist_review: false, target_record_id: f.finding_id })
    expect(fa).toMatchObject({ rating: 0, comment: 'I was on a call during the session', requires_specialist_review: true })
    expect(fa.feedback_entry_id.startsWith('sim:feedback_entry:')).toBe(true)
    expect(alertFeedback(f, 'false_alarm', '   ', NOW).comment).toBeNull() // missing is null, never ''
  })

  it('the newest rating per finding counts; earlier ones stay in the log', () => {
    const f = finding('sim:finding:dec-d25')
    const a = alertFeedback(f, 'false_alarm', '', '2026-11-14T09:00:00Z')
    const b = alertFeedback(f, 'useful', '', '2026-11-14T09:05:00Z')
    expect(latestFeedback([a, b], f.finding_id, 'alert_usefulness')).toBe(b)
    expect(a.feedback_entry_id).not.toBe(b.feedback_entry_id)
  })
})

describe('FR-PE-03: writing feedback never changes references, rules or limits', () => {
  it('saveAlertRating adds feedback_entry records and leaves every other table untouched', async () => {
    const data = loadS1()
    useStore.setState({ data, ready: true })
    const before = structuredClone(useStore.getState().data)
    const rulesBefore = structuredClone(STARTER_RULES)

    await saveAlertRating(finding('sim:finding:dec-d25'), 'false_alarm', 'Noisy cabin', 'astronaut', '2026-11-14T09:00:00Z')
    await saveAlertRating(finding('sim:finding:dec-d27'), 'false_alarm', '', 'astronaut', '2026-11-14T09:01:00Z')
    await saveAlertRating(finding('sim:finding:dec-d25'), 'useful', '', 'astronaut', '2026-11-14T09:02:00Z')

    const after = useStore.getState().data
    expect(after.feedback_entry).toHaveLength(before.feedback_entry.length + 3)
    for (const e of after.feedback_entry) expect(schemaErrors('feedback_entry', e)).toBeNull()
    // references, rules and limits (and everything else) stay exactly as they were
    expect(after.personal_reference).toEqual(before.personal_reference)
    expect(after.rule_definition).toEqual(before.rule_definition)
    expect(STARTER_RULES).toEqual(rulesBefore)
    for (const k of Object.keys(before) as (keyof typeof before)[]) {
      if (k !== 'feedback_entry') expect(after[k], k).toEqual(before[k])
    }
  })

  it('medical and planner cannot write feedback; the refusal is logged with ids only', async () => {
    useStore.setState({ data: loadS1(), ready: true })
    await expect(saveAlertRating(finding('sim:finding:dec-d25'), 'false_alarm', 'x', 'medical', NOW)).rejects.toBeInstanceOf(PermissionError)
    await expect(saveAlertRating(finding('sim:finding:dec-d25'), 'useful', '', 'planner', NOW)).rejects.toBeInstanceOf(PermissionError)
    expect(useStore.getState().data.feedback_entry).toHaveLength(0)
    expect(auditLog.map((a) => [a.role, a.op, a.entity])).toEqual([['medical', 'write', 'feedback_entry'], ['planner', 'write', 'feedback_entry']])
  })

  it('a rating must target a record in the same realm', () => {
    const data = loadS1()
    const e = alertFeedback(finding('sim:finding:dec-d25'), 'useful', '', NOW)
    expect(canWrite('astronaut', 'feedback_entry', e, ctx, data)).toBe(true)
    expect(canWrite('astronaut', 'feedback_entry', { ...e, target_record_id: 'live:finding:x' }, ctx, data)).toBe(false)
  })
})

/** S1 with a private note, alert ratings, an action rating, a display preference and a knowledge gap. */
function withFeedback() {
  const data = loadS1WithPrivate()
  const pref: FeedbackEntry = {
    feedback_entry_id: 'sim:feedback_entry:pref-1', schema_version: '1.0', subject_id: FAHIM, data_origin: 'application_generated',
    is_simulated: true, created_at_utc: NOW, target_record_id: FAHIM, feedback_kind: 'display_preference', rating: null, comment: 'Larger text', requires_specialist_review: false,
  }
  const done = { ...data.action.find((a) => a.action_id === 'sim:action:dec-d25')!, execution_status: 'completed' as const }
  data.feedback_entry = [
    alertFeedback(finding('sim:finding:dec-d25'), 'false_alarm', 'Noisy cabin', '2026-11-14T09:00:00Z'),
    alertFeedback(finding('sim:finding:dec-d27'), 'useful', '', '2026-11-14T09:01:00Z'),
    rate(done, 'useful', '2026-11-14T09:02:00Z').feedback_entry,
    pref,
  ]
  const gap: KnowledgeGap = makeKnowledgeGap('Does a short nap change the next Decode session?', ['lib:nasa-sleep-risk'], new Date(NOW))
  data.knowledge_gap = [gap]
  return data
}

describe('permissions for feedback (data layer)', () => {
  it('astronaut sees all own feedback and gaps', () => {
    const v = filterData('astronaut', withFeedback(), ctx)
    expect(v.feedback_entry).toHaveLength(4)
    expect(v.knowledge_gap).toHaveLength(1)
  })

  it('medical sees ratings and gaps, not display preferences, and never a private note', () => {
    const data = withFeedback()
    const v = filterData('medical', data, ctx)
    expect(v.feedback_entry.map((e) => e.feedback_kind).sort()).toEqual(['action_usefulness', 'alert_usefulness', 'alert_usefulness'])
    expect(v.knowledge_gap).toHaveLength(1)
    expect(JSON.stringify(v)).not.toContain(SECRET)
    expect(JSON.stringify(v)).not.toContain('Larger text')
  })

  it('planner sees no feedback, no gaps and no rule-review queue', () => {
    const data = withFeedback()
    const v = filterData('planner', data, ctx)
    expect(v.feedback_entry).toHaveLength(0)
    expect(v.knowledge_gap).toHaveLength(0)
    expect(ruleReviewItems('planner', data, ctx)).toEqual([])
    expect(auditLog.at(-1)).toMatchObject({ role: 'planner', op: 'read', entity: 'feedback_entry' })
  })

  it('the queue projection carries rule metadata and the rating only, not the finding text or evidence', () => {
    const data = withFeedback()
    const items = ruleReviewItems('medical', data, ctx)
    expect(items).toHaveLength(2)
    const text = JSON.stringify(items)
    for (const f of data.finding) expect(text).not.toContain(f.explanation)
    expect(text).not.toContain('sim:decode_session:')
    expect(Object.keys(items[0]).sort()).toEqual(['feedback_entry_id', 'finding_id', 'finding_kind', 'rated_at_utc', 'rating', 'reason', 'rule_id', 'rule_version'])
    // the medical role still cannot open the unshared finding itself
    expect(filterData('medical', data, ctx).finding).toHaveLength(0)
  })
})

describe('rule-review queue grouping (FR-PE-02)', () => {
  it('groups false alarms by rule id + version, counts useful ratings beside them', () => {
    const data = withFeedback()
    const extra = { ...finding('sim:finding:dec-d25'), finding_id: 'sim:finding:dec-d26', rule_version: '1.1' }
    data.finding.push(extra)
    data.feedback_entry.push(alertFeedback(extra, 'false_alarm', '', '2026-11-14T09:03:00Z'))
    const groups = ruleGroups(ruleReviewItems('medical', data, ctx))
    expect(groups.map((g) => [g.rule_id, g.rule_version, g.falseAlarms.length, g.usefulCount])).toEqual([
      ['rule:R-OBS-01', '1.0', 1, 0],
      ['rule:R-OBS-01', '1.1', 1, 0],
    ])
    expect(groups[0].falseAlarms[0].reason).toBe('Noisy cabin')
  })

  it('re-rating a false alarm as useful takes it out of the queue', () => {
    const data = withFeedback()
    data.feedback_entry.push(alertFeedback(finding('sim:finding:dec-d25'), 'useful', '', '2026-11-14T10:00:00Z'))
    expect(ruleGroups(ruleReviewItems('medical', data, ctx))).toEqual([])
  })
})

describe('tried-actions log (FR-PE-01)', () => {
  it('lists steps that were tried, with the follow-up date and no reading yet', () => {
    const entries = triedActions(filterData('astronaut', loadS1(), ctx))
    expect(entries.map((e) => e.action.action_id)).toEqual(['sim:action:dec-d25']) // proposed and medical-owned steps are not listed
    expect(entries[0]).toMatchObject({ dueUtc: '2026-11-15T07:00:00Z', afterwards: [], rating: null })
    expect(entries[0].kinds).toBe(1)
  })

  it('shows the first reading of the same kind on or after the follow-up date, and the rating', () => {
    const data = loadS1()
    const d25 = data.decode_session.find((s) => s.decode_session_id === 'sim:decode_session:d25')!
    const later: DecodeSession = { ...d25, decode_session_id: 'sim:decode_session:d28', start_at_utc: '2026-11-15T07:30:00Z', end_at_utc: '2026-11-15T07:31:30Z', correct_count: 42 }
    data.decode_session.push(later)
    const a = data.action.find((x) => x.action_id === 'sim:action:dec-d25')!
    const done = { ...a, execution_status: 'completed' as const }
    const r = rate(done, 'not_useful', '2026-11-15T09:00:00Z')
    data.action = data.action.map((x) => (x.action_id === a.action_id ? r.action : x))
    data.feedback_entry = [r.feedback_entry]
    const [e] = triedActions(filterData('astronaut', data, ctx))
    expect(e.afterwards.map((x) => x.record.id)).toEqual(['sim:decode_session:d28'])
    expect(e.rating).toBe(0)
  })

  it('the planner receives nothing to build the log from', () => {
    expect(triedActions(filterData('planner', withFeedback(), ctx))).toEqual([])
  })
})

describe('knowledge-gap log (FR-PE-04)', () => {
  it('links a gap to the domains whose content cites a searched source', () => {
    const gap = makeKnowledgeGap('q', ['lib:nasa-sleep-risk'], new Date(NOW))
    expect(gapDomains(gap)).toEqual({ names: ['Sleep and daily rhythm'], general: false })
    expect(gapDomains({ ...gap, retrieved_source_ids: null })).toEqual({ names: [], general: false })
    // a source cited by many domains points to none of them
    expect(gapDomains({ ...gap, retrieved_source_ids: ['lib:nasa-hrp-risks'] })).toEqual({ names: [], general: true })
  })
})

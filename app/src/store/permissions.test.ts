// SRS section 9: permissions enforced in the data layer, refusals audited with ids only.
import { beforeEach, describe, expect, it } from 'vitest'
import { commentRecords, measurementRequest } from '../features/roles/actions'
import { buildSummary } from '../features/sharing/summary'
import { nextEvents, reviewEvent } from '../sync/engine'
import { newPackageId, shareRecords } from '../sync/share'
import { FAHIM, SECRET, loadS1WithPrivate, schemaErrors } from '../sync/testkit'
import { auditLog, canWrite, filterData, readRecord, assertWrite, PermissionError } from './permissions'
import type { Data } from './store'

const ctx = { subjectId: FAHIM }
const T0 = Date.parse('2026-11-14T10:00:00.000Z')
const link = { linkUp: true, oneWayDelayMin: 4 as const, accelerated: true }

/** S1 plus one confirmed package, advanced to `until` (saved_locally .. delivered). */
function withPackage(until: 'saved_locally' | 'sent' | 'delivered'): { data: Data; pkgId: string } {
  const data = loadS1WithPrivate()
  const s = buildSummary(data, FAHIM, '')
  const w = shareRecords(
    { subjectId: FAHIM, packageId: newPackageId(FAHIM), previewedRecordIds: s.previewedRecordIds, excludedFieldCodes: s.excludedFieldCodes, summaryText: s.summaryText },
    data,
    link,
    T0,
  )
  data.sharing_permission.push(w.permission!)
  data.share_package.push(w.pkg)
  data.sync_event.push(...w.events)
  if (until !== 'saved_locally') data.sync_event.push(...nextEvents(w.pkg, data.sync_event, link, T0))
  if (until === 'delivered') data.sync_event.push(...nextEvents(w.pkg, data.sync_event, link, T0 + 60_000))
  return { data, pkgId: w.pkg.share_package_id }
}

beforeEach(() => {
  auditLog.length = 0
})

describe('planner (SRS 9, FR-SHR-04)', () => {
  it('refuses a Decode session and logs ids only', () => {
    const data = loadS1WithPrivate()
    expect(readRecord('planner', 'decode_session', 'sim:decode_session:d25', data, ctx)).toBeNull()
    expect(auditLog).toHaveLength(1)
    const entry = auditLog[0]
    expect(entry).toMatchObject({ role: 'planner', op: 'read', entity: 'decode_session', record_id: 'sim:decode_session:d25', allowed: false })
    expect(Object.keys(entry).sort()).toEqual(['allowed', 'at', 'entity', 'op', 'record_id', 'role'])
  })

  it('refuses a self-report with a private note', () => {
    const data = loadS1WithPrivate()
    expect(readRecord('planner', 'self_report', 'sim:self_report:pain-d20', data, ctx)).toBeNull()
    expect(JSON.stringify(auditLog)).not.toContain(SECRET)
    expect(auditLog[0].entity).toBe('self_report')
  })

  it("refuses another subject's record, even a schedule item", () => {
    const data = loadS1WithPrivate()
    expect(readRecord('planner', 'mission_schedule', 'sim:mission_schedule:other-crew', data, ctx)).toBeNull()
    expect(readRecord('planner', 'mission_schedule', 'sim:mission_schedule:rest-d27', data, ctx)).not.toBeNull()
    expect(auditLog.map((a) => a.record_id)).toEqual(['sim:mission_schedule:other-crew'])
  })

  it('sees schedule items and planner-owned actions only, never health records', () => {
    const data = loadS1WithPrivate()
    const v = filterData('planner', data, ctx)
    for (const e of ['self_report', 'decode_session', 'decode_response_event', 'measurement', 'sleep_record', 'finding', 'follow_up', 'share_package', 'sync_event', 'information_status', 'personal_reference', 'daily_review'] as const)
      expect(v[e], e).toHaveLength(0)
    expect(v.action.every((a) => a.owner_role === 'planner')).toBe(true)
    expect(v.mission_schedule.map((s) => s.subject_id)).toEqual([FAHIM, FAHIM, FAHIM])
    expect(JSON.stringify(v)).not.toContain(SECRET)
  })

  it('cannot write follow-ups or health records', () => {
    const data = loadS1WithPrivate()
    expect(canWrite('planner', 'follow_up', data.follow_up[0], ctx, data)).toBe(false)
    expect(canWrite('planner', 'self_report', data.self_report[0], ctx, data)).toBe(false)
    expect(canWrite('planner', 'mission_schedule', data.mission_schedule[0], ctx, data)).toBe(true)
    expect(() => assertWrite('planner', 'follow_up', [data.follow_up[0]], ctx, data)).toThrow(PermissionError)
    expect(auditLog[0]).toMatchObject({ op: 'write', entity: 'follow_up', record_id: data.follow_up[0].follow_up_id })
  })
})

describe('medical (SRS 9, FR-SHR-03)', () => {
  it('sees no shared record before the package is delivered', () => {
    const { data, pkgId } = withPackage('sent')
    const v = filterData('medical', data, ctx)
    expect(v.share_package).toHaveLength(0)
    expect(v.self_report).toHaveLength(0)
    expect(readRecord('medical', 'share_package', pkgId, data, ctx)).toBeNull()
    // the follow-up assigned to medical is visible regardless
    expect(v.follow_up.map((f) => f.follow_up_id)).toEqual(['sim:follow_up:pain-d20'])
  })

  it('sees the records of a delivered package, with private notes removed', () => {
    const { data, pkgId } = withPackage('delivered')
    const v = filterData('medical', data, ctx)
    expect(v.share_package.map((p) => p.share_package_id)).toEqual([pkgId])
    const shared = v.self_report.find((s) => s.self_report_id === 'sim:self_report:pain-d20')!
    expect(shared).toBeDefined()
    expect(shared.private_note).toBeNull()
    expect(JSON.stringify(v)).not.toContain(SECRET)
    // a record not in the package stays hidden
    expect(v.decode_session.some((d) => d.decode_session_id === 'sim:decode_session:d13')).toBe(false)
    expect(v.mission_schedule).toHaveLength(0)
  })

  it('reading a private note returns the record without the note; an unshared one is refused', () => {
    const { data } = withPackage('delivered')
    const r = readRecord('medical', 'self_report', 'sim:self_report:pain-d20', data, ctx)!
    expect(r.private_note).toBeNull()
    expect(data.self_report.find((s) => s.self_report_id === 'sim:self_report:pain-d20')!.private_note).toBe(SECRET) // source untouched
    const before = loadS1WithPrivate()
    expect(readRecord('medical', 'self_report', 'sim:self_report:pain-d20', before, ctx)).toBeNull()
    expect(auditLog.at(-1)).toMatchObject({ role: 'medical', entity: 'self_report', record_id: 'sim:self_report:pain-d20' })
    expect(JSON.stringify(auditLog)).not.toContain(SECRET)
  })

  it("never sees another subject's records", () => {
    const { data } = withPackage('delivered')
    expect(readRecord('medical', 'decode_session', 'sim:decode_session:other-crew', data, ctx)).toBeNull()
  })

  it('may mark reviewed, request a reading and comment, only on a delivered package', () => {
    const { data, pkgId } = withPackage('delivered')
    const pkg = data.share_package.find((p) => p.share_package_id === pkgId)!
    const rev = reviewEvent(pkg, data.sync_event, 'medical', T0 + 120_000)!
    expect(canWrite('medical', 'sync_event', rev, ctx, data)).toBe(true)
    expect(canWrite('astronaut', 'sync_event', rev, ctx, data)).toBe(false)

    const now = '2026-11-14T10:05:00.000Z'
    const req = measurementRequest(pkg, 'Resting pulse', now)
    expect(schemaErrors('action', req.action)).toBeNull()
    expect(schemaErrors('follow_up', req.followUp)).toBeNull()
    expect(canWrite('medical', 'action', req.action, ctx, data)).toBe(true)
    expect(canWrite('medical', 'follow_up', req.followUp, ctx, { ...data, action: [...data.action, req.action] })).toBe(true)
    expect(req.followUp.followup_status).toBe('action_open')

    const c = commentRecords(pkg, data.follow_up, 'Please keep the daily check.', now)
    expect(c.action).toBeNull() // the open medical follow-up is updated
    expect(c.followUp.follow_up_id).toBe('sim:follow_up:pain-d20')
    expect(c.followUp.specialist_note).toContain('Please keep the daily check.')
    expect(schemaErrors('follow_up', c.followUp)).toBeNull()
    expect(canWrite('medical', 'follow_up', c.followUp, ctx, data)).toBe(true)

    const fresh = commentRecords(pkg, [], 'First comment', now)
    expect(schemaErrors('action', fresh.action)).toBeNull()
    expect(schemaErrors('follow_up', fresh.followUp)).toBeNull()
    expect(canWrite('medical', 'action', fresh.action!, ctx, data)).toBe(true)
  })

  it('cannot request a reading from a package that is not delivered', () => {
    const { data, pkgId } = withPackage('sent')
    const pkg = data.share_package.find((p) => p.share_package_id === pkgId)!
    const req = measurementRequest(pkg, 'Resting pulse', '2026-11-14T10:05:00.000Z')
    expect(canWrite('medical', 'action', req.action, ctx, data)).toBe(false)
  })
})

describe('astronaut', () => {
  it('sees everything about themselves, including their private note', () => {
    const data = loadS1WithPrivate()
    const v = filterData('astronaut', data, ctx)
    expect(v.self_report.find((s) => s.self_report_id === 'sim:self_report:pain-d20')!.private_note).toBe(SECRET)
    expect(v.decode_session.some((d) => d.subject_id !== FAHIM)).toBe(false)
  })
})

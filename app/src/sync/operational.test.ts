// FR-SCH-05 + SRS 9: the rest-window planner request travels as a share_package to the planner,
// carrying schedule facts only. Medical never sees it; only the planner can mark it reviewed.
import { describe, expect, it } from 'vitest'
import { plannerRequest } from '../features/schedule/request'
import { canWrite, filterData, readRecord } from '../store/permissions'
import { currentStatus, nextEvents, reviewEvent } from './engine'
import { operationalDraft, shareRecords } from './share'
import { FAHIM, SECRET, loadS1WithPrivate, schemaErrors } from './testkit'

const T0 = Date.parse('2026-11-14T10:00:00.000Z')
const link = { linkUp: true, oneWayDelayMin: 4 as const, accelerated: true }
const ctx = { subjectId: FAHIM }

function setup() {
  const data = loadS1WithPrivate()
  const meeting = data.mission_schedule.find((m) => m.mission_schedule_id === 'sim:mission_schedule:meeting-d27')!
  const action = plannerRequest(
    [{ item_id: meeting.mission_schedule_id, new_start: '2026-11-14T21:30:00Z', new_end: '2026-11-14T22:30:00Z' }],
    data.mission_schedule,
    0,
    420,
    '2026-11-14T10:00:00Z',
  )
  data.action.push(action)
  const draft = operationalDraft(action)
  const w = shareRecords(draft, data, link, T0)
  data.sharing_permission.push(w.permission!)
  data.share_package.push(w.pkg)
  data.sync_event.push(...w.events)
  return { data, action, draft, pkg: w.pkg, permission: w.permission! }
}

describe('operational request to the planner (FR-SCH-05)', () => {
  it('builds valid records addressed to the planner, with schedule facts only', () => {
    const { pkg, permission, action } = setup()
    expect(schemaErrors('action', action)).toBeNull()
    expect(schemaErrors('share_package', pkg)).toBeNull()
    expect(schemaErrors('sharing_permission', permission)).toBeNull()
    expect(pkg.recipient_role).toBe('planner')
    expect(pkg.previewed_record_ids).toEqual([action.action_id, 'sim:mission_schedule:meeting-d27'])
    expect(pkg.excluded_field_codes).toEqual(['self_report.private_note', 'health_records'])
    expect(pkg.summary_text).toContain('Planning meeting')
    expect(pkg.summary_text).not.toContain(SECRET)
  })

  it('asking twice for the same action gives one package', () => {
    const { data, draft } = setup()
    const again = shareRecords(draft, data, link, T0 + 5)
    expect(again.permission).toBeNull()
    expect(again.events).toHaveLength(0)
  })

  it('the planner sees it once delivered; the medical team never does', () => {
    const { data, pkg } = setup()
    data.sync_event.push(...nextEvents(pkg, data.sync_event, link, T0))
    expect(filterData('planner', data, ctx).share_package).toHaveLength(0) // sent, not delivered
    data.sync_event.push(...nextEvents(pkg, data.sync_event, link, T0 + 60_000))
    expect(currentStatus(data.sync_event, pkg.share_package_id)).toBe('delivered')

    const planner = filterData('planner', data, ctx)
    expect(planner.share_package.map((p) => p.share_package_id)).toEqual([pkg.share_package_id])
    expect(planner.sync_event.every((e) => e.share_package_id === pkg.share_package_id)).toBe(true)
    expect(planner.self_report).toHaveLength(0)
    expect(JSON.stringify(planner)).not.toContain(SECRET)

    const medical = filterData('medical', data, ctx)
    expect(medical.share_package).toHaveLength(0)
    expect(readRecord('medical', 'share_package', pkg.share_package_id, data, ctx)).toBeNull()
  })

  it('only the planner can mark it reviewed', () => {
    const { data, pkg } = setup()
    data.sync_event.push(...nextEvents(pkg, data.sync_event, link, T0))
    data.sync_event.push(...nextEvents(pkg, data.sync_event, link, T0 + 60_000))
    expect(reviewEvent(pkg, data.sync_event, 'medical', T0 + 70_000)).toBeNull()
    expect(reviewEvent(pkg, data.sync_event, 'astronaut', T0 + 70_000)).toBeNull()
    const ev = reviewEvent(pkg, data.sync_event, 'planner', T0 + 70_000)!
    expect(ev.reviewed_by_role).toBe('planner')
    expect(schemaErrors('sync_event', ev)).toBeNull()
    expect(canWrite('planner', 'sync_event', ev, ctx, data)).toBe(true)
    expect(canWrite('medical', 'sync_event', ev, ctx, data)).toBe(false)
  })

  it('refuses to wrap an action the planner does not own', () => {
    const data = loadS1WithPrivate()
    const astronautAction = data.action.find((a) => a.owner_role === 'astronaut')!
    expect(() => operationalDraft(astronautAction)).toThrow()
  })
})

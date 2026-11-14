// FR-SY-01..04, FR-SHR-02: outbox states, idempotency, link down, proof times, contract validity.
import { describe, expect, it } from 'vitest'
import type { SyncEvent } from '../data/contract'
import { DEFAULT_LINK, currentStatus, nextEvents, reviewEvent, roundTripMs, type LinkSettings } from './engine'
import { shareRecords, newPackageId, type ShareDraft } from './share'
import { FAHIM, loadS1, schemaErrors } from './testkit'
import { buildSummary } from '../features/sharing/summary'

const T0 = Date.parse('2026-11-14T10:00:00.000Z')
const fast: LinkSettings = { linkUp: true, oneWayDelayMin: 12, accelerated: true }

function draft(): ShareDraft {
  const s = buildSummary(loadS1(), FAHIM, 'Should I change my exercise plan?')
  return {
    subjectId: FAHIM,
    packageId: newPackageId(FAHIM),
    previewedRecordIds: s.previewedRecordIds,
    excludedFieldCodes: s.excludedFieldCodes,
    summaryText: s.summaryText,
  }
}

/** Applies one confirm to a tiny in-memory store, like confirmShare does with the real one. */
function confirm(store: { share_package: ReturnType<typeof shareRecords>['pkg'][]; sync_event: SyncEvent[]; sharing_permission: unknown[] }, d: ShareDraft, link: LinkSettings, now: number) {
  const w = shareRecords(d, store, link, now)
  if (w.permission) {
    store.sharing_permission.push(w.permission)
    store.share_package.push(w.pkg)
  }
  store.sync_event.push(...w.events)
  return w
}

function run(store: { share_package: ReturnType<typeof shareRecords>['pkg'][]; sync_event: SyncEvent[] }, link: LinkSettings, now: number) {
  const fresh = store.share_package.flatMap((p) => nextEvents(p, store.sync_event, link, now))
  store.sync_event.push(...fresh)
  return fresh
}

const emptyStore = () => ({ share_package: [] as ReturnType<typeof shareRecords>['pkg'][], sync_event: [] as SyncEvent[], sharing_permission: [] as unknown[] })

describe('share confirm (FR-SHR-02, FR-SY-04)', () => {
  it('three sends of the same draft give one package, one permission and one saved_locally', () => {
    const store = emptyStore()
    const d = draft()
    confirm(store, d, fast, T0)
    confirm(store, d, fast, T0 + 10)
    confirm(store, d, fast, T0 + 20)
    expect(store.share_package).toHaveLength(1)
    expect(store.sharing_permission).toHaveLength(1)
    expect(store.sync_event.filter((e) => e.sync_status === 'saved_locally')).toHaveLength(1)
  })

  it('every new record validates against the contract and uses sim:<entity>:<uuid> ids', () => {
    const store = emptyStore()
    const w = confirm(store, draft(), fast, T0)
    expect(schemaErrors('sharing_permission', w.permission)).toBeNull()
    expect(schemaErrors('share_package', w.pkg)).toBeNull()
    run(store, fast, T0)
    run(store, fast, T0 + roundTripMs(fast))
    const rev = reviewEvent(w.pkg, store.sync_event, 'medical', T0 + roundTripMs(fast) + 1000)!
    store.sync_event.push(rev)
    for (const e of store.sync_event) expect(schemaErrors('sync_event', e)).toBeNull()
    expect(w.permission!.permission_kind).toBe('share')
    expect(w.permission!.actor_role).toBe('astronaut')
    expect(w.permission!.allowed).toBe(true)
    expect(w.permission!.policy_version).toBe('policy-1.0')
    expect(w.pkg.permission_record_id).toBe(w.permission!.sharing_permission_id)
    expect(w.pkg.excluded_field_codes).toContain('self_report.private_note')
    const uuid = /^sim:(share_package|sharing_permission|sync_event):[0-9a-f-]{36}$/
    expect(w.pkg.share_package_id).toMatch(uuid)
    expect(w.permission!.sharing_permission_id).toMatch(uuid)
    for (const e of store.sync_event) expect(e.sync_event_id).toMatch(uuid)
    // one idempotency key per package version
    expect(new Set(store.sync_event.map((e) => e.message_id)).size).toBe(1)
  })
})

describe('outbox (FR-SY-01..03)', () => {
  it('moves saved_locally -> queued -> sent -> delivered after 2 x the one-way delay', () => {
    const store = emptyStore()
    const { pkg } = confirm(store, draft(), fast, T0)
    run(store, fast, T0)
    expect(currentStatus(store.sync_event, pkg.share_package_id)).toBe('sent')
    const rt = roundTripMs(fast)
    expect(rt).toBe(24_000) // 2 x 12 min, accelerated x60
    expect(run(store, fast, T0 + rt - 1)).toHaveLength(0)
    run(store, fast, T0 + rt + 300)
    const delivered = store.sync_event.find((e) => e.sync_status === 'delivered')!
    expect(delivered.occurred_at_utc).toBe(new Date(T0 + rt).toISOString()) // proof time is the due time
    expect(store.sync_event.map((e) => e.sync_status)).toEqual(['saved_locally', 'queued', 'sent', 'delivered'])
  })

  it('without acceleration the round trip is the real 24 minutes', () => {
    expect(roundTripMs({ ...fast, accelerated: false })).toBe(24 * 60_000)
    expect(roundTripMs({ ...fast, oneWayDelayMin: 0 })).toBe(0)
  })

  it('link down keeps the package queued, however many ticks pass', () => {
    const store = emptyStore()
    const down = { ...DEFAULT_LINK, linkUp: false }
    const { pkg } = confirm(store, draft(), down, T0)
    for (let i = 0; i < 5; i++) run(store, down, T0 + i * 60_000)
    expect(currentStatus(store.sync_event, pkg.share_package_id)).toBe('queued')
    expect(store.sync_event).toHaveLength(2)
    expect(store.sync_event[1].connection_available).toBe(false)
    run(store, fast, T0 + 10 * 60_000) // link back
    expect(currentStatus(store.sync_event, pkg.share_package_id)).toBe('sent')
  })

  it('state is recomputed from stored events only, so it survives a reload', () => {
    const store = emptyStore()
    const { pkg } = confirm(store, draft(), fast, T0)
    run(store, fast, T0)
    // "reload": a fresh copy of the stored events, no timers or memory carried over
    const reloaded = JSON.parse(JSON.stringify(store.sync_event)) as SyncEvent[]
    const fresh = nextEvents(pkg, reloaded, fast, T0 + roundTripMs(fast))
    expect(fresh.map((e) => e.sync_status)).toEqual(['delivered'])
  })

  it('reviewed appears only after a review event from the medical role', () => {
    const store = emptyStore()
    const { pkg } = confirm(store, draft(), fast, T0)
    for (let t = 0; t < 10; t++) run(store, fast, T0 + t * 60_000)
    expect(currentStatus(store.sync_event, pkg.share_package_id)).toBe('delivered')
    expect(store.sync_event.some((e) => e.sync_status === 'reviewed')).toBe(false)
    expect(reviewEvent(pkg, store.sync_event, 'astronaut', T0)).toBeNull()
    expect(reviewEvent(pkg, store.sync_event, 'planner', T0)).toBeNull()
    const ev = reviewEvent(pkg, store.sync_event, 'medical', T0 + 700_000)!
    expect(ev.reviewed_by_role).toBe('medical')
    store.sync_event.push(ev)
    expect(currentStatus(store.sync_event, pkg.share_package_id)).toBe('reviewed')
    expect(reviewEvent(pkg, store.sync_event, 'medical', T0 + 800_000)).toBeNull() // once only
  })

  it('a package that is not delivered cannot be marked reviewed', () => {
    const store = emptyStore()
    const { pkg } = confirm(store, draft(), fast, T0)
    run(store, fast, T0)
    expect(reviewEvent(pkg, store.sync_event, 'medical', T0 + 1)).toBeNull()
  })
})

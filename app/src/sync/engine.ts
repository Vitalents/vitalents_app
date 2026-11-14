// Simulated Earth link (FR-SY-02..04, SRS section 12). Pure functions over stored sync_event records,
// so state is recomputed after a reload instead of living in timers.
import type { SharePackage, SyncEvent } from '../data/contract'
import { buildSyncEvent } from './records'

export type SyncStatus = SyncEvent['sync_status']
export const SYNC_STATES: SyncStatus[] = ['saved_locally', 'queued', 'sent', 'delivered', 'reviewed']

export interface LinkSettings {
  linkUp: boolean
  /** One-way delay in minutes: 0, 4, 12 or 24. */
  oneWayDelayMin: 0 | 4 | 12 | 24
  /** Demo acceleration: one minute of delay passes in one second. */
  accelerated: boolean
}

export const DEFAULT_LINK: LinkSettings = { linkUp: true, oneWayDelayMin: 12, accelerated: true }

/** Round-trip time before an acknowledgement can arrive, in ms of wall-clock time. */
export function roundTripMs(s: LinkSettings): number {
  const oneWay = s.oneWayDelayMin * 60_000
  return (2 * oneWay) / (s.accelerated ? 60 : 1)
}

export function eventsFor(events: SyncEvent[], packageId: string): SyncEvent[] {
  return events
    .filter((e) => e.share_package_id === packageId)
    .sort((a, b) => SYNC_STATES.indexOf(a.sync_status) - SYNC_STATES.indexOf(b.sync_status))
}

export function currentStatus(events: SyncEvent[], packageId: string): SyncStatus | null {
  const list = eventsFor(events, packageId)
  return list.length ? list[list.length - 1].sync_status : null
}

const has = (list: SyncEvent[], s: SyncStatus) => list.some((e) => e.sync_status === s)

/**
 * Events that should exist now but don't yet. Never creates `reviewed` (that needs a review event)
 * and never duplicates a state for the same package (dedupe by package + version + status).
 */
export function nextEvents(pkg: SharePackage, events: SyncEvent[], s: LinkSettings, nowMs: number): SyncEvent[] {
  const list = eventsFor(events, pkg.share_package_id)
  const out: SyncEvent[] = []
  if (!has(list, 'saved_locally')) return out // nothing confirmed yet
  const iso = (ms: number) => new Date(ms).toISOString()
  if (!has(list, 'queued')) {
    out.push(buildSyncEvent(pkg, 'queued', iso(nowMs), s.linkUp))
  }
  if (!has(list, 'sent') && s.linkUp) {
    out.push(buildSyncEvent(pkg, 'sent', iso(nowMs), true))
    return out // delivery is evaluated on a later tick, from the stored send time
  }
  const sent = list.find((e) => e.sync_status === 'sent')
  if (sent && !has(list, 'delivered') && s.linkUp) {
    const dueMs = Date.parse(sent.occurred_at_utc) + roundTripMs(s)
    if (nowMs >= dueMs) out.push(buildSyncEvent(pkg, 'delivered', iso(Math.max(dueMs, Date.parse(sent.occurred_at_utc))), true))
  }
  return out
}

/** First send of a confirmed package. Idempotent: returns [] if this version was already saved. */
export function saveEvents(pkg: SharePackage, events: SyncEvent[], s: LinkSettings, nowMs: number): SyncEvent[] {
  if (eventsFor(events, pkg.share_package_id).some((e) => e.sync_status === 'saved_locally')) return []
  return [buildSyncEvent(pkg, 'saved_locally', new Date(nowMs).toISOString(), s.linkUp)]
}

/** The medical team marks a delivered package reviewed. Only a medical review creates `reviewed`. */
export function reviewEvent(pkg: SharePackage, events: SyncEvent[], role: string, nowMs: number): SyncEvent | null {
  if (role !== 'medical') return null
  const list = eventsFor(events, pkg.share_package_id)
  if (!has(list, 'delivered') || has(list, 'reviewed')) return null
  return buildSyncEvent(pkg, 'reviewed', new Date(nowMs).toISOString(), true, { reviewed_by_role: 'medical' })
}

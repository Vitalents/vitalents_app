// Link settings store, outbox ticker and the share/review writes. Writes go through useStore().put
// (IndexedDB first) and through assertWrite (permissions in the data layer, CLAUDE.md rule 12).
import { useEffect } from 'react'
import { create } from 'zustand'
import { useStore } from '../store/store'
import { assertWrite, type AccessContext } from '../store/permissions'
import type { Role } from '../store/role'
import { DEFAULT_LINK, nextEvents, reviewEvent, type LinkSettings } from './engine'
import { operationalDraft, shareRecords, type ShareDraft } from './share'
import type { Action, SharePackage } from '../data/contract'

const KEY = 'vitalents.link'

function load(): LinkSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_LINK, ...(JSON.parse(raw) as Partial<LinkSettings>) }
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_LINK
}

export const useLink = create<{ link: LinkSettings; setLink: (p: Partial<LinkSettings>) => void }>((set, get) => ({
  link: load(),
  setLink: (p) => {
    const link = { ...get().link, ...p }
    try {
      localStorage.setItem(KEY, JSON.stringify(link))
    } catch {
      /* ignore */
    }
    set({ link })
  },
}))

let ticking = false

/** One outbox pass: writes every sync_event that should exist by now. */
export async function tickOutbox(nowMs = Date.now()) {
  if (ticking) return
  ticking = true
  try {
    const { data, put } = useStore.getState()
    const { link } = useLink.getState()
    const fresh = data.share_package.flatMap((p) => nextEvents(p, data.sync_event, link, nowMs))
    if (fresh.length) await put('sync_event', fresh)
  } finally {
    ticking = false
  }
}

/** Advances every package's sync state once per second while mounted. Mount once, in the app shell. */
export function useOutboxTicker(intervalMs = 1000) {
  useEffect(() => {
    void tickOutbox()
    const t = setInterval(() => void tickOutbox(), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
}

const inflight = new Map<string, Promise<SharePackage>>()

/**
 * The astronaut confirms the preview: sharing_permission, share_package, then saved_locally.
 * Idempotent per draft (FR-SY-04): concurrent or repeated confirms resolve to one package.
 */
export function confirmShare(draft: ShareDraft, role: Role): Promise<SharePackage> {
  const running = inflight.get(draft.packageId)
  if (running) return running
  const job = (async () => {
    const { data, put } = useStore.getState()
    const ctx: AccessContext = { subjectId: draft.subjectId }
    const w = shareRecords(draft, data, useLink.getState().link, Date.now())
    if (w.permission) {
      assertWrite(role, 'sharing_permission', [w.permission], ctx, data)
      assertWrite(role, 'share_package', [w.pkg], ctx, data)
    }
    assertWrite(role, 'sync_event', w.events, ctx, data)
    if (w.permission) {
      await put('sharing_permission', [w.permission])
      await put('share_package', [w.pkg])
    }
    if (w.events.length) await put('sync_event', w.events)
    await tickOutbox()
    return w.pkg
  })()
  inflight.set(draft.packageId, job)
  return job.finally(() => inflight.delete(draft.packageId))
}

/**
 * FR-SCH-05: send a planner-owned schedule action to the planner as an operational request.
 * Call after the action is stored (features/schedule). Idempotent per action.
 */
export function sendOperationalRequest(action: Action, role: Role): Promise<SharePackage> {
  return confirmShare(operationalDraft(action), role)
}

/** The recipient (medical team or planner) marks a delivered package reviewed. Returns false if it is not delivered yet. */
export async function markReviewed(pkg: SharePackage, role: Role) {
  const { data, put } = useStore.getState()
  const ev = reviewEvent(pkg, data.sync_event, role, Date.now())
  if (!ev) return false
  assertWrite(role, 'sync_event', [ev], { subjectId: pkg.subject_id }, data)
  await put('sync_event', [ev])
  return true
}

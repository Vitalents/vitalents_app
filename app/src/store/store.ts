// App state: the loaded scenario bundle, mirrored from IndexedDB. Every write goes to IndexedDB first (FR-SY-01).
import { create } from 'zustand'
import { ENTITY_NAMES, type Bundle, type EntityMap, type EntityName } from '../data/contract'
import { db } from './db'
import { assertWrite } from './permissions'
import { useRole } from './role'
import { changedTables, mergeRecords } from './batches'
import { recomputeRecords, recoverUnfinishedRounds } from './recompute'
import { nextEvents, type LinkSettings } from '../sync/engine'

export type Data = { [K in EntityName]: EntityMap[K][] }
export type RecordBatch = Partial<Data>

const empty = (): Data => Object.fromEntries(ENTITY_NAMES.map((e) => [e, []])) as unknown as Data

interface State {
  ready: boolean
  error: string | null
  scenario: string
  data: Data
  fixtureUpdateAvailable: boolean
  init: () => Promise<void>
  loadScenario: (code: string) => Promise<void>
  put: <K extends EntityName>(entity: K, records: EntityMap[K][]) => Promise<void>
  putMany: (batch: RecordBatch) => Promise<void>
  advanceOutbox: (link: LinkSettings, nowMs: number) => Promise<void>
}

// Serialize mutations so a checkpoint and a delivery tick cannot overwrite each other's snapshot.
let mutations: Promise<void> = Promise.resolve()
let initialization: Promise<void> | null = null
const serialize = (job: () => Promise<void>) => {
  const next = mutations.then(job, job)
  mutations = next.catch(() => undefined)
  return next
}

async function persist(batch: RecordBatch) {
  const entities = changedTables(batch)
  if (!entities.length) return
  await db.transaction('rw', entities.map((e) => db.table(e)), async () => {
    for (const entity of entities) await db.table(entity).bulkPut(batch[entity]!)
  })
}

function inputDate(batch: RecordBatch, data: Data): string {
  const dates = [
    ...(batch.decode_session ?? []).map((r) => r.start_at_utc.slice(0, 10)),
    ...(batch.self_report ?? []).map((r) => r.report_date),
    ...(batch.sleep_record ?? []).map((r) => r.observation_date),
    ...(batch.measurement ?? []).map((r) => r.observation_date ?? r.observed_at_utc?.slice(0, 10)),
  ].filter((d): d is string => !!d)
  return dates.sort().at(-1) ?? data.daily_review.map((r) => r.review_date).sort().at(-1) ?? new Date().toISOString().slice(0, 10)
}

/** FNV-1a fingerprint of a fixture file, to notice when the demo data on the server has changed. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `${text.length}:${h.toString(16)}`
}

async function readAll(): Promise<Data> {
  const d = empty()
  for (const e of ENTITY_NAMES) (d as Record<string, unknown[]>)[e] = await db.table(e).toArray()
  return d
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  error: null,
  scenario: 'S1',
  data: empty(),
  fixtureUpdateAvailable: false,

  init: () => {
    // StrictMode and concurrent mounts must share one initial load. Otherwise
    // two first-visit calls can both queue a destructive fixture replacement.
    if (initialization) return initialization
    initialization = (async () => {
      try {
        const meta = await db.meta.get('scenario')
        if (!meta) {
          await get().loadScenario('S1')
          return
        }
        // Keep the user's record across deployments. Replacing it is an explicit Settings action.
        const saved = (await db.meta.get('bundle_hash'))?.value ?? null
        const latest = await fetch(`/data/fixtures/${meta.value}.json`, { cache: 'no-cache' })
          .then((r) => (r.ok ? r.text() : null))
          .then((t) => (t ? fingerprint(t) : null))
          .catch(() => null) // offline: keep what is on the device
        const stored = await readAll()
        const recovery = recoverUnfinishedRounds(stored)
        const recovered = mergeRecords(stored, recovery)
        const subjectId = recovered.subject_profile[0]?.subject_profile_id
        const derived = subjectId && recovery.decode_session?.length
          ? recomputeRecords(recovered, { subjectId, reviewDate: inputDate(recovery, recovered), now: new Date().toISOString(),
              triggerId: recovery.decode_session.at(-1)?.decode_session_id })
          : {}
        await persist({ ...recovery, ...derived })
        set({ data: mergeRecords(recovered, derived), scenario: meta.value, ready: true, fixtureUpdateAvailable: !!latest && latest !== saved })
      } catch (err) {
        set({ error: String(err), ready: true })
      } finally {
        initialization = null
      }
    })()
    return initialization
  },

  loadScenario: (code) => serialize(async () => {
    try {
      const res = await fetch(`/data/fixtures/${code}.json`)
      if (!res.ok) throw new Error(`Scenario ${code} not found (${res.status})`)
      const text = await res.text()
      const bundle = JSON.parse(text) as Bundle
      await db.transaction('rw', [db.meta, ...ENTITY_NAMES.map((e) => db.table(e))], async () => {
        for (const e of ENTITY_NAMES) {
          await db.table(e).clear()
          const recs = bundle[e]
          if (recs?.length) await db.table(e).bulkPut(recs)
        }
        await db.meta.put({ key: 'scenario', value: code })
        await db.meta.put({ key: 'bundle_hash', value: fingerprint(text) })
      })
      set({ data: await readAll(), scenario: code, ready: true, error: null, fixtureUpdateAvailable: false })
    } catch (err) {
      set({ error: String(err), ready: true })
    }
  }),

  put: (entity, records) => get().putMany({ [entity]: records } as RecordBatch),

  putMany: (batch) => {
    const role = useRole.getState().role
    return serialize(async () => {
      const data = get().data
      const subjectId = data.subject_profile[0]?.subject_profile_id
      if (!subjectId) throw new Error('No mission record is loaded.')
      // A batch may introduce an action and its follow-up together. Earlier entities may
      // be referenced, while ownership checks still see the existing version of each row.
      let staged = data
      for (const entity of changedTables(batch)) {
        assertWrite(role, entity, batch[entity]!, { subjectId }, staged)
        staged = mergeRecords(staged, { [entity]: batch[entity] } as RecordBatch)
      }
      const triggers = ['decode_session', 'self_report', 'sleep_record', 'measurement', 'information_status'] as const
      const derived = role === 'astronaut' && triggers.some((e) => batch[e]?.length)
        ? recomputeRecords(staged, { subjectId, reviewDate: inputDate(batch, staged), now: new Date().toISOString(),
            triggerId: batch.decode_session?.at(-1)?.decode_session_id ?? batch.self_report?.at(-1)?.self_report_id })
        : {}
      // Derived records come only from the deterministic engine, never from a caller's role override.
      const next = mergeRecords(staged, derived)
      const writes: RecordBatch = { ...batch }
      for (const entity of changedTables(derived)) {
        const ids = new Set([...(batch[entity] ?? []), ...(derived[entity] ?? [])].map((r) => (r as unknown as Record<string, unknown>)[`${entity}_id`]))
        ;(writes as Record<EntityName, unknown[]>)[entity] = next[entity].filter((r) => ids.has((r as unknown as Record<string, unknown>)[`${entity}_id`]))
      }
      await persist(writes)
      set({ data: next })
    })
  },

  // The simulated transport can advance only transitions calculated from stored packages.
  // It cannot accept arbitrary records, select a human role, or create a reviewed event.
  advanceOutbox: (link, nowMs) => serialize(async () => {
    const data = get().data
    const events = data.share_package.flatMap((p) => nextEvents(p, data.sync_event, link, nowMs))
    if (!events.length) return
    const batch = { sync_event: events }
    await persist(batch)
    set({ data: mergeRecords(data, batch) })
  }),
}))

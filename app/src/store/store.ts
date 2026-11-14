// App state: the loaded scenario bundle, mirrored from IndexedDB. Every write goes to IndexedDB first (FR-SY-01).
import { create } from 'zustand'
import { ENTITY_NAMES, type Bundle, type EntityMap, type EntityName } from '../data/contract'
import { db } from './db'

export type Data = { [K in EntityName]: EntityMap[K][] }

const empty = (): Data => Object.fromEntries(ENTITY_NAMES.map((e) => [e, []])) as unknown as Data

interface State {
  ready: boolean
  error: string | null
  scenario: string
  data: Data
  init: () => Promise<void>
  loadScenario: (code: string) => Promise<void>
  put: <K extends EntityName>(entity: K, records: EntityMap[K][]) => Promise<void>
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

  init: async () => {
    try {
      const meta = await db.meta.get('scenario')
      if (!meta) {
        await get().loadScenario('S1')
        return
      }
      set({ data: await readAll(), scenario: meta.value, ready: true })
    } catch (err) {
      set({ error: String(err), ready: true })
    }
  },

  loadScenario: async (code) => {
    try {
      const res = await fetch(`/data/fixtures/${code}.json`)
      if (!res.ok) throw new Error(`Scenario ${code} not found (${res.status})`)
      const bundle = (await res.json()) as Bundle
      await db.transaction('rw', [db.meta, ...ENTITY_NAMES.map((e) => db.table(e))], async () => {
        for (const e of ENTITY_NAMES) {
          await db.table(e).clear()
          const recs = bundle[e]
          if (recs?.length) await db.table(e).bulkPut(recs)
        }
        await db.meta.put({ key: 'scenario', value: code })
      })
      set({ data: await readAll(), scenario: code, ready: true, error: null })
    } catch (err) {
      set({ error: String(err), ready: true })
    }
  },

  put: async (entity, records) => {
    await db.entity(entity).bulkPut(records)
    const data = get().data
    const byId = new Map(data[entity].map((r) => [(r as unknown as Record<string, unknown>)[`${entity}_id`], r]))
    for (const r of records) byId.set((r as unknown as Record<string, unknown>)[`${entity}_id`], r)
    set({ data: { ...data, [entity]: [...byId.values()] } })
  },
}))

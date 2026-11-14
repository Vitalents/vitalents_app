// FR-SH-03 / FR-SY-01: public store writes enforce the active role, and updates preserve local work.
import { beforeEach, describe, expect, it, vi } from 'vitest'
const fake = vi.hoisted(() => ({ tables: new Map<string, unknown[]>(), meta: new Map<string, string>(), writes: [] as string[] }))
vi.mock('./db', () => ({ db: {
  table: (name: string) => ({
    toArray: async () => structuredClone(fake.tables.get(name) ?? []),
    clear: async () => { fake.tables.set(name, []) },
    bulkPut: async (rows: Record<string, unknown>[]) => {
      fake.writes.push(name)
      const key = `${name}_id`
      const byId = new Map((fake.tables.get(name) as Record<string, unknown>[] ?? []).map((r) => [r[key], r]))
      for (const row of rows) byId.set(row[key], structuredClone(row))
      fake.tables.set(name, [...byId.values()])
    },
  }),
  meta: { get: async (key: string) => fake.meta.has(key) ? { key, value: fake.meta.get(key) } : undefined,
    put: async ({ key, value }: { key: string; value: string }) => { fake.meta.set(key, value) } },
  transaction: async (_mode: string, _tables: unknown, work: () => Promise<void>) => work(),
} }))
// This suite isolates the persistence/permission boundary; real derivation is covered in recompute and browser tests.
vi.mock('./recompute', () => ({ recomputeRecords: () => ({}), recoverUnfinishedRounds: () => ({}) }))
import { useStore } from './store'
import { useRole } from './role'
import { PermissionError } from './permissions'
import { loadS1 } from '../sync/testkit'

beforeEach(() => {
  fake.tables.clear(); fake.meta.clear(); fake.writes.length = 0
  useRole.setState({ role: 'astronaut' })
  useStore.setState({ data: loadS1(), ready: true, error: null, fixtureUpdateAvailable: false })
  vi.unstubAllGlobals()
})

describe('guarded record writes', () => {
  it('Planner cannot mutate an astronaut action through put or a mixed batch', async () => {
    const before = structuredClone(useStore.getState().data)
    const a = before.action.find((a) => a.owner_role === 'astronaut')!
    useRole.setState({ role: 'planner' })
    await expect(useStore.getState().put('action', [{ ...a, execution_status: 'completed' }])).rejects.toBeInstanceOf(PermissionError)
    await expect(useStore.getState().putMany({ mission_schedule: before.mission_schedule, self_report: before.self_report })).rejects.toBeInstanceOf(PermissionError)
    expect(fake.writes).toEqual([])
    expect(useStore.getState().data).toEqual(before)
  })

  it('rejects taking ownership of another role’s existing action', async () => {
    const a = useStore.getState().data.action.find((a) => a.owner_role === 'medical')!
    await expect(useStore.getState().put('action', [{ ...a, owner_role: 'astronaut', execution_status: 'completed' }])).rejects.toBeInstanceOf(PermissionError)
    useRole.setState({ role: 'planner' })
    await expect(useStore.getState().put('action', [{ ...a, owner_role: 'planner', finding_id: null }])).rejects.toBeInstanceOf(PermissionError)
    expect(fake.writes).toEqual([])
  })

  it('persists the owner’s action and follow-up together', async () => {
    const data = useStore.getState().data
    const a = data.action.find((a) => a.action_id === 'sim:action:dec-d25')!
    const f = data.follow_up.find((f) => f.action_id === a.action_id)!
    await useStore.getState().putMany({ action: [{ ...a, execution_status: 'awaiting_impact_review' }], follow_up: [{ ...f, outcome_note: 'No later reading.' }] })
    expect(fake.writes.sort()).toEqual(['action', 'follow_up'])
    expect(useStore.getState().data.action.find((x) => x.action_id === a.action_id)?.execution_status).toBe('awaiting_impact_review')
  })
})

describe('fixture refresh', () => {
  it('shares one initialization and seeds only once when mounts overlap', async () => {
    const response = { ok: true, text: async () => JSON.stringify(loadS1()) }
    let release!: (value: typeof response) => void
    const pending = new Promise<typeof response>((resolve) => { release = resolve })
    const fetchFixture = vi.fn(() => pending)
    vi.stubGlobal('fetch', fetchFixture)
    useStore.setState({ ready: false })
    const first = useStore.getState().init()
    const second = useStore.getState().init()
    expect(second).toBe(first)
    await vi.waitFor(() => expect(fetchFixture).toHaveBeenCalledTimes(1))
    release(response)
    await Promise.all([first, second])
    expect(fetchFixture).toHaveBeenCalledTimes(1)
    expect(fake.writes.filter((name) => name === 'measurement')).toHaveLength(1)
    expect(useStore.getState().ready).toBe(true)
  })

  it('keeps user records and reports an available fixture update without clearing any table', async () => {
    const data = loadS1()
    const a = data.action.find((a) => a.owner_role === 'astronaut')!
    a.execution_status = 'awaiting_impact_review'
    for (const [name, rows] of Object.entries(data)) fake.tables.set(name, structuredClone(rows))
    fake.meta.set('scenario', 'S1'); fake.meta.set('bundle_hash', 'older-fixture')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify(loadS1()) }))
    useStore.setState({ ready: false })
    await useStore.getState().init()
    expect(useStore.getState().fixtureUpdateAvailable).toBe(true)
    expect(useStore.getState().data).toEqual(data)
    expect(fake.writes).toEqual([])
    expect(fake.meta.get('bundle_hash')).toBe('older-fixture')
  })
})

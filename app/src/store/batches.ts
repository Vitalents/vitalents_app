import { ENTITY_NAMES, type EntityName } from '../data/contract'
import type { Data, RecordBatch } from './store'

/** Merge by contract identity without mutating the prior snapshot. */
export function mergeRecords(data: Data, batch: RecordBatch): Data {
  const next = { ...data }
  for (const entity of ENTITY_NAMES) {
    const rows = batch[entity]
    if (!rows?.length) continue
    const key = `${entity}_id`
    const byId = new Map((data[entity] as unknown as Record<string, unknown>[]).map((r) => [r[key], r]))
    for (const row of rows as unknown as Record<string, unknown>[]) {
      if (typeof row[key] !== 'string') throw new Error(`Missing ${key}`)
      byId.set(row[key], row)
    }
    ;(next as unknown as Record<EntityName, unknown[]>)[entity] = [...byId.values()]
  }
  return next
}

export const changedTables = (batch: RecordBatch) => ENTITY_NAMES.filter((e) => batch[e]?.length)

// Local-first store (contract D-5): one IndexedDB table per entity, keyed by its primary key.
import Dexie, { type Table } from 'dexie'
import { ENTITY_NAMES, type EntityMap, type EntityName } from '../data/contract'

export interface Meta {
  key: string
  value: string
}

class VitalentsDB extends Dexie {
  meta!: Table<Meta, string>
  constructor() {
    super('vitalents')
    const stores: Record<string, string> = { meta: 'key' }
    for (const e of ENTITY_NAMES) stores[e] = `${e}_id, subject_id`
    this.version(1).stores(stores)
  }
  entity<K extends EntityName>(name: K): Table<EntityMap[K], string> {
    return this.table(name) as Table<EntityMap[K], string>
  }
}

export const db = new VitalentsDB()

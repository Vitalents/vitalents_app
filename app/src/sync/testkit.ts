// Test helpers shared by the permission, sync and summary tests. Not imported by the app.
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import { ENTITY_NAMES, type Bundle, type SelfReport } from '../data/contract'
import type { Data } from '../store/store'
import s1 from '../../public/data/fixtures/S1.json'

export const FAHIM = 'sim:crew:fahim'
export const SECRET = 'PRIVATE-NOTE-do-not-share'

export function loadS1(): Data {
  const bundle = structuredClone(s1) as unknown as Bundle
  const d = Object.fromEntries(ENTITY_NAMES.map((e) => [e, [...((bundle[e] as unknown[]) ?? [])]])) as unknown as Data
  return d
}

/** S1 plus a self-report with a private note, and one record of another subject. */
export function loadS1WithPrivate(): Data {
  const d = loadS1()
  const base = d.self_report.find((s) => s.self_report_id === 'sim:self_report:pain-d20')!
  const withNote: SelfReport = { ...base, private_note: SECRET }
  d.self_report = d.self_report.map((s) => (s.self_report_id === base.self_report_id ? withNote : s))
  const other = { ...d.mission_schedule[0], mission_schedule_id: 'sim:mission_schedule:other-crew', subject_id: 'sim:crew:other' }
  d.mission_schedule = [...d.mission_schedule, other]
  const otherDecode = { ...d.decode_session[0], decode_session_id: 'sim:decode_session:other-crew', subject_id: 'sim:crew:other' }
  d.decode_session = [...d.decode_session, otherDecode]
  return d
}

const schemas = import.meta.glob('../../../contracts/*.schema.json', { eager: true, import: 'default' }) as Record<string, { title: string }>
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validators = new Map(Object.values(schemas).map((s) => [s.title, ajv.compile(s)]))

/** Returns null when valid, otherwise the error text. */
export function schemaErrors(entity: string, record: unknown): string | null {
  const v = validators.get(entity)
  if (!v) return `no schema for ${entity}`
  return v(record) ? null : ajv.errorsText(v.errors)
}

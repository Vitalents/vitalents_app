// Typed access to content/ (owned by Amr). Text comes from these files only.
import domainsJson from '../../../content/domains.json'
import libraryJson from '../../../content/library.json'
import rulesJson from '../../../content/rules.json'
import messagesJson from '../../../content/messages.json'
import languageJson from '../../../content/language.json'
import type { Rule } from '../engine/rules'

export type DomainId = 'cognition' | 'sleep' | 'heart' | 'symptoms' | 'nutrition' | 'movement' | 'radiation'
export type Frequency = 'daily' | 'weekly' | 'as_needed'

export interface IndicatorContent {
  id: string
  name: string
  unit: string | null
  frequency: Frequency
  source_entity: string
}

export interface DomainContent {
  id: DomainId
  name: string
  region: string
  live: boolean
  sample?: boolean
  indicators: IndicatorContent[]
  why_space: string
  limits_note: string
  how_to_measure: string
  when_to_involve_specialist: string
  hazard: string
  risk: string
  sources: string[]
}

export interface LibrarySource {
  id: string
  title: string
  publisher: string
  url: string | null
}

export const DOMAINS = domainsJson.domains as DomainContent[]
export const CONTENT_IS_DRAFT = String(domainsJson.content_version).includes('draft')
export const LIBRARY = new Map((libraryJson.sources as LibrarySource[]).map((s) => [s.id, s]))
export const domainById = (id: string) => DOMAINS.find((d) => d.id === id)

/** Rules from content/rules.json (drafts until a medical owner approves each one). */
export const RULES = rulesJson.rules as unknown as Rule[]
/** Messages from Earth (content/messages.json), shown after every completed round regardless of the result. */
export const EARTH_MESSAGES = messagesJson.messages.map((m) => `${m.from}: ${m.text}`)
/** Shared wording (content/language.json). */
export const LANGUAGE = languageJson

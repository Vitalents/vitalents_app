// Consult draft logic (FR-AS-09), pure. The template builds the five sections from the share summary alone,
// so the note exists without the assistant. Every number in the template comes from the input.
import { CONSULT_KEYS, unsupportedSpans, type ConsultInput, type ConsultItem, type ConsultKey, type ConsultSections, type NumberSpan } from '../../assistant/consult'
import { INFO_STATUS } from '../sharing/strings'
import { reasonText } from '../sharing/summary'
import { C } from './strings'

export type DraftOrigin = { kind: 'assistant'; model: string } | { kind: 'template'; why: 'not_live' | 'unavailable' | 'blocked' }

export interface Draft {
  origin: DraftOrigin
  sections: ConsultSections
  /** JSON of the input it was drafted from, to tell when the summary changed afterwards. */
  basis: string
}

const line = (i: ConsultItem) => {
  const status = i.data_status && i.data_status !== 'valid' ? ` ${C.template.data(INFO_STATUS[i.data_status] ?? i.data_status, reasonText(i.reasons))}` : ''
  return `${i.date ? `${i.date}: ` : ''}${i.label}${status}`
}
const byDate = (a: ConsultItem, b: ConsultItem) => (a.date ?? '').localeCompare(b.date ?? '')

/** The five sections built directly from the summary. Deterministic; no model involved. */
export function templateSections(input: ConsultInput): ConsultSections {
  const trend = [...input.events, ...input.measurements].sort(byDate).map(line)
  const limits = [...new Set([...input.events, ...input.measurements].map((i) => i.limits).filter((l): l is string => !!l))]
  const context = [...[...input.symptoms].sort(byDate).map((s) => C.template.symptom(s.date, s.label)), ...limits.map(C.template.limits)]
  const tried = [...input.actions].sort(byDate).map(line)
  return {
    trend: trend.length ? trend.join('\n') : C.template.noTrend,
    context: context.length ? context.join('\n') : C.template.noContext,
    what_was_tried: tried.length ? tried.join('\n') : C.template.noTried,
    crew_question: input.question ?? C.template.noQuestion,
    requested_decision: input.question ? C.template.decisionWithQuestion : C.template.decision,
  }
}

/** A live draft, with the crew question restated verbatim from the input (never model-written). */
export function liveSections(sections: ConsultSections, input: ConsultInput): ConsultSections {
  return { ...sections, crew_question: input.question ?? C.template.noQuestion }
}

export type DraftCheck = Record<ConsultKey, NumberSpan[]>

/** Unsupported numbers per section of the (possibly edited) draft. */
export function checkSections(sections: ConsultSections, allowed: Set<number>): DraftCheck {
  return Object.fromEntries(CONSULT_KEYS.map((k) => [k, unsupportedSpans(sections[k], allowed)])) as DraftCheck
}

export const failingSections = (check: DraftCheck) => CONSULT_KEYS.filter((k) => check[k].length > 0)

export const originLabel = (o: DraftOrigin) => (o.kind === 'assistant' ? C.byAssistant(o.model) : C.withoutAssistant)

/**
 * The note as plain text for share_package.summary_text: titled blocks, one "- " line each, so
 * parseSummaryText in features/sharing shows it like the rest of the package.
 */
export function draftToText(draft: Pick<Draft, 'origin' | 'sections'>): string {
  const lines = (t: string) =>
    t
      .split('\n')
      .map((l) => l.trim().replace(/^-\s+/, ''))
      .filter(Boolean)
      .map((l) => `- ${l}`)
  const head = [C.packageTitle, `- ${originLabel(draft.origin)}`, `- ${C.packageReviewed}`].join('\n')
  const blocks = CONSULT_KEYS.map((k) => {
    const body = lines(draft.sections[k])
    return [C.sections[k], ...(body.length ? body : [`- ${C.template.blank}`])].join('\n')
  })
  return [head, ...blocks].join('\n\n')
}

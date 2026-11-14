// FR-MAP-05: is a domain due today according to its plan frequency? Pure: no React, no I/O.
// This is a plan state only. It is kept apart from the follow-up status and the data status
// (CLAUDE.md rule 2) and never says anything about the person, only about the measurement plan.
import type { DomainView } from './view'

/** due: the plan asks for a measurement today and none is recorded yet. done: it is recorded.
 *  not_due: the plan asks for nothing today. null: unknown, so no marker is shown (never a guess). */
export type DueState = 'due' | 'done' | 'not_due'

export interface DueIndicatorInput {
  /** From content/domains.json. Anything other than daily · weekly · as_needed is treated as unknown. */
  frequency: string | null | undefined
  /** Weekly plans only: ISO weekdays (1 = Monday … 7 = Sunday) of the mission date in UTC.
   *  TODO(question: DR-16 names `due_days[]` but content/ has none yet; confirm weekday numbering with Amr/Shaimaa) */
  due_days?: number[] | null
  /** A record exists for this indicator on the date (any data status except no_reading). */
  recordedToday: boolean
}

/** ISO weekday of a "YYYY-MM-DD" date in UTC: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

export function indicatorDue(ind: DueIndicatorInput, date: string): DueState | null {
  switch (ind.frequency) {
    case 'daily':
      return ind.recordedToday ? 'done' : 'due'
    case 'weekly': {
      // Without the plan's due days we cannot tell which day it falls on.
      if (!ind.due_days || ind.due_days.length === 0) return null
      if (!ind.due_days.includes(isoWeekday(date))) return 'not_due'
      return ind.recordedToday ? 'done' : 'due'
    }
    case 'as_needed':
      // Recorded when something happens; the plan never asks for it on a given day.
      return 'not_due'
    default:
      return null
  }
}

/** A domain is due if any indicator is still due; unknown if any indicator is unknown; done if
 *  something due today is recorded; otherwise not due. No indicators (sample domains) = unknown. */
export function domainDue(indicators: DueIndicatorInput[], date: string): DueState | null {
  if (indicators.length === 0) return null
  const states = indicators.map((i) => indicatorDue(i, date))
  if (states.includes('due')) return 'due'
  if (states.includes(null)) return null
  if (states.includes('done')) return 'done'
  return 'not_due'
}

/** Due state of a domain view built for `date` (buildDomainViews with the same review date). */
export function dueFromView(view: DomainView, date: string): DueState | null {
  if (!view.content.live) return null
  return domainDue(
    view.indicators.map((i) => ({
      frequency: i.content.frequency,
      due_days: (i.content as { due_days?: number[] | null }).due_days ?? null,
      recordedToday: i.today !== null && i.today.date === date && i.status !== 'no_reading',
    })),
    date,
  )
}

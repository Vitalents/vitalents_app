// English strings for the map feature (one file so Arabic/RTL can follow). TODO(review: Amr — merge into content/strings.ts).
import type { DueState } from '../../engine/due'

export const M = {
  /** FR-MAP-05: the measurement plan for today. Its own label, never a follow-up or data status. */
  due: { due: 'Due today', done: 'Done today', not_due: 'Not due today' } satisfies Record<DueState, string>,
  duePrefix: 'Plan',
  legendDue: 'Calendar mark: whether the plan asks for a measurement today.',
  /** FR-MAP-07 */
  sampleData: 'Sample data',
  legendSample: 'Dashed outline: sample data, nothing is measured there in this demo.',
  areas: 'Areas',
  dailyTitle: 'Your daily check is next.',
  dailyLead: 'Record how you feel, then take one Decode round.',
  dailyAction: 'Open daily check',
  dueTitle: 'Next in your measurement plan',
  dueLead: (name: string) => `${name} is due today.`,
  dueAction: 'Review this area',
  reviewTitle: 'Make time for today’s review.',
  reviewLead: 'See what was recorded, what is missing and the next step in your plan.',
  reviewAction: 'Open today’s review',
  storyTitle: 'A little closer to home',
  storyLead: 'A fictional family message for Fahim. Available whenever you want a moment from home.',
  storyAction: 'Open today’s message',
  mapTitle: 'Your areas, at a glance',
  mapLead: 'Follow-up, data quality and your measurement plan each tell a different part of the story.',
}

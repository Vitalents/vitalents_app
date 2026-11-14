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
}

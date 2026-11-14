// The only feedback write (FR-PE-02). Checked by assertWrite in the data layer, then stored as one feedback_entry.
// It touches no other table: references, rules and limits stay as they are (FR-PE-03).
import type { FeedbackEntry, Finding } from '../../data/contract'
import { assertWrite } from '../../store/permissions'
import type { Role } from '../../store/role'
import { useStore } from '../../store/store'
import { alertFeedback, type AlertValue } from './records'

export async function saveAlertRating(finding: Finding, value: AlertValue, reason: string, role: Role, now: Date | string = new Date()): Promise<FeedbackEntry> {
  const entry = alertFeedback(finding, value, reason, now)
  assertWrite(role, 'feedback_entry', [entry], { subjectId: finding.subject_id }, useStore.getState().data)
  await useStore.getState().put('feedback_entry', [entry])
  return entry
}

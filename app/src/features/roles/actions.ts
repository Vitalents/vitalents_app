// Medical-team writes (FR-SHR-03). Each one is checked by assertWrite in the data layer.
import type { Action, FollowUp, SharePackage } from '../../data/contract'
import { assertWrite } from '../../store/permissions'
import type { Role } from '../../store/role'
import { useStore } from '../../store/store'
import { SCHEMA_VERSION, newId } from '../../sync/records'
import { T } from '../sharing/strings'

const base = (pkg: SharePackage, now: string) => ({
  schema_version: SCHEMA_VERSION,
  subject_id: pkg.subject_id,
  data_origin: 'application_generated' as const,
  is_simulated: pkg.is_simulated,
  created_at_utc: now,
})

/** Pure: the action and follow-up for a reading the medical team requests. */
export function measurementRequest(pkg: SharePackage, indicatorName: string, now: string): { action: Action; followUp: FollowUp } {
  const action: Action = {
    ...base(pkg, now),
    action_id: newId(pkg.subject_id, 'action'),
    finding_id: null,
    step_category: 'complete_measurement',
    reason_text: T.medical.requestReason,
    action_text: T.medical.requestActionText(indicatorName),
    source_reference_id: null,
    owner_role: 'astronaut',
    execution_status: 'proposed',
    approval_record_id: pkg.share_package_id,
  }
  const followUp: FollowUp = {
    ...base(pkg, now),
    follow_up_id: newId(pkg.subject_id, 'follow_up'),
    action_id: action.action_id,
    followup_status: 'action_open',
    opened_at_utc: now,
    assigned_role: 'astronaut',
  }
  return { action, followUp }
}

/**
 * Pure: the comment as a follow_up specialist_note. Updates the open follow-up assigned to the
 * medical team, or opens one (with its request_review action) when there is none.
 */
export function commentRecords(pkg: SharePackage, existing: FollowUp[], text: string, now: string): { action: Action | null; followUp: FollowUp } {
  const note = `${now.slice(0, 10)} ${now.slice(11, 16)}Z: ${text.trim()}`
  const open = existing
    .filter((f) => f.subject_id === pkg.subject_id && f.assigned_role === 'medical' && f.followup_status !== 'closed')
    .sort((a, b) => b.opened_at_utc.localeCompare(a.opened_at_utc))[0]
  if (open) {
    return {
      action: null,
      followUp: {
        ...open,
        followup_status: 'under_specialist_review',
        specialist_note: open.specialist_note ? `${open.specialist_note}\n${note}` : note,
      },
    }
  }
  const action: Action = {
    ...base(pkg, now),
    action_id: newId(pkg.subject_id, 'action'),
    finding_id: null,
    step_category: 'request_review',
    reason_text: T.medical.commentReason,
    action_text: T.medical.commentActionText,
    source_reference_id: null,
    owner_role: 'medical',
    execution_status: 'accepted',
    approval_record_id: pkg.share_package_id,
  }
  return {
    action,
    followUp: {
      ...base(pkg, now),
      follow_up_id: newId(pkg.subject_id, 'follow_up'),
      action_id: action.action_id,
      followup_status: 'under_specialist_review',
      opened_at_utc: now,
      assigned_role: 'medical',
      specialist_note: note,
    },
  }
}

export async function requestMeasurement(pkg: SharePackage, indicatorName: string, role: Role) {
  const { action, followUp } = measurementRequest(pkg, indicatorName, new Date().toISOString())
  const ctx = { subjectId: pkg.subject_id }
  assertWrite(role, 'action', [action], ctx, useStore.getState().data)
  await useStore.getState().put('action', [action])
  assertWrite(role, 'follow_up', [followUp], ctx, useStore.getState().data)
  await useStore.getState().put('follow_up', [followUp])
}

export async function addComment(pkg: SharePackage, text: string, role: Role) {
  if (!text.trim()) return
  const { action, followUp } = commentRecords(pkg, useStore.getState().data.follow_up, text, new Date().toISOString())
  const ctx = { subjectId: pkg.subject_id }
  if (action) {
    assertWrite(role, 'action', [action], ctx, useStore.getState().data)
    await useStore.getState().put('action', [action])
  }
  assertWrite(role, 'follow_up', [followUp], ctx, useStore.getState().data)
  await useStore.getState().put('follow_up', [followUp])
}

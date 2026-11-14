// Confirming a share (FR-SHR-02, FR-SY-01): permission first, then the package, then `saved_locally`.
// Pure: returns the records to write. Re-confirming the same draft creates nothing new (FR-SY-04).
import type { Action, SharePackage, SharingPermission, SyncEvent } from '../data/contract'
import type { Data } from '../store/store'
import { saveEvents, type LinkSettings } from './engine'
import { buildPackage, buildPermission, newId } from './records'

export interface ShareDraft {
  subjectId: string
  /** Medical (consult summary, the default) or planner (operational request: schedule facts only). */
  recipientRole?: SharePackage['recipient_role']
  /** Fixed when the preview is shown, so a double confirm targets the same package. */
  packageId: string
  previewedRecordIds: string[]
  excludedFieldCodes: string[]
  summaryText: string
}

export const newPackageId = (subjectId: string) => newId(subjectId, 'share_package')

export interface ShareWrite {
  permission: SharingPermission | null
  pkg: SharePackage
  events: SyncEvent[]
}

export function shareRecords(draft: ShareDraft, data: Pick<Data, 'share_package' | 'sync_event'>, link: LinkSettings, nowMs: number): ShareWrite {
  const existing = data.share_package.find((p) => p.share_package_id === draft.packageId)
  if (existing) return { permission: null, pkg: existing, events: saveEvents(existing, data.sync_event, link, nowMs) }
  const now = new Date(nowMs).toISOString()
  const permission = buildPermission(draft.subjectId, draft.packageId, now)
  const pkg = buildPackage({
    subjectId: draft.subjectId,
    packageId: draft.packageId,
    permissionId: permission.sharing_permission_id,
    previewedRecordIds: draft.previewedRecordIds,
    excludedFieldCodes: draft.excludedFieldCodes,
    summaryText: draft.summaryText,
    version: 1,
    now,
    recipientRole: draft.recipientRole,
  })
  return { permission, pkg, events: saveEvents(pkg, data.sync_event, link, nowMs) }
}

/** Field codes left out of every operational request: the planner gets the schedule change only. */
export const OPERATIONAL_EXCLUDED = ['self_report.private_note', 'health_records'] as const

/**
 * FR-SCH-05: an operational request to the planner, wrapping a planner-owned schedule action.
 * Only the action and the schedule item it moves are previewed; its text is schedule facts only.
 * The package id is derived from the action, so asking twice gives one package.
 */
export function operationalDraft(action: Action): ShareDraft {
  if (action.owner_role !== 'planner') throw new Error(`Operational requests carry planner actions only (${action.action_id})`)
  const ids = [action.action_id]
  if (action.source_reference_id?.includes(':mission_schedule:')) ids.push(action.source_reference_id)
  const [realm] = action.action_id.split(':')
  return {
    subjectId: action.subject_id,
    recipientRole: 'planner',
    packageId: `${realm}:share_package:req-${action.action_id.split(':').slice(2).join(':')}`,
    previewedRecordIds: ids,
    excludedFieldCodes: [...OPERATIONAL_EXCLUDED],
    summaryText: `Operational request\n- ${action.action_text}\n- ${action.reason_text}`,
  }
}

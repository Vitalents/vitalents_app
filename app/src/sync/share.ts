// Confirming a share (FR-SHR-02, FR-SY-01): permission first, then the package, then `saved_locally`.
// Pure: returns the records to write. Re-confirming the same draft creates nothing new (FR-SY-04).
import type { SharePackage, SharingPermission, SyncEvent } from '../data/contract'
import type { Data } from '../store/store'
import { saveEvents, type LinkSettings } from './engine'
import { buildPackage, buildPermission, newId } from './records'

export interface ShareDraft {
  subjectId: string
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
  })
  return { permission, pkg, events: saveEvents(pkg, data.sync_event, link, nowMs) }
}

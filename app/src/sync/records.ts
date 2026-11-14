// Builders for share/sync records. Every record validates against contracts/ (see sync.test.ts).
import type { SharePackage, SharingPermission, SyncEvent } from '../data/contract'

export const SCHEMA_VERSION = '1.0'
export const POLICY_VERSION = 'policy-1.0'

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`

export const realmOf = (subjectId: string) => subjectId.split(':', 1)[0]
export const newId = (subjectId: string, entity: string) => `${realmOf(subjectId)}:${entity}:${uuid()}`
const isSim = (subjectId: string) => realmOf(subjectId) === 'sim'

/** Idempotency key for one package version: resending the same version reuses it. */
export const messageIdFor = (pkg: Pick<SharePackage, 'share_package_id' | 'package_version'>) =>
  `msg-${pkg.share_package_id.split(':').pop()}-v${pkg.package_version}`

/** Small stable hash of what was previewed, so a changed package is detectable. */
export function revisionHash(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return `fnv1a-${(h >>> 0).toString(16).padStart(8, '0')}`
}

export function buildPermission(subjectId: string, resourceId: string, now: string): SharingPermission {
  return {
    sharing_permission_id: newId(subjectId, 'sharing_permission'),
    schema_version: SCHEMA_VERSION,
    subject_id: subjectId,
    data_origin: 'application_generated',
    is_simulated: isSim(subjectId),
    created_at_utc: now,
    actor_role: 'astronaut',
    resource_kind: 'share_package',
    resource_id: resourceId,
    permission_kind: 'share',
    allowed: true,
    policy_version: POLICY_VERSION,
    consent_basis: 'Astronaut confirmed the share preview',
    permission_time_utc: now,
  }
}

export function buildPackage(args: {
  subjectId: string
  packageId: string
  permissionId: string
  previewedRecordIds: string[]
  excludedFieldCodes: string[]
  summaryText: string
  version: number
  now: string
}): SharePackage {
  return {
    share_package_id: args.packageId,
    schema_version: SCHEMA_VERSION,
    subject_id: args.subjectId,
    data_origin: 'application_generated',
    is_simulated: isSim(args.subjectId),
    created_at_utc: args.now,
    recipient_role: 'medical',
    previewed_record_ids: args.previewedRecordIds,
    excluded_field_codes: args.excludedFieldCodes,
    summary_text: args.summaryText,
    permission_record_id: args.permissionId,
    package_version: args.version,
    prepared_at_utc: args.now,
  }
}

export function buildSyncEvent(
  pkg: SharePackage,
  status: SyncEvent['sync_status'],
  occurredAt: string,
  connection: boolean,
  extra: Partial<Pick<SyncEvent, 'retry_number' | 'reviewed_by_role'>> = {},
): SyncEvent {
  return {
    sync_event_id: newId(pkg.subject_id, 'sync_event'),
    schema_version: SCHEMA_VERSION,
    subject_id: pkg.subject_id,
    data_origin: 'application_generated',
    is_simulated: pkg.is_simulated,
    created_at_utc: new Date().toISOString(),
    share_package_id: pkg.share_package_id,
    sync_status: status,
    occurred_at_utc: occurredAt,
    message_id: messageIdFor(pkg),
    revision_hash: revisionHash(pkg.summary_text + pkg.previewed_record_ids.join(',')),
    connection_available: connection,
    retry_number: extra.retry_number ?? 0,
    reviewed_by_role: extra.reviewed_by_role ?? null,
  }
}

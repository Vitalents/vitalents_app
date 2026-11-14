// Role-based visibility, enforced in the data layer (SRS section 9, CLAUDE.md rule 9 and 12).
// Screens must read through filterData() or readRecord(); hiding a button is never the control.
import { ENTITY_NAMES, type EntityMap, type EntityName, type FeedbackEntry, type Finding, type SelfReport, type SharePackage, type SyncEvent } from '../data/contract'
import type { Data } from './store'
import type { Role } from './role'

export interface AccessContext {
  /** The astronaut whose record is open (e.g. sim:crew:fahim). Other subjects are never visible. */
  subjectId: string
}

export interface AuditEntry {
  at: string
  role: Role
  op: 'read' | 'write'
  entity: EntityName
  record_id: string
  allowed: false
}

/** In-memory audit of refused reads and writes. Holds ids only, never content. */
export const auditLog: AuditEntry[] = []

const refuse = (role: Role, op: AuditEntry['op'], entity: EntityName, id: string) =>
  auditLog.push({ at: new Date().toISOString(), role, op, entity, record_id: id, allowed: false })

const SYNC_ORDER = ['saved_locally', 'queued', 'sent', 'delivered', 'reviewed'] as const

const pkOf = (entity: EntityName, rec: unknown) => String((rec as Record<string, unknown>)[`${entity}_id`] ?? '')
const subjectOf = (rec: unknown) => (rec as { subject_id?: string }).subject_id

/** Entities a planner never sees, whatever the record says. */
const PLANNER_NEVER: EntityName[] = [
  'self_report', 'decode_session', 'decode_response_event', 'measurement', 'sleep_record', 'finding',
  'information_status', 'personal_reference', 'daily_review', 'follow_up', 'share_package', 'sync_event',
  'knowledge_gap', 'feedback_entry', 'sharing_permission',
]

/** Feedback the medical team sees: ratings only (FR-PE-02). Display preferences and source problems stay with the astronaut. */
const MEDICAL_FEEDBACK: FeedbackEntry['feedback_kind'][] = ['action_usefulness', 'alert_usefulness']

/** Feedback the astronaut may write. Every kind is a log entry; none of them changes a reference, limit or rule (FR-PE-03). */
const ASTRONAUT_FEEDBACK: FeedbackEntry['feedback_kind'][] = ['action_usefulness', 'alert_usefulness', 'display_preference', 'source_problem']

const realmOf = (id: string) => id.split(':')[0]

/** Latest sync status per share package, from its sync_event records. */
export function packageStatus(events: SyncEvent[], packageId: string): SyncEvent['sync_status'] | null {
  let best = -1
  for (const e of events) if (e.share_package_id === packageId) best = Math.max(best, SYNC_ORDER.indexOf(e.sync_status))
  return best < 0 ? null : SYNC_ORDER[best]
}

/** Packages that have reached their recipient (delivered or reviewed). Medical by default. */
export function deliveredPackages(
  data: Pick<Data, 'share_package' | 'sync_event'>,
  subjectId: string,
  recipient: SharePackage['recipient_role'] = 'medical',
): SharePackage[] {
  return data.share_package.filter((p) => {
    if (p.subject_id !== subjectId || p.recipient_role !== recipient) return false
    const s = packageStatus(data.sync_event, p.share_package_id)
    return s === 'delivered' || s === 'reviewed'
  })
}

interface Visibility {
  sharedIds: Set<string>
  medicalActionIds: Set<string>
  /** Operational-request packages delivered to the planner (schedule changes only). */
  plannerPackageIds: Set<string>
}

function visibility(data: Data, ctx: AccessContext): Visibility {
  const pkgs = deliveredPackages(data, ctx.subjectId)
  const sharedIds = new Set<string>()
  for (const p of pkgs) {
    sharedIds.add(p.share_package_id)
    for (const id of p.previewed_record_ids) sharedIds.add(id)
  }
  const medicalActionIds = new Set(
    data.follow_up.filter((f) => f.subject_id === ctx.subjectId && f.assigned_role === 'medical').map((f) => f.action_id),
  )
  const plannerPackageIds = new Set(deliveredPackages(data, ctx.subjectId, 'planner').map((p) => p.share_package_id))
  return { sharedIds, medicalActionIds, plannerPackageIds }
}

function decide(role: Role, entity: EntityName, rec: unknown, ctx: AccessContext, v: Visibility): boolean {
  const subject = subjectOf(rec)
  if (subject !== undefined && subject !== ctx.subjectId) return false // never another person's record
  if (role === 'astronaut') return true
  const id = pkOf(entity, rec)
  if (role === 'planner') {
    if (entity === 'share_package') return v.plannerPackageIds.has(id)
    if (entity === 'sync_event') return v.plannerPackageIds.has(String((rec as SyncEvent).share_package_id ?? ''))
    if (PLANNER_NEVER.includes(entity)) return false
    if (entity === 'action') {
      const a = rec as EntityMap['action']
      return a.owner_role === 'planner' && a.finding_id == null
    }
    if (entity === 'mission_schedule') return true
    return subject === undefined && entity !== 'rule_definition' // shared reference data only (scenario, library)
  }
  // medical
  if (entity === 'feedback_entry') return MEDICAL_FEEDBACK.includes((rec as FeedbackEntry).feedback_kind)
  if (entity === 'follow_up') return (rec as EntityMap['follow_up']).assigned_role === 'medical' || v.sharedIds.has(id)
  if (entity === 'action') return v.medicalActionIds.has(id) || v.sharedIds.has(id)
  if (entity === 'sync_event') return v.sharedIds.has(String((rec as SyncEvent).share_package_id ?? ''))
  if (entity === 'mission_schedule') return false
  if (subject === undefined) return true // library, rules, scenario metadata
  return v.sharedIds.has(id)
}

/** Copy that removes fields a role must never see even when the record is shared. */
function redact(role: Role, entity: EntityName, rec: unknown): unknown {
  if (role !== 'astronaut' && entity === 'self_report' && (rec as SelfReport).private_note != null) {
    return { ...(rec as SelfReport), private_note: null }
  }
  return rec
}

/** Can this role read this record? Pure; does not log. */
export function canRead(role: Role, entity: EntityName, rec: unknown, ctx: AccessContext, data: Data): boolean {
  return decide(role, entity, rec, ctx, visibility(data, ctx))
}

/** Everything this role may see, already redacted. Use this for every screen. */
export function filterData(role: Role, data: Data, ctx: AccessContext): Data {
  const v = visibility(data, ctx)
  const out = {} as Record<string, unknown[]>
  for (const e of ENTITY_NAMES) {
    out[e] = (data[e] as unknown[]).filter((r) => decide(role, e, r, ctx, v)).map((r) => redact(role, e, r))
  }
  return out as unknown as Data
}

/**
 * Explicit read of one record (e.g. opening a link). Refusals are logged with ids only.
 * Returns the redacted record, or null when refused or not found.
 */
export function readRecord<K extends EntityName>(role: Role, entity: K, id: string, data: Data, ctx: AccessContext): EntityMap[K] | null {
  const rec = (data[entity] as EntityMap[K][]).find((r) => pkOf(entity, r) === id)
  if (!rec) return null
  if (!canRead(role, entity, rec, ctx, data)) {
    refuse(role, 'read', entity, id)
    return null
  }
  return redact(role, entity, rec) as EntityMap[K]
}

/**
 * May this role create or update this record? Pure; does not log.
 * astronaut: own record, except marking a package reviewed. Feedback targets a record in the same realm.
 * medical: mark a delivered package reviewed; comment on its own follow-ups; request a reading
 *   (complete_measurement action for the astronaut, linked to a delivered package, plus its follow-up).
 * planner: actions it owns and schedule items. Nothing else.
 * Feedback (FR-PE-02/03) is written by the astronaut only; medical and planner never write it.
 */
export function canWrite(role: Role, entity: EntityName, rec: unknown, ctx: AccessContext, data: Data): boolean {
  const subject = subjectOf(rec)
  if (subject !== undefined && subject !== ctx.subjectId) return false
  if (role === 'astronaut') {
    if (entity === 'action') {
      const a = rec as EntityMap['action']
      const before = data.action.find((x) => x.action_id === a.action_id)
      if (before) return before.owner_role === 'astronaut' && a.owner_role === before.owner_role
    }
    if (entity === 'follow_up') {
      const f = rec as EntityMap['follow_up']
      const before = data.follow_up.find((x) => x.follow_up_id === f.follow_up_id)
      if (before) return before.assigned_role === 'astronaut' && f.assigned_role === before.assigned_role
    }
    if (entity === 'sync_event') return (rec as SyncEvent).sync_status !== 'reviewed'
    if (entity === 'feedback_entry') {
      const f = rec as FeedbackEntry
      return ASTRONAUT_FEEDBACK.includes(f.feedback_kind) && realmOf(f.target_record_id) === realmOf(ctx.subjectId)
    }
    return true
  }
  if (entity === 'feedback_entry') return false
  const v = visibility(data, ctx)
  if (role === 'planner') {
    if (entity === 'mission_schedule') return true
    if (entity === 'sync_event') {
      const e = rec as SyncEvent
      return e.sync_status === 'reviewed' && v.plannerPackageIds.has(String(e.share_package_id ?? ''))
    }
    if (entity === 'action') {
      const a = rec as EntityMap['action']
      const before = data.action.find((x) => x.action_id === a.action_id)
      return a.owner_role === 'planner' && a.finding_id == null && (!before || (before.owner_role === 'planner' && before.finding_id == null))
    }
    return false
  }
  // medical
  if (entity === 'sync_event') {
    const e = rec as SyncEvent
    return e.sync_status === 'reviewed' && v.sharedIds.has(String(e.share_package_id ?? ''))
  }
  if (entity === 'action') {
    const a = rec as EntityMap['action']
    const before = data.action.find((x) => x.action_id === a.action_id)
    if (before?.owner_role === 'medical') return a.owner_role === 'medical' && before.subject_id === a.subject_id
    if (before) return false
    const fromPackage = !!a.approval_record_id && v.sharedIds.has(a.approval_record_id)
    if (a.step_category === 'complete_measurement') return a.owner_role === 'astronaut' && fromPackage
    if (a.step_category === 'request_review') return a.owner_role === 'medical' && fromPackage
    return false
  }
  if (entity === 'follow_up') {
    const f = rec as EntityMap['follow_up']
    const before = data.follow_up.find((x) => x.follow_up_id === f.follow_up_id)
    if (before && before.action_id !== f.action_id) return false
    const a = data.action.find((x) => x.action_id === f.action_id)
    if (f.assigned_role === 'medical') {
      if (before) return before.assigned_role === 'medical'
      return !!a && a.owner_role === 'medical' && !!a.approval_record_id && v.sharedIds.has(a.approval_record_id)
    }
    // a follow-up for the astronaut on a reading the medical team requested
    return f.assigned_role === 'astronaut' && !!a && a.step_category === 'complete_measurement' && !!a.approval_record_id && v.sharedIds.has(a.approval_record_id)
  }
  return false
}

export class PermissionError extends Error {
  constructor(role: Role, entity: EntityName, id: string) {
    super(`${role} may not write ${entity} ${id}`)
    this.name = 'PermissionError'
  }
}

/** Throws (and logs ids only) unless every record may be written by this role. */
export function assertWrite<K extends EntityName>(role: Role, entity: K, records: EntityMap[K][], ctx: AccessContext, data: Data) {
  for (const r of records) {
    if (!canWrite(role, entity, r, ctx, data)) {
      const id = pkOf(entity, r)
      refuse(role, 'write', entity, id)
      throw new PermissionError(role, entity, id)
    }
  }
}

/** One alert rating as the rule-review queue sees it: rule metadata, the rating and its reason. Nothing else of the finding. */
export interface RuleReviewItem {
  feedback_entry_id: string
  finding_id: string
  rule_id: string
  rule_version: string
  finding_kind: Finding['finding_kind']
  rated_at_utc: string
  rating: number | null
  reason: string | null
}

/**
 * The rule-review queue's input (FR-PE-02). Medical and astronaut only; the planner gets nothing and the refusal is logged.
 * Reads the rated finding for its rule id and version only, so an unshared finding's text and evidence stay hidden.
 * Only the latest rating per finding counts.
 */
export function ruleReviewItems(role: Role, data: Data, ctx: AccessContext): RuleReviewItem[] {
  if (role === 'planner') {
    refuse(role, 'read', 'feedback_entry', 'rule-review-queue')
    return []
  }
  const latest = new Map<string, FeedbackEntry>()
  for (const f of filterData(role, data, ctx).feedback_entry) {
    if (f.feedback_kind !== 'alert_usefulness') continue
    const prev = latest.get(f.target_record_id)
    if (!prev || f.created_at_utc > prev.created_at_utc) latest.set(f.target_record_id, f)
  }
  const out: RuleReviewItem[] = []
  for (const f of latest.values()) {
    const finding = data.finding.find((x) => x.finding_id === f.target_record_id)
    if (!finding || finding.subject_id !== ctx.subjectId) continue
    out.push({
      feedback_entry_id: f.feedback_entry_id,
      finding_id: finding.finding_id,
      rule_id: finding.rule_id,
      rule_version: finding.rule_version,
      finding_kind: finding.finding_kind,
      rated_at_utc: f.created_at_utc,
      rating: f.rating ?? null,
      reason: f.comment ?? null,
    })
  }
  return out
}

/** Private note text is visible to the astronaut only, everywhere. */
export function privateNoteFor(role: Role, rec: SelfReport): string | null {
  return role === 'astronaut' ? rec.private_note ?? null : null
}

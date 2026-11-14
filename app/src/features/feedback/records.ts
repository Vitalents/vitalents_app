// Feedback and personalization (SRS 5.10, FR-PE-01..04). Pure functions over contract records.
// Nothing here writes a personal_reference, a rule or a limit: feedback is a log entry only (FR-PE-03, CLAUDE.md rule 5).
import { DOMAINS } from '../../content/content'
import type { Action, FeedbackEntry, Finding, FollowUp, KnowledgeGap } from '../../data/contract'
import { indexRecords, indicatorOf, infoStatusOf, type AnyRecord, type DataSet } from '../../engine/view'
import type { RuleReviewItem } from '../../store/permissions'
import type { Data } from '../../store/store'

/** Categorical scale (CONTRACT_P0 section 5), stored like action usefulness: 1 = useful, 0 = not useful / false alarm. */
export const ALERT = { useful: 1, false_alarm: 0 } as const
export type AlertValue = keyof typeof ALERT

const utc = (d: Date | string) => new Date(d).toISOString()
const realmOf = (id: string) => id.split(':')[0]
const keyOf = (id: string) => id.split(':').slice(2).join(':')

/**
 * FR-PE-02: one alert rating as a feedback_entry. A false alarm goes to the rule-review queue
 * (requires_specialist_review); it never edits the rule, its limits or any reference.
 */
export function alertFeedback(finding: Finding, value: AlertValue, reason: string, now: Date | string): FeedbackEntry {
  const at = utc(now)
  const note = value === 'false_alarm' ? reason.trim().slice(0, 500) || null : null
  return {
    feedback_entry_id: `${realmOf(finding.finding_id)}:feedback_entry:alert-${keyOf(finding.finding_id)}-${at.replace(/[-:.TZ]/g, '')}`,
    schema_version: '1.0',
    subject_id: finding.subject_id,
    data_origin: 'application_generated',
    is_simulated: finding.is_simulated,
    created_at_utc: at,
    target_record_id: finding.finding_id,
    feedback_kind: 'alert_usefulness',
    rating: ALERT[value],
    comment: note,
    requires_specialist_review: value === 'false_alarm',
  }
}

/** The newest feedback of one kind for one target, or null. Earlier entries stay in the log. */
export function latestFeedback(entries: FeedbackEntry[], targetId: string, kind: FeedbackEntry['feedback_kind']): FeedbackEntry | null {
  let best: FeedbackEntry | null = null
  for (const e of entries) {
    if (e.target_record_id !== targetId || e.feedback_kind !== kind) continue
    if (!best || e.created_at_utc > best.created_at_utc) best = e
  }
  return best
}

// ---------- FR-PE-01 tried-actions log ----------

/** Steps the astronaut took. Proposed, deferred, accepted-but-not-started and declined steps were not tried. */
const TRIED: Action['execution_status'][] = ['in_progress', 'completed', 'awaiting_impact_review', 'unable']

export interface Afterwards {
  /** Same kind of reading as the finding's evidence, first one on or after the follow-up date. */
  record: AnyRecord
  status: string
  reasons: string[]
}

export interface TriedEntry {
  action: Action
  followUp: FollowUp | null
  dueUtc: string | null
  /** Kinds of reading this step is looked at with (from the finding's supporting records). */
  kinds: number
  afterwards: Afterwards[]
  /** 1 useful, 0 not useful, null not rated. */
  rating: number | null
}

const kindOf = (r: AnyRecord) => `${r.entity}:${indicatorOf(r) ?? ''}`

/**
 * FR-PE-01: what was tried, its status, the readings observed afterwards and the astronaut's rating.
 * "Afterwards" means only "recorded later"; it is never presented as an effect of the step.
 * Takes data already filtered by the permission layer.
 */
export function triedActions(data: Data): TriedEntry[] {
  const ds = data as unknown as DataSet
  const index = indexRecords(ds).filter((r) => r.entity !== 'personal_reference')
  const byId = new Map(index.map((r) => [r.id, r]))
  const fuOf = new Map<string, FollowUp>()
  for (const f of [...data.follow_up].sort((a, b) => a.opened_at_utc.localeCompare(b.opened_at_utc))) fuOf.set(f.action_id, f)

  return data.action
    .filter((a) => a.owner_role === 'astronaut' && TRIED.includes(a.execution_status))
    .map((a) => {
      const followUp = fuOf.get(a.action_id) ?? null
      const dueUtc = followUp?.next_review_due_utc ?? a.follow_up_due_utc ?? null
      const finding = data.finding.find((f) => f.finding_id === a.finding_id)
      const kinds = new Set<string>()
      for (const id of finding?.supporting_record_ids ?? []) {
        const r = byId.get(id)
        if (r) kinds.add(kindOf(r))
      }
      const afterwards: Afterwards[] = []
      if (dueUtc) {
        const day = dueUtc.slice(0, 10)
        for (const k of kinds) {
          const next = index.filter((r) => kindOf(r) === k && r.date >= day).sort((x, y) => x.date.localeCompare(y.date) || x.id.localeCompare(y.id))[0]
          if (next) afterwards.push({ record: next, ...infoStatusOf(ds, next.id) })
        }
      }
      const fb = latestFeedback(data.feedback_entry, a.action_id, 'action_usefulness')
      const rating = fb ? fb.rating ?? null : a.feedback_rating ?? null
      return { action: a, followUp, dueUtc, kinds: kinds.size, afterwards, rating }
    })
    .sort((x, y) => (y.action.completed_at_utc ?? y.dueUtc ?? '').localeCompare(x.action.completed_at_utc ?? x.dueUtc ?? ''))
}

// ---------- FR-PE-02 rule-review queue ----------

export interface RuleGroup {
  rule_id: string
  rule_version: string
  falseAlarms: RuleReviewItem[]
  usefulCount: number
}

/** Latest rating per finding, grouped by rule id + version. Only groups with at least one false alarm are queued. */
export function ruleGroups(items: RuleReviewItem[]): RuleGroup[] {
  const groups = new Map<string, RuleGroup>()
  for (const it of items) {
    const key = `${it.rule_id}@${it.rule_version}`
    const g = groups.get(key) ?? { rule_id: it.rule_id, rule_version: it.rule_version, falseAlarms: [], usefulCount: 0 }
    if (it.rating === ALERT.false_alarm) g.falseAlarms.push(it)
    else if (it.rating === ALERT.useful) g.usefulCount += 1
    groups.set(key, g)
  }
  return [...groups.values()]
    .filter((g) => g.falseAlarms.length > 0)
    .map((g) => ({ ...g, falseAlarms: [...g.falseAlarms].sort((a, b) => b.rated_at_utc.localeCompare(a.rated_at_utc)) }))
    .sort((a, b) => b.falseAlarms.length - a.falseAlarms.length || a.rule_id.localeCompare(b.rule_id))
}

// ---------- FR-PE-04 knowledge-gap log ----------

/** A source cited by more domains than this is a general source and does not point to one domain. */
const SPECIFIC = 2

/**
 * Domains whose content cites one of the sources searched (knowledge_gap has no domain field).
 * `general` is true when the only links are general sources cited across many domains.
 */
export function gapDomains(gap: KnowledgeGap): { names: string[]; general: boolean } {
  const ids = gap.retrieved_source_ids ?? []
  const citing = (id: string) => DOMAINS.filter((d) => d.sources.includes(id))
  const specific = ids.filter((id) => citing(id).length > 0 && citing(id).length <= SPECIFIC)
  const names = DOMAINS.filter((d) => d.sources.some((s) => specific.includes(s))).map((d) => d.name)
  return { names, general: names.length === 0 && ids.some((id) => citing(id).length > SPECIFIC) }
}

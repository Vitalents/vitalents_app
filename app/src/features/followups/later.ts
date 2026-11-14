// Is there a reading after the action was done? Used by "Mark done" (FR-FU-06). Descriptive only.
import type { Action, DecodeSession, Finding, PersonalReference } from '../../data/contract'
import { compareToReference } from '../../engine/reference'
import type { LaterReading } from './records'

interface Data { finding: Finding[]; decode_session: DecodeSession[]; personal_reference: PersonalReference[]; information_status: { record_ref: string; status: string }[] }

/** Looks only at Decode for now; other indicators return null so the action stays awaiting_impact_review.
 * TODO(question: Shaimaa — which later readings count for sleep and pulse steps?) */
export function laterReading(d: Data, a: Action, after: string): LaterReading {
  const f = d.finding.find((x) => x.finding_id === a.finding_id)
  if (!f || !f.supporting_record_ids.some((id) => id.includes(':decode_session:'))) return null
  const bad = new Set(d.information_status.filter((s) => s.status !== 'valid').map((s) => s.record_ref))
  const next = d.decode_session
    .filter((s) => !s.is_practice && s.start_at_utc > after && !bad.has(s.decode_session_id))
    .sort((x, y) => x.start_at_utc.localeCompare(y.start_at_utc))[0]
  const ref = d.personal_reference.filter((p) => p.metric_code === 'decode_correct_count').sort((x, y) => y.created_at_utc.localeCompare(x.created_at_utc))[0]
  if (!next || !ref) return null
  const c = compareToReference({ value: next.correct_count, reference: { ...ref, range_low: ref.range_low ?? null, range_high: ref.range_high ?? null } })
  if (c.position === 'not_comparable') return null
  return { position: c.position === 'within_range' ? 'within' : 'outside', record_id: next.decode_session_id }
}

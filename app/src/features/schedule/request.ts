// FR-SCH-05: choosing an alternative creates an operational request to the planner with the schedule change only.
// TODO(Inc 5 share_package): also emit a share_package of kind operational_request once WP-05 lands; today it is an action.
import type { Action, MissionSchedule } from '../../data/contract'
import type { ScheduleChange } from '../../engine/schedule'
import { fmtMinutes } from '../followups/strings'

const hm = (iso: string) => iso.slice(11, 16)
const utc = (d: Date | string) => new Date(d).toISOString().replace('.000Z', 'Z')

export function describeChange(c: ScheduleChange, item: MissionSchedule): string {
  return `Move "${item.activity_label}" from ${hm(item.start_at)}–${hm(item.end_at)} to ${hm(c.new_start)}–${hm(c.new_end)} UTC`
}

/** Only schedule facts go in: item labels, times and rest-opportunity minutes. No finding, no health record, no reason from the record. */
export function plannerRequest(
  changes: ScheduleChange[], items: MissionSchedule[], before: number, after: number, now: Date | string,
): Action {
  if (!changes.length) throw new Error('No change to request')
  const byId = new Map(items.map((i) => [i.mission_schedule_id, i]))
  const first = byId.get(changes[0].item_id)
  if (!first) throw new Error(`Unknown schedule item ${changes[0].item_id}`)
  const [realm] = first.mission_schedule_id.split(':')
  const key = first.mission_schedule_id.split(':').slice(2).join(':')
  const text = changes.map((c) => describeChange(c, byId.get(c.item_id) as MissionSchedule)).join('; ')
  return {
    action_id: `${realm}:action:sched-${key}-${utc(now).replace(/[-:TZ]/g, '').slice(0, 12)}`,
    schema_version: '1.0', subject_id: first.subject_id, data_origin: 'application_generated', is_simulated: first.is_simulated,
    created_at_utc: utc(now), finding_id: null, step_category: 'approved_plan_step',
    reason_text: `Schedule request: keeps the rest window clear (${fmtMinutes(before)} → ${fmtMinutes(after)} of continuous rest opportunity).`,
    action_text: `${text}.`,
    source_reference_id: first.mission_schedule_id, owner_role: 'planner', execution_status: 'proposed',
    scheduled_for_utc: changes[0].new_start, completed_at_utc: null, rejection_reason: null,
    follow_up_due_utc: null, approval_record_id: null, feedback_rating: null,
  }
}

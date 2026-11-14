// English UI strings for Act and follow (one file so Arabic/RTL can follow). TODO(review: Amr — merge into content/strings.ts).
export const T = {
  followTitle: 'Plan & follow-ups',
  followLead: 'Each step shows why it was offered, who decides, and when it is looked at again.',
  sectionOpen: 'Open',
  sectionEarlier: 'Earlier',
  emptyOpen: 'No open follow-up.',
  plannerLead: 'Operational requests only. Health records are not shared with this role.',
  reason: 'Why offered',
  owner: 'Decided by',
  status: 'Step status',
  due: 'Follow-up date',
  source: 'Source',
  noDate: 'Not set',
  followPrefix: 'Follow-up',
  outcome: 'Result',
  accept: 'Accept',
  decline: 'Decline',
  declineReason: 'Reason (optional)',
  confirmDecline: 'Decline step',
  cancel: 'Cancel',
  start: 'Mark in progress',
  done: 'Mark done',
  unable: "Couldn't do it",
  unableReason: 'What got in the way? (optional)',
  confirmUnable: 'Save',
  openSchedule: 'Compare schedule options',
  rateQ: 'Was this step useful to you?',
  useful: 'Useful',
  notUseful: 'Not useful',
  rated: (v: string) => `You rated this step: ${v}. Ratings never change your reference or the rules.`,
  declinedWith: (r: string | null) => (r ? `Declined: “${r}”` : 'Declined, no reason given'),
  unableWith: (r: string | null) => (r ? `Couldn't do it: “${r}”` : "Couldn't do it"),
  waitingNote: 'Stays open until a later reading is recorded.',
  ownerLabel: { astronaut: 'You', medical: 'Medical team', planner: 'Planner' } as Record<string, string>,
  stepKind: {
    complete_measurement: 'Complete a measurement',
    observe: 'Keep watching',
    approved_plan_step: 'Plan step',
    request_review: 'Review request',
  } as Record<string, string>,
  exec: {
    proposed: 'Proposed', accepted: 'Accepted', in_progress: 'In progress', completed: 'Done', deferred: 'Deferred',
    rejected: 'Declined', unable: "Couldn't do it", awaiting_impact_review: 'Done · waiting for a later reading',
  } as Record<string, string>,
  follow: {
    no_open_follow_up: 'No open follow-up', watching: 'Watching', action_open: 'Action open',
    review_requested: 'Review requested', under_specialist_review: 'Under specialist review', closed: 'Closed',
  } as Record<string, string>,
  followSymbol: {
    no_open_follow_up: '●', watching: '◐', action_open: '◑', review_requested: '▲', under_specialist_review: '▲', closed: '✓',
  } as Record<string, string>,

  // Rest window (FR-SCH-01..05). Wording: "rest opportunity" only; never a promise about sleep or performance.
  restEyebrow: 'Tonight',
  restTitle: "Tonight's rest window",
  restLead: 'Time with no scheduled task inside the rest window. The planner approves any change.',
  now: 'Now',
  withChange: 'With the change',
  restUnit: 'continuous rest opportunity',
  restWindow: 'Rest window',
  longest: 'Longest free block',
  fixed: 'Fixed',
  movable: (a: string, b: string) => `Movable ${a}–${b}`,
  prep: (m: number) => `${m} min preparation and travel`,
  constraints: 'What the comparison respects',
  change: 'The change',
  approver: 'Approved by',
  planner: 'Planner',
  request: 'Request this change',
  requested: 'Request saved on this device',
  plannerSees: 'The planner sees only this:',
  noAlt: 'No valid alternative within the current constraints.',
  noAltLead: 'Every task that touches the rest window is fixed or has no room to move. Tonight stays as it is.',
  noWindow: "No rest window in tonight's schedule.",
  noWindowLead: 'Nothing to compare. Ask the planner to add the rest window.',
  scheduleSource: "Tonight's mission schedule (simulated)",
  utc: 'UTC',
  legendFixed: 'Fixed task',
  legendMovable: 'Movable task',
  legendPrep: 'Preparation',
  legendFree: 'Longest free block',
}

export const fmtMinutes = (m: number | null) => {
  if (m === null) return 'No reading'
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const fmtDue = (iso: string | null | undefined) =>
  iso ? `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}, ${iso.slice(11, 16)} UTC` : T.noDate
export const hm = (iso: string) => iso.slice(11, 16)

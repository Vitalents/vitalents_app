// Every user-facing string for sharing, sync and the demo roles, in one file (CLAUDE.md rule 11).
import type { Role } from '../../store/role'
import type { SyncStatus } from '../../sync/engine'

export const T = {
  roleLabel: 'Demo role',
  roleHint: 'The data layer returns only what this role may see.',
  roles: { astronaut: 'Astronaut', medical: 'Medical team', planner: 'Planner' } satisfies Record<Role, string>,

  share: {
    kicker: 'Review and sharing',
    title: 'Share with the medical team',
    stepQuestion: 'Add your question',
    stepPreview: 'Check what will be sent',
    earlier: 'Earlier packages',
    itemsWord: 'items',
    onlyAstronaut: 'Only the astronaut can prepare a share from their record. Switch the demo role to Astronaut.',
    lede: 'Check exactly what will be sent. Nothing leaves your device until you confirm.',
    questionLabel: 'Your question for the medical team',
    questionHint: 'Optional. Sent as you write it.',
    questionPlaceholder: 'For example: should I change my exercise plan?',
    to: 'To',
    recipient: 'Medical team (simulated ground link)',
    includedTitle: 'What will be sent',
    excludedTitle: 'Not included',
    excluded: {
      'self_report.private_note': 'Your private notes',
    } as Record<string, string>,
    plannerNever: 'Nothing in this package goes to the planner.',
    recordCount: (n: number) => `${n} ${n === 1 ? 'record' : 'records'} from your record`,
    confirm: 'Send to the medical team',
    another: 'Prepare a new package',
    empty: 'Nothing to send yet: there are no events, readings, symptoms or actions in your record.',
  },

  sections: {
    events: 'Events',
    measurements: 'Readings, with their data status',
    symptoms: 'Symptoms you reported',
    actions: 'Steps you tried',
    question: 'Your question',
    none: 'None in your record.',
    noQuestion: 'No question added.',
  },

  sync: {
    title: 'Delivery',
    labels: {
      saved_locally: 'Saved on device',
      queued: 'Waiting to send',
      sent: 'Sent',
      delivered: 'Delivered',
      reviewed: 'Reviewed',
    } satisfies Record<SyncStatus, string>,
    notYet: 'Not yet',
    linkDown: 'Link down: the package waits on the device and sends when the link is back.',
    inTransit: (s: number) => `Delivery confirmation expected in about ${s} s.`,
    waitingReview: 'Delivered. The medical team marks it reviewed when they have read it.',
    proof: 'Times are when each step was recorded (UTC).',
  },

  link: {
    title: 'Simulated Earth link',
    lede: 'A demo setting. It changes how fast packages move, never what they contain.',
    up: 'Link available',
    upOn: 'Up',
    upOff: 'Down',
    delay: 'One-way delay',
    delayMin: (n: number) => (n === 0 ? 'None' : `${n} min`),
    accelerated: 'Speed up the demo (1 minute passes in 1 second)',
    roundTrip: (min: number, sec: number | null) =>
      sec === null ? `Round trip ${min} min.` : `Round trip ${min} min, shown in ${sec} s.`,
  },

  medical: {
    title: 'Packages from the crew',
    lede: 'Only packages that have reached the ground appear here. Private notes are never included.',
    empty: 'No package has been delivered yet.',
    from: 'From',
    prepared: 'Prepared',
    packageTitle: 'Crew summary for the medical team',
    version: (n: number) => `version ${n}`,
    markReviewed: 'Mark reviewed',
    reviewed: 'Reviewed',
    reviewedDone: 'Marked reviewed. The astronaut sees this on their delivery status.',
    requestTitle: 'Request a measurement',
    requestLabel: 'Which reading',
    requestSend: 'Request this reading',
    requestDone: (name: string) => `Requested: ${name}. It appears in the astronaut's plan.`,
    requestActionText: (name: string) => `Take a new reading: ${name}`,
    requestReason: 'Requested by the medical team after reviewing a shared package.',
    commentTitle: 'Add a comment',
    commentLabel: 'Comment for the astronaut',
    commentSend: 'Add comment',
    commentDone: 'Comment added to the follow-up.',
    commentReason: 'Comment from the medical team on a shared package.',
    commentActionText: 'Read the medical team comment',
    followTitle: 'Follow-ups assigned to the medical team',
    followEmpty: 'No follow-up is assigned to the medical team.',
    noteLabel: 'Comment',
  },

  planner: {
    title: 'Operational requests',
    lede: 'Schedule items and requests the planner decides on. Health records are not available to this role.',
    schedule: 'Mission schedule',
    scheduleEmpty: 'No schedule items for this mission day.',
    requests: 'Requests for the planner',
    requestsEmpty: 'No open operational request.',
    fixed: 'Fixed',
    movable: 'Movable',
    movableWindow: (a: string, b: string) => `Can move between ${a} and ${b}`,
    status: 'Status',
  },

  dev: {
    title: 'Vitalents share and privacy (dev entry)',
    reset: 'Reset scenario S1',
    loading: 'Loading the simulated record…',
    simulated: 'Simulated data',
  },
} as const

export const ACTION_STATUS: Record<string, string> = {
  proposed: 'Proposed',
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed: 'Done',
  deferred: 'Deferred',
  rejected: 'Declined',
  unable: 'Could not do',
  awaiting_impact_review: 'Waiting for review',
}

export const FOLLOW_STATUS: Record<string, string> = {
  no_open_follow_up: 'No open follow-up',
  watching: 'Watching',
  action_open: 'Action open',
  review_requested: 'Review requested',
  under_specialist_review: 'Under specialist review',
  closed: 'Closed',
}

export const INFO_STATUS: Record<string, string> = {
  valid: 'Valid',
  limited: 'Limited',
  stale: 'Stale',
  not_comparable: 'Not comparable',
  incomplete: 'Incomplete',
  no_reading: 'No reading',
}

/** UTC clock time, e.g. 14:03:22Z. */
export const utcTime = (iso: string) => `${iso.slice(11, 19)}Z`
/** UTC date and time, e.g. 2026-11-14 14:03Z. */
export const utcDateTime = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)}Z`

// English UI strings for feedback and personalization (FR-PE-01..04). One file so Arabic/RTL can follow.
// TODO(review: Amr — merge into content/strings.ts).
import type { Finding, KnowledgeGap } from '../../data/contract'

export const F = {
  /** FR-PE-03, shown wherever feedback is given or read. */
  neverChanges: 'Ratings never change rules, limits or references automatically.',
  notForRole: 'Feedback is not shared with the planner.',
  why: 'Why?',

  tried: {
    title: 'What you tried',
    lede: 'Each step you took, the readings on its follow-up date, and your rating. A reading after a step is an observation, not its effect.',
    empty: 'No steps tried yet. Steps you accept appear here once they start.',
    status: 'Step status',
    due: 'Follow-up date',
    afterwards: 'Observed afterwards',
    rating: 'Your rating',
    notSet: 'Not set',
    noReadingYet: 'No reading on or after the follow-up date yet.',
    noKinds: 'No reading linked to this step.',
    dataLink: 'Record',
    useful: 'Useful',
    notUseful: 'Not useful',
    notRated: 'Not rated',
    outcome: 'Follow-up note',
  },

  alert: {
    question: 'Was this alert useful?',
    useful: 'Useful',
    falseAlarm: 'False alarm',
    reasonLabel: 'What made it a false alarm? (optional)',
    save: 'Save rating',
    cancel: 'Cancel',
    change: 'Change rating',
    saved: (useful: boolean) => `You rated this alert: ${useful ? 'Useful' : 'False alarm'}.`,
    shared: "Your rating and reason go to the medical team's rule review.",
  },

  queue: {
    kicker: 'Rule review',
    title: 'Alerts rated false alarm',
    lede: 'Ratings from the astronaut, grouped by the rule and version that raised the alert. A person reviews the rule; any change gets a new rule version and a change-log entry.',
    empty: 'No alerts rated false alarm.',
    rule: (id: string, version: string) => `${id} · version ${version}`,
    falseAlarms: (n: number) => `${n} false alarm${n === 1 ? '' : 's'}`,
    useful: (n: number) => `${n} rated useful`,
    review: 'Review the rule',
    reviewNote: 'Check the rule wording and limits against its source. Nothing here has changed the rule.',
    rated: 'Rated',
    reason: 'Reason',
    noReason: 'No reason given',
  },

  gaps: {
    kicker: 'Knowledge gaps',
    title: 'Questions without a sourced answer',
    lede: 'Questions the assistant could not answer from its library. Read-only here; an answer is added only after specialist review.',
    empty: 'No questions waiting for review.',
    asked: 'Asked',
    domain: 'Domain',
    status: 'Status',
    noDomain: 'No domain linked',
    general: 'Several domains (general source)',
    sourcesSearched: (n: number) => `${n} source${n === 1 ? '' : 's'} searched`,
  },

  findingKind: {
    missing_data: 'Missing data',
    descriptive_change: 'Change from your reference',
    context_conflict: 'Context conflict',
    approved_plan_step: 'Plan step',
    review_request: 'Review request',
  } satisfies Record<Finding['finding_kind'], string>,

  gapStatus: {
    open: 'Open',
    under_review: 'Under review',
    resolved: 'Answered with a source',
    unanswerable: 'No source available',
  } satisfies Record<KnowledgeGap['status'], string>,
}

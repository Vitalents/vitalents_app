// Starter rules (SRS 6.4). TODO(review: Amr provides content/rules.json with reviewed wording and sources; this file is replaced then).
// Wording states observations only. Rules marked team_rule need medical review.
import type { Rule } from './rules'

export const STARTER_RULES: Rule[] = [
  {
    id: 'R-REV-01', version: '0.1', category: 'REVIEW_REQUEST', attention: 'urgent', priority: 1,
    when: { all: [{ fact: 'help.requested', op: '==', value: true }] },
    finding: 'You asked for a review.',
    step: { title: 'Medical team review requested', decision_owner: 'medical', followup_days: 0 },
    source_id: 'lib:nasa-medops', limits: 'The medical team decides the next step.',
  },
  {
    id: 'R-REV-02', version: '0.1', category: 'REVIEW_REQUEST', attention: 'urgent', priority: 2,
    when: { all: [{ fact: 'symptom.reported_today', op: '==', value: true }] },
    finding: 'A symptom was reported today.',
    step: { title: 'Send the symptom for review', decision_owner: 'medical', followup_days: 1 },
    source_id: 'lib:nasa-medops', limits: 'A self-report; the medical team decides what it means. This path never waits for a Decode result.',
  },
  {
    id: 'R-REV-04', version: '0.1', category: 'REVIEW_REQUEST', attention: 'due_follow_up', priority: 1,
    when: { all: [{ fact: 'followup.overdue_count', op: '>=', value: 1 }] },
    finding: '{followup.overdue_count} follow-up(s) are past their review date.',
    step: { title: 'Record the result or ask for a review', decision_owner: 'astronaut', followup_days: 0 },
    source_id: 'lib:nasa-medops', limits: 'An overdue follow-up stays open until someone records a result.',
  },
  {
    id: 'R-PLAN-01', version: '0.1', category: 'PLAN_NEED', attention: 'change', priority: 1,
    when: { all: [
      { fact: 'decode.below_reference_consecutive', op: '>=', value: 2 },
      { fact: 'sleep.nights_under_6h_last3', op: '>=', value: 2 },
    ] },
    finding: 'Two observations: {decode.below_reference_consecutive} sessions below your personal range ({decode.reference_range}), and {sleep.nights_under_6h_last3} of the last 3 nights under 6 hours.',
    step: { title: "Review tonight's rest window", decision_owner: 'astronaut', followup_days: 1, opens: 'schedule_alternatives' },
    source_id: 'lib:nasa-sleep-risk', limits: 'These happen together; this does not show that one caused the other.',
  },
  {
    id: 'R-PLAN-02', version: '0.1', category: 'PLAN_NEED', attention: 'change', priority: 2,
    when: { all: [
      { fact: 'decode.below_reference_consecutive', op: '>=', value: 2 },
      { fact: 'sleep.nights_under_6h_last3', op: '<', value: 2 },
    ] },
    finding: '{decode.below_reference_consecutive} sessions below your personal range ({decode.reference_range}); recorded sleep was not short on most of the last 3 nights.',
    step: { title: 'Add one more measurement from the plan and keep watching', decision_owner: 'astronaut', followup_days: 1 },
    source_id: 'lib:cognition-battery', limits: 'A change from your reference, not a diagnosis.',
  },
  {
    id: 'R-MEAS-01', version: '0.1', category: 'MEASUREMENT_ISSUE', attention: 'missing', priority: 1,
    when: { all: [{ fact: 'decode.info_status', op: '==', value: 'not_comparable' }] },
    finding: "Today's Decode round can't be compared (it was interrupted or the conditions changed).",
    step: { title: 'Repeat Decode in the same conditions', decision_owner: 'astronaut', followup_days: 0 },
    source_id: 'lib:cognition-battery', limits: 'The earlier round is kept; nothing is erased.',
  },
  {
    id: 'R-MEAS-02', version: '0.1', category: 'MEASUREMENT_ISSUE', attention: 'missing', priority: 2,
    when: { all: [{ fact: 'sleep.info_status', op: '==', value: 'no_reading' }] },
    finding: 'No sleep reading for last night.',
    step: { title: 'Check the wrist sensor or add the reading', decision_owner: 'astronaut', followup_days: 0 },
    source_id: 'lib:nasa-standard-measures', limits: 'No reading is not a health status.',
  },
  {
    id: 'R-MEAS-03', version: '0.1', category: 'MEASUREMENT_ISSUE', attention: 'missing', priority: 3,
    when: { all: [{ fact: 'decode.info_status', op: '==', value: 'no_reading' }] },
    finding: "Today's Decode round has not been recorded yet.",
    step: { title: "Play today's Decode round", decision_owner: 'astronaut', followup_days: 0 },
    source_id: 'lib:cognition-battery', limits: 'No reading is not a health status.',
  },
  {
    id: 'R-MEAS-04', version: '0.1', category: 'MEASUREMENT_ISSUE', attention: 'missing', priority: 4,
    when: { all: [{ fact: 'pulse.info_status', op: 'in', value: ['limited', 'not_comparable', 'incomplete'] }] },
    finding: "Today's resting pulse has limited quality.",
    step: { title: 'Repeat the pulse reading with firm sensor contact', decision_owner: 'astronaut', followup_days: 0 },
    source_id: 'lib:nasa-standard-measures', limits: 'A limited reading is shown but never used for your reference.',
  },
  {
    id: 'R-REF-01', version: '0.1', category: 'INSUFFICIENT_REFERENCE', attention: 'reference', priority: 1,
    when: { all: [{ fact: 'decode.reference_status', op: 'in', value: ['not_built', 'provisional'] }] },
    finding: 'Saved. {decode.session_count_comparable} comparable sessions so far; a personal reference needs at least 5.',
    step: { title: 'Keep the daily check going', decision_owner: 'astronaut', followup_days: 1 },
    source_id: 'lib:cognition-battery', limits: 'No comparison is made until the reference exists.',
  },
]

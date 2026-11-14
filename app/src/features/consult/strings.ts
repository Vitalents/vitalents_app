// Every user-facing string for the consult draft (FR-AS-09), in one file so Arabic / RTL can follow (CLAUDE.md rule 11).
// TODO(merge: move into app/src/content/strings.ts with the other feature strings)
import type { ConsultKey } from '../../assistant/consult'

export const C = {
  title: 'Note for the medical team',
  lede: 'Optional. Turns the record above into five short sections the medical team reads first. You check and edit it before it goes in the package.',
  draft: 'Draft a summary for the medical team',
  drafting: 'Drafting from your summary…',
  draftLabel: 'Draft — check before sending',
  byAssistant: (model: string) => `Drafted by the onboard assistant (${model})`,
  withoutAssistant: 'Drafted without the assistant',
  notice: {
    not_live: 'The assistant does not run on the public site, so this draft is built directly from your record.',
    unavailable: 'The onboard assistant is not running, so this draft is built directly from your record.',
    blocked: 'The assistant’s draft used a number that is not in your record, so it was set aside. This draft is built directly from your record.',
  },
  assistantNote: 'The assistant only rewords your record. Every number is checked against it.',
  sectionHint: (title: string) => `${title}, editable`,
  issue: 'Not in your record:',
  issueFix: 'Correct or remove it before sending.',
  allOk: 'Every number appears in your record.',
  blockedSend: (n: number) => `Sending is blocked: ${n === 1 ? 'one section has' : `${n} sections have`} a number that is not in your record.`,
  stale: 'Your record or question changed after this draft. Draft again to include the change.',
  again: 'Draft again',
  againHint: 'Replaces your edits.',
  remove: 'Remove the note',
  removed: 'Note removed. The package holds the record above only.',
  emptySection: 'This section is empty. Write a line or draft again.',

  sections: {
    trend: 'Trend',
    context: 'Context',
    what_was_tried: 'What was tried',
    crew_question: 'Crew question',
    requested_decision: 'Requested decision',
  } satisfies Record<ConsultKey, string>,

  template: {
    noTrend: 'No events or readings in the shared record.',
    noContext: 'No symptoms reported in the shared record.',
    noTried: 'No steps tried yet in the shared record.',
    noQuestion: 'No question added.',
    blank: 'Left blank.',
    symptom: (date: string | null, label: string) => (date ? `Symptom reported on ${date}: ${label}` : `Symptom reported: ${label}`),
    limits: (l: string) => `Limits: ${l}`,
    data: (status: string, reasons: string) => (reasons ? `(data: ${status}, ${reasons})` : `(data: ${status})`),
    decision:
      'Please review the shared record and choose one: keep the current plan, change it, or request a new measurement.',
    decisionWithQuestion:
      'Please answer the crew question, then choose one: keep the current plan, change it, or request a new measurement.',
  },

  /** Plain-text form that goes in the package (share_package.summary_text). */
  packageTitle: 'Note for the medical team',
  packageReviewed: 'Checked and edited by the astronaut before sending.',

  dev: {
    title: 'Vitalents consult draft (dev entry)',
    loading: 'Loading the simulated record…',
    simulated: 'Simulated data',
    question: 'Should I change my exercise plan?',
    package: 'What goes in the package',
    nothing: 'No note in the package.',
    blocked: 'Blocked: the send button stays off.',
  },
}

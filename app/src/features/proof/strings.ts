// English strings for the Proof screen (route /proof). Kept in one place so Arabic / RTL can follow (CLAUDE.md rule 11).
// No number on this screen is written here: every figure comes from proof.json or from running contracts/vectors/.
import type { AreaId, ProofStatus, SectionStatus } from './proofData'
import type { VectorOutcome } from './vectors'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "14 Nov 2026, 09:12 UTC" from an ISO UTC timestamp; the raw text if it does not parse. */
export function utcTime(iso: string | null): string {
  if (!iso) return P.unknownTime
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return iso
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}, ${m[4]}:${m[5]} UTC`
}

export const P = {
  kicker: 'Proof',
  title: 'What we checked, and what it shows',
  lede: 'Every number on this screen is copied from a file that a check wrote, with that file and its time beside it. When a file does not exist yet, the screen says so instead of showing a number.',
  published: (by: string, at: string) => `Published by ${by} · ${at}`,
  noProofFile: 'The evidence file has not been published yet.',
  status: {
    generated: 'Generated',
    partial: 'Partly generated',
    not_generated: 'Not generated yet',
    invalid: 'Did not pass the shape check',
  } satisfies Record<ProofStatus | SectionStatus, string>,

  howTitle: 'How it was checked',
  howLede: 'Five kinds of check, each written by a script and read here as data.',
  where: 'Numbers from',
  methods: [
    {
      id: 'integrity',
      title: 'Integrity tests',
      how: 'Every measurement carries a unit, timestamps are in order, versions are recorded, the permission tests and the sync no-duplicate test pass, all over the simulated record.',
      file: 'science/out/validation.json',
    },
    {
      id: 'detection',
      title: 'Reference and change detection, without leakage',
      how: 'The personal reference is checked so that it never absorbs a decline in scenario S1. Change detection is scored only on simulated crew members and later days that were held out when the reference was built, so no person and no future day leaks into the result. Hits, false alarms and days of lead are counted against one fixed threshold for everyone.',
      file: 'science/out/validation.json',
    },
    {
      id: 'timing',
      title: 'Daily-check timing and use',
      how: 'How long the daily check takes, how many alerts each simulated member receives per month, and how many follow-ups are completed in the scenarios.',
      file: 'science/out/validation.json',
    },
    {
      id: 'assistant',
      title: 'Assistant evaluation',
      how: 'A fixed question set, some questions answerable from the onboard library and some not, asked of each local model. Counted: answers that cite the expected source, correct refusals, and answers stopped by a guardrail. Rates are computed from those counts by ai/eval_summary.py.',
      file: 'science/out/assistant_eval*.json',
    },
    {
      id: 'vectors',
      title: 'Golden vectors in the app engine',
      how: 'The Python science code writes shared test vectors. This build runs each vector file through the TypeScript engine and compares every number within the tolerance stated in that file.',
      file: 'contracts/vectors/',
    },
  ],

  resultsTitle: 'Results',
  resultsLede: 'Each figure shows the file it was copied from and when that file was written.',
  area: {
    execution_integrity: 'Integrity tests',
    measurement_analysis: 'Reference and change detection',
    knowledge_assistant: 'Knowledge assistant, as summarised in validation.json',
    use: 'Daily-check timing and use',
  } satisfies Record<AreaId, string>,
  validationTitle: 'Integrity, reference and detection, daily-check timing',
  col: { check: 'Check', result: 'Result', count: 'Count behind it', source: 'Source' },
  passed: { yes: 'Passed', no: 'Did not pass' },
  noValue: 'No value in the file',
  noCount: 'No count given',
  ofCount: (n: number, d: number) => `${n} of ${d}`,
  outOf: (d: number) => `out of ${d}`,
  scenario: (s: string) => `Scenario ${s}`,
  sourceLine: (file: string, at: string) => `${file} · written ${at}`,
  modifiedLine: (file: string, at: string) => `${file} · file saved ${at}`,
  areaEmpty: 'This area is not in the file yet.',
  seed: 'Simulation seed',
  writtenBy: (by: string) => `Written by ${by}`,
  illustrativeTitle: 'Simulator parameters marked illustrative',
  illustrativeNote: 'These values are illustrative until they are taken from a full source.',

  notGenerated: 'Not generated yet',
  notGeneratedBody: (file: string) => `${file} has not been written yet, so there is nothing to show here. The numbers appear after the check runs and scripts/publish_proof.py copies them.`,
  invalidBody: (file: string) => `${file} exists but did not pass the shape check, so none of its numbers are shown. See the notes below.`,
  howToGenerate: 'To generate',
  validationCommands: ['cd science && python validate.py', 'python3 scripts/publish_proof.py'],
  evalCommands: [
    'cd ai && python ask_nasa.py --eval ../content/eval.json --out ../science/out/assistant_eval_gptoss.json',
    'python3 scripts/publish_proof.py',
  ],
  problemsTitle: (n: number) => `Notes from the shape check (${n})`,

  evalTitle: 'Assistant evaluation',
  evalModel: (m: string | null) => m ?? 'Unnamed model',
  evalLibrary: (v: string) => `Library version ${v}`,
  evalRows: {
    correct_source: { label: 'Correct source', of: 'of answerable questions' },
    correct_abstention: { label: 'Correct abstention', of: 'of questions the library cannot answer' },
    blocked: { label: 'Blocked by a guardrail', of: 'of all questions' },
  },
  evalDerived: (by: string) => `Counts copied from the eval file; rates computed from them by ${by}.`,
  evalTableCaption: 'Assistant evaluation counts as a table',

  vectorsTitle: 'Golden vectors',
  vectorsTail: 'vector files reproduced by the TypeScript engine',
  vectorsIndex: 'reproduced in this build',
  indexLabel: 'Evidence files',
  vectorsSource: 'Run in this browser from contracts/vectors/, bundled when the app was built',
  vectorsNone: 'No vector files were bundled with this build.',
  vectorCol: { file: 'Vector file', fn: 'Function', tol: 'Tolerance', outcome: 'Outcome' },
  outcome: {
    reproduced: 'Reproduced',
    differs: 'Differs',
    not_run: 'Not run: no engine function',
  } satisfies Record<VectorOutcome, string>,
  showVectors: 'Show every vector file',

  limitsTitle: 'Limits',
  limits: [
    'All data is simulated. These checks describe how the software behaves on simulated crew, not how any person responds.',
    'Decode, the personal reference and the change rules need independent validation before any use beyond this demo.',
    'Thresholds and reference rules are demonstration values, not approved medical limits.',
    'Nothing here is a clinical claim. The software does not diagnose and does not describe anyone’s health.',
  ],
  unknownTime: 'time not recorded',
  loading: 'Loading the evidence file…',
}

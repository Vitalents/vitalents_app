// SYNTHETIC proof.json for the dev entry and tests only: checks that the generated layout holds.
// These numbers are made up for layout and are NOT results. ProofPage never imports this file.
import type { Proof } from './proofData'

export const LAYOUT_SAMPLE: Proof = {
  proof_version: '1.0',
  generated_by: 'scripts/publish_proof.py',
  generated_at_utc: '2026-11-14T10:00:00Z',
  status: 'generated',
  validation: {
    status: 'generated',
    source: 'science/out/validation.json',
    source_generated_at_utc: '2026-11-14T09:12:00Z',
    source_generated_by: 'science/validate.py',
    seed: 1,
    areas: {
      execution_integrity: {
        checks: [
          { id: 'units_present', label: 'Layout sample: every measurement has a unit', method: null, value: 1, unit: 'rate', numerator: 10, denominator: 10, passed: true, scenario: null },
          { id: 'timestamps_ordered', label: 'Layout sample: timestamps in order', method: null, value: 0.9, unit: 'rate', numerator: 9, denominator: 10, passed: false, scenario: null },
        ],
      },
      measurement_analysis: {
        checks: [
          { id: 'reference_no_absorb', label: 'Layout sample: reference does not absorb the decline', method: 'Reference frozen while the follow-up is open', value: null, unit: null, numerator: null, denominator: null, passed: true, scenario: 'S1' },
          { id: 'detection_hits', label: 'Layout sample: changes found on held-out crew', method: 'One fixed threshold; held-out crew and later days only', value: 2, unit: 'count', numerator: 2, denominator: 3, passed: null, scenario: null },
          { id: 'lead_days', label: 'Layout sample: days of lead', method: null, value: null, unit: 'days', numerator: null, denominator: null, passed: null, scenario: null },
        ],
      },
      knowledge_assistant: null,
      use: { checks: [{ id: 'daily_check_seconds', label: 'Layout sample: daily check time', method: null, value: 12.5, unit: 's', numerator: null, denominator: 3, passed: null, scenario: null }] },
    },
    illustrative_parameters: ['layout_sample_parameter'],
    problems: [],
  },
  assistant_eval: {
    status: 'generated',
    source_pattern: 'science/out/assistant_eval*.json',
    models: [
      {
        source: 'science/out/assistant_eval_sample.json', source_modified_at_utc: '2026-11-14T09:40:00Z', derived_by: 'ai/eval_summary.py',
        model: 'layout-sample-model', library_version: null, total: 4, answerable: 2, unanswerable: 2, passed: 3,
        correct_source: 1, correct_abstention: 2, blocked: 1, answered: 1, correct_source_rate: 0.5, abstention_rate: 1, blocked_rate: 0.25,
      },
    ],
    problems: ['science/out/assistant_eval_sample.json: layout sample note'],
  },
}

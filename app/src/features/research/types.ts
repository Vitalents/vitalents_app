// Shape of research/out/model_<subject>.json (written by research/model.py, published by scripts/publish_research.py).
// Research prototype on simulated data: nothing here feeds a step, alert, finding or reference.
export type Verdict = 'better' | 'mixed' | 'not_better' | 'not_evaluated'

export interface RangeValue { expected: number; low: number; high: number }

export interface HeldOutDay {
  date: string
  record_ids: string[]
  sleep_h: number
  alertness: number
  actual: number
  train_days: number
  model: RangeValue
  baseline: RangeValue
  model_abs_error: number
  baseline_abs_error: number
  model_in_range: boolean
  baseline_in_range: boolean
}

export interface EvalSummary {
  model_mae: number
  baseline_mae: number
  model_closer_days: number
  baseline_closer_days: number
  tied_days: number
  model_in_range_days: number
  baseline_in_range_days: number
  model_mean_range_width: number
  baseline_mean_range_width: number
  beats_baseline: boolean
}

export interface Evaluation { method: string; held_out_days: number; days: HeldOutDay[]; summary: EvalSummary | null }

export interface ModelInput { key: 'sleep_h' | 'alertness'; label: string; unit: string; source: string }

export interface Coefficient { input: string; used: boolean; per_unit: number | null; per_unit_sd: number | null; note: string | null }

export interface ResearchModel {
  research_model_id: string
  model_version: string
  is_simulated: true
  label: string
  subject_id: string
  scenario_code: string
  source_file: string
  source_sha256: string
  inputs: ModelInput[]
  target: { key: string; label: string; unit: string; source: string }
  model: { name: string; settings: string; range: string; baseline: string }
  rows_used: { date: string; sleep_h: number; alertness: number; actual: number; record_ids: string[] }[]
  excluded: { date: string; record_id: string; reason: string }[]
  fit: {
    rows: number
    coefficients: Coefficient[]
    input_correlation: number | null
    noise_sd: number | null
    input_means: Record<string, number>
    expected_at_input_means: number | null
  } | null
  evaluation: { leave_one_day_out: Evaluation | null; forward_only: Evaluation | null }
  verdict: Verdict
  verdict_rule: string
  limits: string[]
}

export interface ResearchIndex {
  index_version: string
  label: string
  models: { subject_id: string; file: string; model_version: string; verdict: Verdict }[]
}

export type CheckKey = 'leave_one_day_out' | 'forward_only'

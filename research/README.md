# Research track (FR-RT-01)

**Research prototype on simulated data — not used for any step or alert.** Nothing here feeds a finding, a
step, a reference, a limit or a rule in the app. It needs independent validation before anyone relies on it.

## What it does

For each simulated crew member in `app/public/data/fixtures/` (the first scenario in `index.json` that holds them),
`model.py` fits a small, transparent per-person model:

| | |
|---|---|
| Inputs | Recorded sleep the night before the Decode round (h, `sleep_record.recorded_interval_ms`) and self-rated alertness that morning (1-10, `self_report.alertness_rating`) |
| Target | Decode correct count (`decode_session.correct_count`) |
| Model | Bayesian linear regression (scikit-learn `BayesianRidge`, default non-informative hyperpriors), inputs standardised inside each training fold; an input that never varies is dropped |
| Output | An 80 % **expected Decode range on simulated data** (expected value ± 1.282 × predictive SD). Not a health prediction |
| Baseline | Personal median of the training days; its range is their 10th to 90th percentile |
| Checks | Leave one day out (as asked), plus forward only (each day from earlier days only, from 5 earlier days on) |
| Metrics | Average miss (mean absolute error), days closer than the baseline, days inside the 80 % range and its mean width |

Rows: completed, non-practice Decode sessions with information status `valid`, a valid sleep record with the same
`observation_date` and an alertness rating the same morning. Anything else is listed in `excluded` with its reason,
never filled in. A bundle with any non-`sim:` record or a non-`mission_simulation` subject is refused.

## Honest result (stand-in fixtures, 14 Nov 2026)

| Subject | Days | Leave one day out: model vs median | Forward only | Verdict |
|---|---|---|---|---|
| `sim:crew:fahim` (S1) | 13 | 2.20 vs 2.31 (closer on 4 of 13) | 2.52 vs 2.38 | mixed: does not clearly beat the baseline |
| `sim:crew:c2` (S2) | 7 | 0.93 vs 1.00 | 0.54 vs 0.75 (2 days) | better, on 7 days only |
| `sim:crew:c3` (S3) | 14 | 1.90 vs 1.50 | 1.74 vs 1.28 | not better |
| `sim:crew:c4` (S4) | 8 | 0.84 vs 0.63 | 0.91 vs 0.83 | not better |

For Fahim, sleep and self-rating moved together (correlation −0.96: the self-rating stayed high on the short
nights), so the two slopes cannot be told apart. The fixtures are hand-written stand-ins; rerun when the simulator's
data replace them.

## Run

```bash
python3 research/model.py               # writes research/out/model_<subject>.json
python3 scripts/publish_research.py     # copies them to app/public/data/research/ (+ index.json)
python3 -m pytest -q research
```

The app shows the file for the current scenario's subject on `/research` (`app/src/features/research/ResearchPage.tsx`).

# `science/out/validation.json`: the shape the Proof screen reads

For: `science/validate.py` (FR-SIM-04, SRS 14.3). Read by: `scripts/publish_proof.py`, which copies the numbers into `app/public/data/proof.json` for the Proof screen (`/proof`) and the evidence slide.

The publisher **copies, never computes**. Every number shown comes from this file, with the file path and `generated_at_utc` beside it. A check that does not match the shape below is dropped and listed under "Notes from the shape check"; the rest of the file is still published. If the file is missing, the screen says "Not generated yet".

Run `python3 scripts/publish_proof.py --check` to see problems without writing anything.

## Top level

| Key | Type | Required | Meaning |
|---|---|---|---|
| `generated_at_utc` | string, UTC, ends in `Z` (`2026-11-14T09:12:00Z`) | yes | When `validate.py` wrote the file. Shown next to every number. |
| `generated_by` | string | recommended | The script, e.g. `"science/validate.py"`. |
| `seed` | integer or `null` | recommended | Simulator seed used (`sim.py --seed`). |
| `areas` | object | yes | Keys: `execution_integrity`, `measurement_analysis`, `knowledge_assistant`, `use`. Any other key is reported and not published. A missing area or `null` shows "This area is not in the file yet". |
| `illustrative_parameters` | list of strings or `null` | recommended | Names of the parameters in `science/sim_params.yaml` with `status: illustrative` (SRS 14.1). Listed on the screen. |
| `schema_version` | string | optional | `"1.0"`. Ignored by the publisher. |

Each area is `{"checks": [ <check>, ... ]}`.

## One check

Exactly these keys. **Any other key makes the check invalid** (it is dropped and reported), so nothing unreviewed reaches the screen.

| Key | Type | Required | Rule |
|---|---|---|---|
| `id` | snake_case string | yes | Unique within its area. |
| `label` | string | yes | What was checked, in plain words. Must pass `scripts/check_language.py` (no "validated", "normal", "healthy", causal wording...). |
| `method` | string or `null` | no | How, in one sentence, e.g. "Held-out crew and later days only; one fixed threshold". Same wording check. |
| `value` | number or `null` | yes (key must exist) | The result as computed. `null` when not measured. **Never 0 for missing.** Do not round in a way that changes a conclusion. |
| `unit` | string or `null` | no | `"rate"` (0 to 1), `"count"`, `"days"`, `"s"`, `"per member-month"`, ... Shown after the value; `"rate"` is shown as a percentage. |
| `numerator` | non-negative integer or `null` | no | The count behind the value. **Required when `unit` is `"rate"`**. Must not exceed `denominator`. |
| `denominator` | non-negative integer or `null` | no | What it was counted out of (sessions, crew-days, questions, tests...). Required when `unit` is `"rate"`. |
| `passed` | `true`, `false` or `null` | no | Only for pass/fail checks (tests). `null` for descriptive numbers such as hits or lead days, which have no pass mark. |
| `scenario` | string or `null` | no | `"S1"` ... `"S5"` when the check runs on one scenario. |

## Checks we expect per area (SRS 14.3)

The ids are suggestions; keep them stable once chosen. Each row is one check object.

### `execution_integrity`

| id | unit | numerator / denominator | passed |
|---|---|---|---|
| `units_present` | rate | measurements with a unit / all measurements | true when all |
| `timestamps_ordered` | rate | records whose timestamps are in order / all records | true when all |
| `versions_recorded` | rate | records carrying rule/reference/library versions / all records that need one | true when all |
| `schema_valid` | rate | records passing `contracts/*.schema.json` / all records | true when all |
| `permission_tests` | rate | permission tests passed / permission tests run | true when all |
| `sync_dedupe_test` | rate | resends that created no duplicate / resends tried | true when all |
| `golden_vectors_python` | rate | vector files in `contracts/vectors/` reproduced by the Python functions / vector files | true when all |

The app also re-runs every file in `contracts/vectors/` through the TypeScript engine at build time and shows that count itself (NFR-11); `golden_vectors_python` is the Python side of the same check.

### `measurement_analysis`

Detection must be scored **without leakage**: references are built only from training crew and earlier days; scoring uses held-out crew members and later days only. Say which in `method`, and include a check that proves the split.

| id | unit | numerator / denominator | passed |
|---|---|---|---|
| `holdout_no_overlap` | count | `value` = crew members or days shared between the training and held-out sets (expected 0, a real computed 0) | true when 0 |
| `reference_no_absorb_s1` | `null` | `null` | true when the S1 reference stays frozen while the follow-up is open; `scenario: "S1"` |
| `detection_hits` | count | hits / simulated changes in the held-out set | null |
| `detection_false_alarms` | count | false alarms / held-out crew-days without a simulated change | null |
| `detection_lead_days_median` | days | `denominator` = number of hits it is computed over | null |
| `detection_threshold` | the threshold's own unit | `null` | null; `method` names the one fixed threshold used for everyone |

### `knowledge_assistant` (optional here)

The assistant numbers come from `science/out/assistant_eval*.json` (one file per model, written by `ai/ask_nasa.py --eval ... --out ...`). `publish_proof.py` reads those files directly and computes the rates with `ai/eval_summary.py`, keeping the counts. Leave this area out or `null` unless `validate.py` adds something the eval files do not have.

### `use`

| id | unit | numerator / denominator | passed |
|---|---|---|---|
| `daily_check_seconds_median` | s | `denominator` = daily checks timed | null |
| `alerts_per_member_month` | per member-month | `denominator` = member-months simulated | null |
| `follow_up_completion` | rate | follow-ups completed / follow-ups opened in the scenarios | null |

## Example (shape only)

All values are `null` here on purpose: this shows the structure, not results.

```json
{
  "schema_version": "1.0",
  "generated_at_utc": "2026-11-14T09:12:00Z",
  "generated_by": "science/validate.py",
  "seed": null,
  "areas": {
    "execution_integrity": {"checks": [
      {"id": "units_present", "label": "Every measurement has a unit", "method": null,
       "value": null, "unit": "rate", "numerator": null, "denominator": null, "passed": null, "scenario": null}
    ]},
    "measurement_analysis": {"checks": [
      {"id": "detection_hits", "label": "Simulated changes found on held-out crew",
       "method": "Held-out crew and later days only; one fixed threshold for everyone",
       "value": null, "unit": "count", "numerator": null, "denominator": null, "passed": null, "scenario": null},
      {"id": "reference_no_absorb_s1", "label": "The reference does not absorb the decline",
       "method": "Reference frozen while the follow-up is open",
       "value": null, "unit": null, "numerator": null, "denominator": null, "passed": null, "scenario": "S1"}
    ]},
    "knowledge_assistant": null,
    "use": {"checks": [
      {"id": "daily_check_seconds_median", "label": "Daily check time, median", "method": null,
       "value": null, "unit": "s", "numerator": null, "denominator": null, "passed": null, "scenario": null}
    ]}
  },
  "illustrative_parameters": []
}
```

## Rules recap

- Missing is `null`, never 0. A computed 0 is fine.
- Every rate carries its `numerator` and `denominator`.
- UTC timestamps end in `Z`.
- Labels and methods describe software behaviour on simulated data: no clinical claim, no "validated"; use "needs independent validation".
- Never edit `app/public/data/proof.json` by hand: run `python3 scripts/publish_proof.py`.

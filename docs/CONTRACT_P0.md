# Vitalents · Data contract v1.0 (P0)

**Status:** frozen for P0 on 14 Nov 2026 · **Owner:** Ahmed (schemas) · **Source:** Shaimaa's Data Dictionary v0.9 (`Vitalents_Task2_Data_Dictionary.xlsx`)
**Overrides** the enum names and data shapes in `docs/SRS.md`. Agents follow this file where the two differ.

The 21 JSON Schemas in `contracts/` are generated from the dictionary: same entity names, field names, types and enums. The only changes are the decisions below (D-3, D-6 to D-8, D-11). Validate any data file with:

```bash
python3 scripts/validate_data.py            # all files under app/public/data and contracts/examples
python3 scripts/validate_data.py file.json  # one file
```

---

## 1. Decisions

| # | Topic | Decision |
|---|---|---|
| **D-1** | **IDs** | Namespaced strings: `<realm>:<entity>:<key>`. Realms: `sim` (mission simulation), `live` (a live player with no simulation), `research` (LifeSnaps), `lib` (library sources), `rule` (rule definitions). Fixtures use readable keys (`sim:decode_session:d26`); records created in the app use a UUID key (`sim:finding:3f2a…`). Fahim is **`sim:crew:fahim`**. Primary key = `<entity>_id`; the subject foreign key is always **`subject_id` → `subject_profile.subject_profile_id`**. Original source IDs stay unchanged in `source_participant_id` and `source_row_number`. |
| **D-2** | **Timestamps** | New app events: ISO 8601 **UTC with `Z`**, milliseconds optional (`2026-11-14T10:05:00.000Z`). Simulation: UTC on a fictional mission calendar (**day 27 = 2026-11-14**), `timezone_basis: mission_defined`. LifeSnaps: `observation_date` (local date) and `hour_local` only; `observed_at_utc` stays `null` and is never invented. Decode trials use **monotonic ms from session start**; only the session start and end are UTC. |
| **D-3** | **Missing values** | Missing is `null`, never `0`, `""` or an average. **Measured values must always be present, as `null` when missing:** `measurement.value`, sleep durations, Decode outputs, trial response fields, `personal_reference.reference_value`. Other optional fields may be omitted. A stored `0` means an observed zero. |
| **D-4** | **Hourly duplicates** | Not needed for P0 or P1 (P1 uses the daily file only). Policy for later: keep every row with `source_row_number`; exact duplicates keep the first row and mark the others as duplicates; the conflicting key keeps both rows, marks them `not_comparable` with reason `source_conflict`, and excludes them from references. Nothing is overwritten. |
| **D-5** | **Storage shape** | Flat records, one IndexedDB (Dexie) table per entity, linked by IDs. No nested entities. A data file is a **bundle**: `{"bundle_version": "1.0", "<entity>": [records…]}`. |
| **D-6** | **Information status** | Dictionary values plus two: `valid · limited · stale · not_comparable · incomplete · no_reading`. `limited` = usable with a caveat but never enters a reference (e.g. weak sensor contact). `stale` = a reading exists but is past the plan's freshness window. |
| **D-7** | **Action status** | Dictionary values plus two: `proposed · accepted · in_progress · completed · deferred · rejected · unable · awaiting_impact_review`. `rejected` = the astronaut declined (with an optional reason). A completed action with no later reading stays `awaiting_impact_review` and never closes as recovered. |
| **D-8** | **Field additions** | `mission_schedule`: `item_kind` (`task` / `rest_window`, required), `movable_earliest_start`, `movable_latest_end`. `personal_reference`: `range_low`, `range_high`, `frozen`. `decode_session`: `played_live_into_simulation`. |
| **D-9** | **Decode event conventions** | Accepted = `correct` + `incorrect` only. A trial open when the 90 s window closes is `missed`. A response after 90 000 ms is `late`. A second response to the same trial is `duplicate`. Responses after an interruption are `interrupted`. Missed, late, duplicate and interrupted are never accepted and never counted as wrong. `accuracy_percent = 100 × correct / accepted`, **`null` when accepted = 0**. `median_correct_rt_ms` covers correct responses only, `null` if none. A session is `interrupted` after Request help or more than 2 s hidden, and `aborted` if quit early for any other reason. Practice rounds are `is_practice: true` and never enter a reference. |
| **D-10** | **Personal reference v1** (demonstration heuristic, not a medical threshold; Shaimaa owns the final rule) | Use only `valid`, non-practice values strictly **before** the target date, within **14** days, excluding the **first 2** Decode sessions. Fewer than **5** values → `provisional` (shown, no comparison); 0 values → `not_built`; 5 or more → `usable_for_question`. Value = median; `range_low` and `range_high` = min and max. While a follow-up on the same indicator is open, the previous reference is returned unchanged with `frozen: true`, so a decline can never pull it down. Comparison says `below_range`, `within_range`, `above_range` or `not_comparable`, which is descriptive only. |
| **D-11** | **Live Decode in the demo** | A judge can play a live round that is added to Fahim's **simulated** history. The record keeps `data_origin: live_decode`, `is_simulated: false` and `played_live_into_simulation: true`, and the UI labels it "Live round added to a simulated history". This is allowed **only** in simulation mode. A live result is never attached to a LifeSnaps participant. |
| **D-12** | **Roles** | P0 uses the dictionary's three roles: `astronaut · medical · planner`. Splitting the medical role into crew medical officer and ground team is P1. |
| **D-13** | **Scenarios** | The Scope Update's **S1–S5** replace the SC-1…7 numbering. S1 = Fahim. |

### Old names → contract names (for agents)

| Concept | Old (SRS / Team plan) | **Contract v1.0** |
|---|---|---|
| Information status | valid / limited / invalid / missing / stale / not_comparable | `valid` `limited` `stale` `not_comparable` `incomplete` `no_reading` |
| Follow-up status | none, specialist_review | `no_open_follow_up`, `under_specialist_review` (others unchanged) |
| Reference status | not built / initial-limited / valid for question / needs re-review | `not_built` `provisional` `usable_for_question` `needs_review` |
| Action status | done, declined | `completed`, `rejected` (+ `unable`, `awaiting_impact_review`) |
| Connection state | saved / awaiting send / sent / acknowledged / reviewed | `saved_locally` `queued` `sent` `delivered` `reviewed` (draft = UI-only, not stored) |
| Step category | MEASUREMENT_ISSUE / INSUFFICIENT_REFERENCE / PLAN_NEED / REVIEW_REQUEST | `complete_measurement` `observe` `approved_plan_step` `request_review` |

---

## 2. What P0 builds

All 21 schemas exist. P0 **stores and shows** these 16:

`subject_profile` · `sleep_record` · `measurement` · `self_report` · `information_status` · `decode_session` · `decode_response_event` · `personal_reference` · `finding` · `action` · `follow_up` · `daily_review` · `mission_schedule` · `simulator_scenario` · `share_package` · `sync_event`

These live as **files**, not database rows: `rule_definition` → `content/rules.json`; `evidence_source` → `ai/corpus/sources.json`. `sharing_permission` is enforced in code (`app/src/store/permissions.ts`) and logged in P1. `feedback_entry` and `knowledge_gap` are P1/P2.

---

## 3. Fahim: input and output

**Input** is one bundle per scenario: `app/public/data/fixtures/S1.json` (S2–S5 the same shape). The shape is in `contracts/examples/S1_fahim_minimal.json`, a valid minimal example. Shaimaa owns the full fixture. It must contain:

| Entity | Fahim, scenario S1 |
|---|---|
| `simulator_scenario` | `sim:scenario:S1`, seed, crew IDs, expected outcomes, banner `SIMULATED DATA` |
| `subject_profile` | `sim:crew:fahim` (+ the other 3 crew for S2–S5) |
| `decode_session` | Mission days 13–26: first two sessions (learning), 9 valid reference sessions, day 23 interrupted, days 25–26 lower |
| `information_status` | One per measured record: `valid`, `not_comparable` (day 23), `limited` (day-27 pulse, `weak_sensor_contact`) |
| `sleep_record` | Days 13–27; days 25–27 under 6 h (`recorded_interval_ms`, `minutes_asleep`) |
| `measurement` | Daily `hr_resting_bpm`; day 27 has limited quality and **no substitute value** |
| `self_report` | Alertness 8/10 on days 25–27; a pain symptom on day 20 |
| `follow_up` | Pain follow-up opened on day 20, still open, assigned to `medical` |
| `mission_schedule` | Day 27: rest window 23:00–06:00 (`item_kind: rest_window`) and a movable meeting 23:00–00:00 (allowed 21:00–00:00) |

**Output** (what the logic produces and the app shows): `information_status`, `personal_reference`, `finding`, `action` and `daily_review` records in the same contract. For S1 the expected outcomes are: Decode is below the personal range and shown **beside** the 8/10 self-rating with no combined score; sleep is shown separately and never as the cause; the rest-window step offers 6 h → 7 h with approver `planner`; the pain follow-up stays visible.

---

## 4. The test API: functions + vectors (no server)

Shaimaa's Python in `science/` is the **reference implementation**. The app runs a TypeScript port in the browser (Ahmed's agent). **There is no HTTP API for this logic**; the only HTTP API is the assistant (`/ask`). Both sides are tested against the same vector files.

| Function (Python / TypeScript) | Input | Output | Needed by |
|---|---|---|---|
| `info_status(record_kind, record, context)` / `infoStatus` | `context = {due_today, freshness_hours, reference_device_class, as_of_utc}` | `{status, reason_codes[]}` | H4 |
| `build_reference(metric_code, target_date, history, params, open_follow_up, previous_reference)` / `buildReference` | `history = [{record_id, date, value, info_status, is_practice, session_index}]`, `params = {lookback_days:14, min_valid:5, exclude_first_sessions:2, method:"median"}` | `{reference_status, reference_value, range_low, range_high, valid_record_count, start_date, end_date, frozen, source_record_ids}` | H4 |
| `compare_to_reference(value, reference)` / `compareToReference` | a value (or `null`) and a reference | `{absolute_change, relative_change, position}` (relative rounded to 3 decimals) | H4 |
| `score_decode(planned_duration_ms, session_state, events)` / `scoreDecode` | raw events: `trial_index, correct_digit, response_digit, stimulus_monotonic_ms, response_monotonic_ms` | `{response_states[], accepted_responses, correct_count, accuracy_percent, median_correct_rt_ms}` | H4 |
| `evaluate_rules(facts, rules)` / `evaluateRules` | computed facts + `content/rules.json` | ordered steps `[{rule_id, step_category, finding_kind, explanation, limitations, owner_role}]` | H6 |
| `rest_opportunity(rest_window, items, step_minutes=15)` / `restOpportunity` | `mission_schedule` items | `{status: improved \| no_valid_alternative \| not_computable, current_minutes, best_minutes, changes[]}` | H6 |

**Reason codes** for `info_status`: `no_reading_due` · `missing_required_field` · `unit_unverified` · `interrupted_page_hidden` · `interrupted_help` · `random_pressing` · `device_change` · `weak_sensor_contact` · `stale_past_window` · `aborted` · `source_conflict`.

### Vector file format

`contracts/vectors/<function>/<vector_id>.json`:

```json
{
  "vector_id": "fahim-day27-frozen",
  "function": "build_reference",
  "contract_version": "1.0",
  "description": "What this case proves, in one sentence.",
  "input": { "...": "the function's arguments by name" },
  "expected": { "...": "the exact output" },
  "tolerance": 0.001
}
```

Six starter vectors are included. Shaimaa should check them by hand, fix them if her rule differs, and add the edge cases (missing, stale, device change, zero accepted, midnight-crossing schedule):

- `build_reference/fahim-day25-build`: 9 valid sessions → median 43, range 41–44
- `build_reference/fahim-day27-frozen`: follow-up open → day-25 reference returned, `frozen: true`
- `compare_to_reference/fahim-day27`: 36 vs 43 → −7, −0.163, `below_range`
- `compare_to_reference/no-reference`: provisional → `not_comparable`
- `score_decode/mixed-states`: correct, incorrect, duplicate, late → accepted 4, correct 3, 75.0 %, median 800 ms
- `score_decode/zero-accepted`: missed only → accuracy `null`, not 0

Test loop on both sides:

```python
# science/test_vectors.py
import json, glob, pytest
from science import logic
@pytest.mark.parametrize("path", glob.glob("contracts/vectors/*/*.json"))
def test_vector(path):
    v = json.load(open(path))
    out = getattr(logic, v["function"])(**v["input"])
    assert_close(out, v["expected"], v["tolerance"])
```

```ts
// app/src/engine/vectors.test.ts: same files, same expectations, camelCase function names
```

---

## 5. Scope Update (14 Nov): what we accept

| Item | Decision |
|---|---|
| P0 = full simulation journey with **S1–S5** | **Accepted.** Matches increments 0–6. |
| LifeSnaps licence | **Verified: CC BY 4.0** on Zenodo record 7229547 (version 4, open access). Reuse and redistribution are allowed **with attribution**. Cite the record and the Scientific Data paper. Still: don't commit the 615 MB archive or participant-level CSVs to GitHub; commit only a small derived daily subset if Real Data Mode is built, with an `ATTRIBUTION.md`. |
| LifeSnaps role | **P1 as evidence first:** Shaimaa runs the same reference method (D-10) offline on the daily sleep and heart-rate data and reports, per participant, how often a reference can be built and how often values fall outside the personal range vs a single fixed range. These are descriptive numbers for the evidence slide. **In-app Real Data Mode only after P0 passes.** Questionnaires (STAI/PANAS) are P2. |
| Temperature from LifeSnaps | Not shown until the unit and meaning are verified. Simulation only in P0. |
| EDA stress, readiness score, Decode as a medical test | Removed (agreed). |
| Simulator owner | **Shaimaa** (Team plan v1.3). |
| Feedback rating | Categorical `useful` / `not_useful`, not 1–5 (P2). |
| NASA resource | LifeSnaps is not NASA data. **Amr confirms** which item from the official challenge Resources tab we use (the NASA Human Research Program risk pages in the Ask NASA library are the candidate) and cites it on the project page. |

---

## 6. Who needs what

| From | To | What | By |
|---|---|---|---|
| Ahmed | Shaimaa | This contract, the schemas, the validator, the example bundle, the vectors | Now |
| Shaimaa | Ahmed | Full `S1.json` fixture (validates), Python for `info_status`, `build_reference`, `compare_to_reference`, `score_decode`, and checked vectors | 4 h from now |
| Shaimaa | Ahmed | `evaluate_rules`, `rest_opportunity` + vectors; S2–S5 bundles | 6–8 h from now |
| Amr | Shaimaa, Ahmed | Library files + `sources.json`, 15 eval questions **with expected source or expected refusal**, `rules.json` with wording and sources | Library by 6 h; rules by 3 h |

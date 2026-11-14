# Reference and status engines: integration notes (14 Nov 2026)

Integrated from Shaimaa's consolidated Tasks 3–5 handoff: `science/status.py` (status-0.3.1), `science/reference.py` (reference-1.0.1), all tests and fixtures, and the handoff docs (`docs/data-status/`, `docs/reference/`).
`cd science && pytest` → 166 passed, 1 expected failure (the known fixture disagreements in `test_fixtures_status.py`).

The app still uses its TypeScript engine (`app/src/engine/reference.ts`), which reproduces the shared vectors in `contracts/vectors/` (decision D-10). `reference.py` is not yet used to produce the app's `personal_reference` records. The two engines disagree on the points below. Each needs a decision before `reference.py` can feed the app.

## What happens on Fahim (S1) today

| Run | Result |
|---|---|
| S1 as stored | `not_built`, reason `unverified_decode_events`: simulated sessions have no response events |
| Events assumed verified | `not_built`, reason `missing_or_invalid_reference_context`: no `technical_context` on the sessions |
| Plus a technical context | `not_built`, reason `protocol_mismatch`: every session has its own `key_version` |
| Plus one shared key | `usable_for_question`, value **42** from 12 days (D-10 vector expects **43**, range 41–44, from 9 sessions) |

## Decisions needed (Shaimaa, with the team for anything in `contracts/`)

1. **Learning sessions.** D-10 excludes the first 2 sessions; `reference.py` uses familiarization context instead and keeps them, which gives 42 instead of 43. Pick one rule and update either the vectors or the engine.
2. **Range.** D-10 shows a min–max range; `reference.py` returns no `range_low` / `range_high`, so the app has no range to draw. Add them to `task2_record`, or drop the range from the screens.
3. **Key version.** Decode uses a new seeded key every round by design, so an exact `key_version` match means no Decode reference can ever be built. Proposal: compare `protocol_version` and `planned_duration_ms` only, and keep the key in the audit.
4. **Simulated response events.** `sim.py` should write response events for simulated sessions (or the adapter marks `events_verified` for simulated data); otherwise every simulated session is `incomplete`.
5. **`technical_context`.** Required by `reference.py`; the fixture and the live round must fill it (the contract field exists).
6. **Metric code.** `reference.py` writes `metric_code` = `correct_count`; the app and fixtures use `decode_correct_count`. Choose one.
7. **Provenance of the reference record.** `task2_record` writes `data_origin: application_generated` with `is_simulated: true` for simulated subjects; `status.py` itself treats `is_simulated` as true only for `simulated_mission`. Choose which one a simulated subject's reference uses.
8. **Freeze.** D-10 freezes the reference while a follow-up is open. `reference.py` freezes only on an explicit decision. Fine: the app adapter will record the freeze decision when a follow-up opens. No engine change needed.
9. **Still open from Task 3:** a `limited` status (weak sensor contact) and D-11's subject mode for a live round played into Fahim's simulated history (`mission_simulation` in the contract, `live_player` expected by `status.py`).

## Tasks 6–7: rules.py (rules-1.0.0) and schedule.py (schedule-1.0.0), added 14 Nov 2026

Integrated with tests (`cd science && pytest` → 202 passed, 1 expected failure) and docs in `docs/rules-schedule/`. `status.py` and `reference.py` are unchanged, so the decisions above are still open.

### Schedule: agrees with the app

The app's engine (`app/src/engine/schedule.ts`) searches for the best move; `schedule.py` checks moves it is given and adds the approval step. Fed the app's best move, `schedule.py` matches every shared vector in `contracts/vectors/rest_opportunity/`:

| Vector | App | schedule.py |
|---|---|---|
| fahim-d27 | 360 → 420 min | 360 → 420, `pending_approval` (planner) |
| midnight-crossing | longest 165 → 345, total 345 → 375 | longest 165 → 345, total 345 → 375 |
| all-fixed | no valid alternative | `no_valid_alternative` |
| missing-window | not computable | needs an explicit window (the app returns null minutes, never zero) |

Plan: the app proposes the move, `schedule.py`'s rules confirm it, and the planner's approval keeps it pending until given. No decision needed.

### Rules: one decision needed (Shaimaa, Amr, Ahmed)

The two engines order the daily next step differently:

- App (SRS attention order): urgent / help → due follow-ups → changes → missing information → reference. Fahim day 27: **rest-window step (R-PLAN-01)** first.
- `rules.py`: `request_review` (including any review already open) → `complete_measurement` → `approved_plan_step` → `observe`. Fahim day 27: his pain follow-up is already under specialist review, so the main step becomes **continue that review**, and the rest window drops below the missing-measurement steps.

Choose one order and update either `rules.py` or the SRS and the app. Also: `rules.py` proposes a plan step only with an `ApprovedMatch` (a signed-off rule, evidence and decision owner). That needs Amr's reviewed `content/rules.json` and a medical owner's approval of each rule.

## Decode validity: status.py vs the contract (added 14 Nov 2026)

The app now marks a Decode round `not_comparable` for a device or input-method change (reason `device_change`) and for two or more visible pauses of 5 s or more (reason `pause`). Points for Shaimaa:

1. `status.py` uses `device_method_mismatch`; SRS 7.3 and CONTRACT_P0 use `device_change`. Align `status.py` to the contract code.
2. `status.py` has no pause rule; it maps any `interruption_reasons` to `not_comparable` / `session_interrupted`. Add `pause` as its own reason code.
3. The SRS says unfinished sessions (including Request help) are `incomplete`; `status.py` and the app treat interrupted as `not_comparable` and only aborted as `incomplete`. Choose one and update the SRS or both engines.
4. `follow_up` has no field for the records behind an outcome; the app writes them on a final "Data: …" line of `outcome_note`. Proposal: add `outcome_record_ids` to the contract.

## Tasks 8-11: replay export and validation summary (14 Nov 2026)

Shaimaa's `science/simulator.py` replay (seed 42, S1-S4) is the official simulator. Nothing competes with it: `science/export_bundles.py` converts the replay into app bundles and `science/validate.py` builds `science/out/validation.json` from the replay and her engines. Neither writes `app/public/data/fixtures/`; `--publish` does not exist. `science/contract_logic.py` is the Python side of `contracts/vectors/` (D-9 scoring, D-10 reference and comparison, SRS 10 rest opportunity; 10/10 vectors), because `reference.py` does not implement the D-10 vector rule (decision 1 above).

`python3 science/export_bundles.py` → `science/out/scenarios/S1..S5.json` (S1-S4 from the replay, S5 a byte copy of the hand-made fixture) and `science/out/export_manifest.json` (date shift, ID map, dropped fields, comparison with the hand-made fixtures). All five pass `scripts/validate_data.py`. The adaptations, all listed in the exporter's docstring: dates move −6 days so the replay's review day 2026-11-20 is mission day 27 = 2026-11-14 (D-2); IDs `sim:crew:01:<entity>:<label>` become D-1 IDs `sim:<entity>:c01-<label>`; schema 0.9 → 1.0 with fields v1.0 lacks dropped (`finding.slot_id`, `finding.source_reference_id`, `finding.source_version`, `is_simulated` on profile and scenario); `item_kind` added; built-in findings without rule metadata get `rule:builtin-<finding_kind>` / `rules-1.0.0` / owner `astronaut` (provisional, as the handoff asks); the rest window becomes its own `mission_schedule` record; `frozen` comes from the series' freeze decision; information status comes from `status.py` with the ledger attestation of `decode.verify`. Not exported: the S1 plan's `rule_definition` / `evidence_source` (files, not records, in CONTRACT_P0 §2; `license_status` "Internal fictional fixture" is not an enum value) and the S4 preview (a `share_package` needs a confirmed permission).

### What the app needs before the exported bundles replace the fixtures

1. **S1 is not Fahim.** The replay's S1 is `sim:crew:01` "Aster Vale"; D-1/D-13 say S1 = Fahim (`sim:crew:fahim`). `fixtures/index.json` names fahim, c2, c3, c4.
2. **Different S1 story.** Sleep 335 vs 425 min (minutes asleep; every recorded interval is 8 h, so the app's "nights under 6 h" stays 0); median correct RT 840 vs 620 ms; alertness 4/10 (fixture: 8/10, "self-rating stays high"); today's Decode is present (fixture: not yet played); one `action_open` follow-up (fixture: pain under specialist review + Decode watching); no interrupted day 23 and no `limited` pulse (all 19 statuses valid).
3. **Reference metric.** The replay's references are `minutes_asleep` and `median_correct_rt_ms` with no `range_low` / `range_high`; the app reads `decode_correct_count` references and draws the range (decisions 2 and 6 above).
4. **Schedule.** The movable "Habitat handover" has no `movable_earliest_start` / `movable_latest_end`, so the app's search finds no move; the replay gets 360 → 420 min from an alternative it supplies itself. The allowed range is not invented here.
5. **Decode conventions.** `protocol_version` `sim-decode-90s-v1`, keys `sim-key-even` / `sim-key-odd`, symbols `sym_1`..`sym_9`, trial indexes from 0, keyboard input (app: `decode-1.0`, `g1`..`g9`, from 1). `test_fixtures_status.py` assumes 1-based trials.
6. **S5** stays the hand-made fixture on Fahim's stand-in history.

### validation.json (`python3 science/validate.py`, then `python3 scripts/publish_proof.py`)

Integrity over the five bundles (units, timestamp order, versions, schema, ID/realm rules, 24/24 ledgers re-verified by `decode.verify`, 44/44 exported statuses reproduced by `status.evaluate`, 10/10 vectors). The hand-made S5 reproduces 31/44: its Decode sessions have no response events (the known gap in `test_fixtures_status.py`). Detection: training member `sim:crew:04` sets one fixed band (min-max of its 10 earlier valid session medians, 620-620 ms); held-out members 01-03 are scored on the review day only (overlap 0). Personal reference (replay rules engine): 1/1 hits, 0/1 false alarms; fixed band: 1/1 hits, 1/1 false alarms; S2's interrupted round is not scorable. These are four replayed members: the counts show the method runs without leakage, not how well it detects anything. Daily-check time is `null`: the replay stores one submission time per check and no start time. Permission and sync-dedupe tests run in the app suite and are `null` here.

## Decision (Ahmed, 14 Nov 2026): demo data vs Shaimaa's replay

- The app and the pitch keep the hand-made Fahim fixtures in `app/public/data/fixtures/` (S1 = Fahim). Do not replace them with `science/out/scenarios/`.
- Shaimaa's S1–S4 replay (`science/simulator.py`) is the evidence behind the proof page (`science/validate.py` → `science/out/validation.json` → `app/public/data/proof.json`).
- The replay can replace the fixtures only after Shaimaa: (1) renames crew 01 to Fahim (`sim:crew:fahim`); (2) builds the Decode reference on correct answers (`decode_correct_count`) with a low–high range; (3) gives the movable meeting an allowed window (earliest start / latest end); (4) keeps the short nights, day 23's interrupted round and day 27's weak pulse contact (`limited`).

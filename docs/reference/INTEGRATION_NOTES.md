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

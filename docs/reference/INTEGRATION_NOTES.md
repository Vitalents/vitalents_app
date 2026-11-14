# App and research engine boundaries

Reviewed against the repository on 14 November 2026. These notes distinguish the browser demonstration from the independent Python research pipeline. Passing a shared-vector or replay check establishes software consistency within that check, not clinical validity.

## Two reference policies

| Concern | Browser / `science/contract_logic.py` | `science/reference.py` |
|---|---|---|
| Reference policy | Contract D-10: median and min–max, 14 days, at least 5 eligible readings | Explicit metric policy, trusted adapter context and versioned lifecycle |
| Decode familiarization | Excludes the first 2 sessions | Requires verified familiarization and exposure-band context |
| Protocol matching | D-10 fixture and app validity rules | Includes protocol version, key version and duration in the compatibility key |
| Output range | `range_low` and `range_high` | `task2_record` does not supply these fields |
| Decode metric name | `decode_correct_count` | `correct_count` |
| Freeze | An open follow-up preserves the prior reference | A recorded lifecycle decision freezes the reference |
| Provenance | Contract records and explicit live-in-simulation marker | Research partitions and `application_generated` reference records require an adapter before app use |

The app's TypeScript functions are checked against the four functions exported by `science.contract_logic.FUNCTIONS`. They are not a complete port of `science/reference.py`. The latter also requires verified time basis, technical context and comparability checks. Equality of user-supplied labels alone is not evidence of comparability.

Older exploratory probes reported a value of 42 rather than the D-10 value of 43 after relaxing several adapter checks. Those probes used earlier fixture/context assumptions and are not current app results. The policy differences above remain relevant before substituting one engine for the other.

## Quality and live measurements

Current simulated Decode fixtures include response-event ledgers. `science/tests/test_fixtures_status.py` verifies ledger-derived summaries before checking status; the previous missing-ledger expected failure is no longer the current state. A missing pulse is `no_reading`, with `weak_sensor_contact` preserved as context. It is not `limited` unless a usable value exists.

The app supports a live round added to a simulated history through contract D-11, keeping `data_origin: live_decode`, `is_simulated: false` and `played_live_into_simulation: true`. The standalone Python status/reference partition checks use `live_player` for live Decode. A future integration must preserve the explicit D-11 exception without mixing research participants and simulation identities.

Other adapter distinctions remain: Python uses `device_method_mismatch`, while the app uses `device_change`; visible-pause handling and interruption reasons also differ. These are integration boundaries, not evidence that one engine's output can replace the other's unchanged.

## Rules and schedule

The app prioritizes urgent/help requests, due follow-ups and changes before missing information. In the seeded Fahim day-27 story its suggested step is `R-PLAN-01`, the rest-window proposal. The independent Python rules pipeline prioritizes an existing review request before measurement completion, approved plan steps and observation. Its `ApprovedMatch` requires an approved rule, evidence and decision owner; draft demonstration rules do not establish that approval.

The browser searches for feasible task moves. `science/schedule.py` evaluates a supplied alternative and records its approval requirement. The shared contract vectors cover a 360 → 420 minute rest opportunity, a midnight-crossing case, no valid alternative and an unknown window. Rest opportunity is not measured sleep or proven benefit; planner approval remains a separate action.

## App fixtures and replay exports

| Artifact | Purpose |
|---|---|
| `app/public/data/fixtures/S1..S5.json` | Browser demonstration scenarios; S1 is Fahim |
| `science/simulator.py` | Independent four-member replay with seed 42 |
| `science/out/scenarios/S1..S5.json` | Contract-adapted replay exports; S5 retains the app fixture |
| `science/out/export_manifest.json` | Date shifts, ID mapping, omitted fields and comparison with app fixtures |
| `science/out/validation.json` | Replay and integrity checks used by the proof publisher |

Do not replace app fixtures with replay exports without reconciling their intended story and policy. Replay S1 uses `sim:crew:01` (Aster Vale), different sleep/alertness histories and reference metrics, and supplied schedule alternatives. The app uses `sim:crew:fahim`, Decode correct-count ranges and explicit movable-task windows. Protocol names, symbol IDs and trial indexing also differ. The export adapter records these distinctions rather than inventing missing context.

The stored validation artifact dated 14 November 2026 reports **44/44 S5 status reproductions**, superseding the earlier **31/44** missing-ledger result. The replay detection comparison uses one training member and three held-out members on one review day: personal-reference hits **1/1**, false alarms **0/1**; fixed-band hits **1/1**, false alarms **1/1**. The interrupted case is not scorable. These tiny synthetic denominators do not measure real-world detection performance. Daily-check timing and several operational measures remain `null`; missing evidence is not a zero.

## Regenerate Fahim's fixture

From the repository root, after installing the app dependencies:

```bash
python3 -m scripts.make_fahim_s1 --check
```

Omit `--check` only when intentionally regenerating the fixture. The generator checks raw Decode ledgers, uses the D-10 contract reference and schedule functions, and invokes the app's rule evaluator. In the seeded story, day-25 and day-26 scores are 37 and 36; the reference freezes at 43 with a 41–44 range from nine sessions. Day 23 retains a partial ledger with null published scores. Day 27 shows alertness 8/10 and no pulse reading; the prior three sleep intervals are 5.4, 5.1 and 5.2 hours.

The schedule proposes moving the meeting to 22:00–23:00 UTC, making 360 → 420 minutes available. The earlier medical follow-up remains visible. A step's completion, a later observation, review of that observation and manual closure are separate events; no observed change is attributed to the step.

See [validation and limits](../validation.md) for the wider evidence scope.

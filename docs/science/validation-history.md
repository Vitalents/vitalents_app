# Standalone science validation history

**14 November 2026 · Standalone science package accepted for integration QA.** Both the supplied Tasks 3–9 archive and the final Tasks 10–11 ZIP were tested from fresh extractions on Windows with CPython 3.12.14. Each run executed **226 tests: 226 passed, 0 failed, 0 errors, 0 skipped, 0 expected failures, and 0 unexpected successes**. No blocking defect was confirmed in the delivered Python implementation. This historical report covers the standalone package only; it is not the current application acceptance record.

## Original reproduction and evidence boundaries

From the extracted ZIP root, run:

```console
python -B -m unittest discover -s tests -v
python -B -m science.simulator --out mission_replay.json
```

Counts are unittest methods. Subtests count under their parent method. The CLI replay is a separate synthetic demonstration and adds zero to the suite count. It reproduced SHA-256 `e3827e7bd43ffd9132ad8d28bb7e8d5af89cdd95cb59ffe5f6f02c774d22252d`. The three embedded Task 2 contract files matched the separate Task 2 archive byte for byte. The final ZIP preserved every original entry byte for byte. Its two additions are these reports.

- **Unit and boundary checks** exercise status classifications, reference policies and lifecycle, rule and approval gates, interval arithmetic, and ledger validation with controlled inputs.
- **Cross-module checks** call the actual Python engines. See `Task3IntegrationTests` in `test_reference.py`, the six cross-engine cases in `test_task5_reference.py`, rule tests using status/reference, and the ledger-to-status/rules checks in `test_decode.py`. These cases are included in the counts below.
- **Synthetic demonstrations** exercise the seeded four-person fictional replay through status, reference, rules, schedule and DECODE verification. Eight acceptance methods independently assert expected outputs and re-verify all 24 generated ledgers. Approvals, symptoms, measurements and share-preview inputs are fixtures.
- **Application-level coverage** requires a separate React/client, local store, adapters, browser/device evidence and sharing workflow. None were supplied in the four attachments.

## Requirements-to-evidence matrix

Verified means directly exercised at the stated standalone boundary. Partially verified means only a subset of the product requirement has evidence. Not tested marks behavior outside this run. Blocked identifies a missing prerequisite for testing.

| Requirement | Status | Evidence and coverage |
|---|---|---|
| T3 / M2–M4 — Information Status | Verified | `test_status.py` (88). Missing, incomplete, incomparable and valid readings, provenance/units/time, zero vs missing, and persistence envelope. Information quality is independent of follow-up state. |
| T4 / M4, M7 — Personal reference | Verified | `test_reference.py` (40, including five status/contract integration methods). Prior compatible same-person observations only, distinct days, exclusions and no future leakage, versions, freeze/review and audit replay. |
| T5 / M10 — Regression and engine interoperability | Verified | `test_task5_status.py` (13) and `test_task5_reference.py` (20). Boundary and cross-engine checks include impossible game RT, equivalent UTC instants and audit round trips. Tested versions are `status-0.3.1` and `reference-1.0.1`. |
| T6 / M4–M5 — Review and follow-up priorities | Verified | `test_rules.py` (18). Review overrides lower-priority proposals, open follow-ups remain visible, and plan/rule decisions are bound to scope, version and evidence. |
| T7 / M5 — Schedule alternatives | Verified | `test_schedule.py` (18). Fixed work, buffers, calendars, date rollover, rest-window arithmetic and scoped approval. |
| T8 / M10 — S1–S4 mission replay | Verified | `test_simulator.py` (8) and CLI replay. Deterministic labels, identifiers, links, scenario outcomes and cross-crew filtering. |
| T9 / M3 — DECODE scoring from supplied ledgers | Verified | `test_decode.py` (21). A hand-derived vector yields 4 accepted, 3 correct, 75% accuracy and 401 ms median correct RT. Tests include malformed/dropped events, capture ordering, key and time boundaries, partial/practice runs and undefined values. |
| M2–M5, M7 — Application mapping and workflow | Partially verified | Engine output and fixture links exist. App schema validation, real LifeSnaps import, card rendering, provenance labels, action transitions and durable storage await integration. Some built-in findings omit rule/owner metadata required by the proposed app mapping. |
| M8 — Share preview and permissions | Partially verified | S4 scopes a synthetic preview and excludes its private note. App authorization, role switching, export and storage boundaries, and negative access tests are outstanding. |
| M6 — Library and assistant | Not tested | Citation grounding, abstention, gap logging and cached/offline answers have no application evidence. |
| M9 / S5 — Delayed communication and offline restart | Blocked | Needs the application local store, share queue, simulated transport receipts and review state. The packaged replay covers S1–S4. |
| M3 — Live DECODE capture | Blocked | Requires a playable client, a versioned key registry and an independent capture trace/seal from target browsers/devices. |
| Measurement validity, usability and health impact | Not tested | No independent DECODE measurement study, usability study, astronaut cohort, or clinical outcomes were evaluated. |

## Scenario results

| Scenario | Verified synthetic outcome |
|---|---|
| S1 · Performance change | Sleep was 335 vs 425 min (−90 min). Median correct DECODE RT was 840 vs 620 ms (+220 ms). The frozen comparisons remain separate and descriptive. A plan step is proposed and the follow-up stays open. A schedule candidate offers 420 vs 360 min of calculated rest opportunity, pending planner approval. |
| S2 · Missing measurement | Missing sleep is `no_reading`. Interrupted DECODE is `not_comparable` and publishes no score. No reading or delta is imputed. Completing the sleep entry is proposed and the existing follow-up remains open. |
| S3 · Schedule conflict | A crew-task overlap and an attempted move of fixed work reject both candidates. The engine returns `no_valid_alternative` and retains a 360 min baseline rest opportunity. |
| S4 · Specialist review | A symptom prompts review despite favorable game performance. Skin temperature remains `incomplete` with `unsupported_metric`. The medical preview includes the designated symptom and temperature IDs and excludes the private note. No delivery or authorization is demonstrated. |

Passing tests verify software behavior for the supplied inputs. The five prior valid days within 14 days are a demo policy. Sleep–game co-occurrence provides no causal inference, rest opportunity does not measure actual sleep, and DECODE scoring establishes neither medical readiness nor diagnostic validity. Rule approvals in the fixtures are fictional.


## Current implementation

IDs, null handling, timestamps, Decode conventions and application schema decisions are defined in [the current contract](../CONTRACT_P0.md). The current [validation guide](../validation.md) describes integrated application checks. This historical matrix preserves what the standalone run did and did not test; its pending/blocked statuses do not describe today’s browser implementation. Independent measurement validity, usability and clinical outcome evidence remain outside these software checks.

# Data Status Validation

Ruleset `status-0.3.0`. Suite command `python -B -m unittest discover -s tests -p 'test_*.py' -v`.
Python 3.15.0. **88 executed, 88 passed, 0 failures, 0 errors, 0 skipped.**
Includes the previous 71 tests and 17 new regressions.

Each ID links by name to its exact input and context in `tests/test_status.py`;
the four base JSON inputs are in `tests/fixtures/status_cases.json`. PASS for
a classification case requires status, ordered reasons, any listed flags,
determinism and preservation of the input. The suite runs entirely on synthetic data.

| ID | Kind | Expected status | Expected reasons | Actual status | Result |
|---|---|---|---|---|---|
| T01 | measurement | valid | [] | valid | PASS |
| T02 | measurement | no_reading | missing_record | no_reading | PASS |
| T03 | measurement | no_reading | missing_value | no_reading | PASS |
| T04 | measurement | no_reading | missing_value, unknown_source | no_reading | PASS |
| T05 | measurement | valid | [] | valid | PASS |
| T06 | measurement | incomplete | unknown_unit | incomplete | PASS |
| T07 | measurement | incomplete | unknown_unit | incomplete | PASS |
| T08 | measurement | incomplete | unknown_source | incomplete | PASS |
| T09 | measurement | incomplete | unknown_measurement_time | incomplete | PASS |
| T10 | measurement | valid | [] | valid | PASS |
| T11 | measurement | incomplete | unknown_measurement_time | incomplete | PASS |
| T12 | measurement | incomplete | unknown_measurement_time | incomplete | PASS |
| T13 | measurement | incomplete | subject_source_mismatch | incomplete | PASS |
| T14 | measurement | incomplete | subject_source_mismatch | incomplete | PASS |
| T15 | measurement | incomplete | invalid_provenance | incomplete | PASS |
| T16 | measurement | incomplete | source_metric_mismatch, unknown_unit | incomplete | PASS |
| T17 | measurement | valid | duplicate_observation | valid | PASS |
| T18 | measurement | incomplete | conflicting_duplicate | incomplete | PASS |
| T19 | measurement | incomplete | invalid_record_type | incomplete | PASS |
| T20 | measurement | incomplete | invalid_value | incomplete | PASS |
| T21 | measurement | incomplete | invalid_value | incomplete | PASS |
| T22 | measurement | incomplete | unknown_metric, unknown_unit | incomplete | PASS |
| T23 | measurement | incomplete | missing_measurement_context | incomplete | PASS |
| T24 | measurement | not_comparable | wrong_conditions | not_comparable | PASS |
| T25 | measurement | incomplete | unknown_unit, wrong_conditions | incomplete | PASS |
| T26 | measurement | not_comparable | temporal_resolution_mismatch | not_comparable | PASS |
| T27 | measurement | not_comparable | device_method_mismatch | not_comparable | PASS |
| T28 | measurement | not_comparable | missing_comparison_context | not_comparable | PASS |
| T29 | measurement | not_comparable | insufficient_reference | not_comparable | PASS |
| T30 | measurement | valid | [] | valid | PASS |
| T31 | sleep_record | valid | [] | valid | PASS |
| T32 | sleep_record | no_reading | missing_value | no_reading | PASS |
| T33 | decode_session | valid | [] | valid | PASS |
| T34 | decode_session | not_comparable | session_interrupted | not_comparable | PASS |
| T35 | decode_session | incomplete | unverified_decode_events | incomplete | PASS |
| T36 | decode_session | not_comparable | protocol_mismatch | not_comparable | PASS |
| T37 | decode_session | valid | [] | valid | PASS |
| T38 | decode_session | incomplete | unknown_measurement_time | incomplete | PASS |
| T39 | measurement | incomplete | invalid_value | incomplete | PASS |
| T40 | measurement | incomplete | invalid_value | incomplete | PASS |
| T41 | sleep_record | no_reading | missing_sleep_target_value | no_reading | PASS |
| T42 | sleep_record | valid | [] | valid | PASS |
| T43 | sleep_record | valid | [] | valid | PASS |
| T44 | sleep_record | not_comparable | missing_sleep_comparison_target | not_comparable | PASS |
| T45 | sleep_record | not_comparable | missing_sleep_comparison_target | not_comparable | PASS |
| T46 | sleep_record | not_comparable | unknown_sleep_method | not_comparable | PASS |
| T47 | sleep_record | incomplete | invalid_value | incomplete | PASS |
| T48 | sleep_record | incomplete | invalid_value | incomplete | PASS |
| T49 | sleep_record | not_comparable | comparison_metric_mismatch | not_comparable | PASS |
| T50 | decode_session | not_comparable | protocol_duration_mismatch | not_comparable | PASS |
| T51 | decode_session | not_comparable | protocol_duration_mismatch | not_comparable | PASS |
| T52 | decode_session | not_comparable | protocol_duration_mismatch | not_comparable | PASS |
| T53 | decode_session | not_comparable | protocol_duration_mismatch | not_comparable | PASS |
| T54 | decode_session | incomplete | incomplete_decode_summary | incomplete | PASS |
| T55 | decode_session | incomplete | invalid_decode_summary | incomplete | PASS |
| T56 | decode_session | valid | [] | valid | PASS |
| T57 | decode_session | incomplete | invalid_decode_summary | incomplete | PASS |
| T58 | decode_session | incomplete | unverified_decode_events | incomplete | PASS |
| T59 | decode_session | not_comparable | session_interrupted | not_comparable | PASS |
| T60 | decode_session | incomplete | invalid_interruption_reasons | incomplete | PASS |
| T61 | measurement | incomplete | unsupported_metric, unknown_unit | incomplete | PASS |
| T62 | measurement | incomplete | unsupported_metric, unknown_unit | incomplete | PASS |
| T63 | measurement | incomplete | unsupported_metric, unknown_unit | incomplete | PASS |
| T64 | measurement | incomplete | unknown_metric, unknown_unit | incomplete | PASS |
| T65 | measurement | incomplete | invalid_provenance, unknown_source | incomplete | PASS |
| T66 | measurement | incomplete | unknown_measurement_time, temporal_resolution_mismatch | incomplete | PASS |
| T67 | sleep_record | incomplete | sleep_asleep_exceeds_interval | incomplete | PASS |
| T68 | sleep_record | incomplete | sleep_asleep_exceeds_interval | incomplete | PASS |
| T69 | sleep_record | valid | [] | valid | PASS |
| T70 | sleep_record | incomplete | sleep_asleep_exceeds_interval | incomplete | PASS |
| T71 | sleep_record | valid | [] | valid | PASS |
| T72 | sleep_record | incomplete | invalid_value | incomplete | PASS |
| T73 | sleep_record | valid | [] | valid | PASS |
| T74 | decode_session | incomplete | unverified_decode_clock_disagreement | incomplete | PASS |
| T75 | decode_session | valid | [] | valid | PASS |
| T76 | decode_session | incomplete | unknown_measurement_time, unverified_decode_clock_disagreement | incomplete | PASS |
| T77 | decode_session | valid | [] | valid | PASS |
| T78 | decode_session | incomplete | unverified_decode_events, unverified_decode_clock_disagreement | incomplete | PASS |
| T79 | decode_session | not_comparable | session_interrupted | not_comparable | PASS |
| T80 | decode_session | not_comparable | session_interrupted | not_comparable | PASS |
| T81 | decode_session | not_comparable | protocol_duration_mismatch | not_comparable | PASS |
| T82 | decode_session | incomplete | unverified_decode_clock_disagreement | incomplete | PASS |
| T83 | decode_session | not_comparable | session_interrupted | not_comparable | PASS |
| P01 | measurement | valid | [] | valid | PASS |
| P02 | measurement | ValueError | N/A | ValueError | PASS |
| P03 | measurement | ValueError | N/A | ValueError | PASS |
| P04 | measurement | no_reading | missing_value | no_reading | PASS |
| P05 | measurement | ValueError | N/A | ValueError | PASS |

## Task 2 contract probes

In a separate read-only check, all four exact synthetic Task 2 examples passed
raw evaluation with `valid` and empty reasons. Research linkage and DECODE ledger
verification were supplied as test context. The union of supported and recognized
unsupported measurement codes matched the Task 2 measurement enum exactly.

## Independent QA disposition

| Finding | Standalone result | Remaining approval or verification |
|---|---|---|
| Sleep target | T41–T49 cover partial records, explicit target, zero, unknown method and bad values/units. | Storage identity for metric-specific results. |
| DECODE timing and ledger | T34–T38 and T50–T60 cover window, protocol, interruption, verified ledger gate, summary consistency and zero. | Frontend timing/acceptance semantics and end-to-end ledger assurance. |
| Planned missing | P02, P04 and P05 cover absent row, existing null-value row and bare expected ID. | Where to store an assessment for an expected slot without an observed row. |
| Contract and coverage | P01, T61–T66 and the Task 2 probes cover envelope shape, permitted metric enum, known unsupported mappings, date and provenance. | Approve schema/adapter and validate real UI JSON. |
| Unit flags | T41–T43, T47–T48, T54–T55 and T58 verify relevant flags. | Confirm source mapping and method with the app. |

No real participant rows or app code are included. Event-ledger verification and
other trusted adapter checks were exercised as inputs. Integration acceptance
requires actual adapter tests for research joins, duplicates, DECODE events,
and UI serialization.

## Latest independent QA review

T67–T73 cover both reported sleep contradictions, equality, exact fractional-minute
conversion, zero, a missing companion and an invalid companion. T74–T83 cover
the five-hour discrepancy, verified forward and backward clock adjustments,
missing ledger verification, interruption, focus loss, pause, suspension and
preservation of the protocol duration check.

In separate contract probes, all four supplied Task 2 synthetic records returned
valid with empty reasons. Each persisted output matched all 15
fields in the Task 2 CSV and round-tripped through strict JSON. This corrects
the previous report's field count. The output schema and field set are unchanged.
App adapters and live integration remain untested.

# Task 4 integration handoff for Ahmed

Apply the six Task 4 files over a checkout containing the final Task 3 package. `science/reference.py` imports `science/status.py` from that checkout. The test suite uses the standard library. See [validation](reference_validation.md) for the commands and results.

## Application flow

1. Resolve each source record in its trusted subject and origin partition. Wrap the original Task 2 record and its record-specific context in `Observation(record, context)`. Supply the Task 3 adapter checks as documented in the final Task 3 handoff.
2. Add the following evidence in memory. `context["conditions_compatible"]` must be literal true for an adapter-verified setting. Use documented Task 2 `measurement_context`, `sleep_metric_method` or `technical_context` on the record. The subject profile must identify the `timezone_basis`. Research profiles must carry `research_dataset_version` and their verified `source_participant_id`. DECODE needs the existing verified event ledger check plus `decode_familiarization_verified=True` and a versioned `decode_exposure_band` string from the adapter. Include relevant protocol, device, timing and environmental details in controlled context labels. Equality of user-supplied labels alone cannot establish comparability.
3. Construct `Policy(kind, metric, version, lookback_days, minimum_days)`. Build with `build_reference(target, history, policy)`. Use the candidate's status and reason for an unavailable or insufficient comparison. Keep previous records as immutable source IDs. When replaying past decisions, pass the historical data snapshot known at that time so late-arriving corrections cannot leak into the replay.
4. Record the authorized review via `series.activate(candidate, reference_id=..., decision=..., expected_reference_id=...)`. Start with `ReferenceSeries()` on first publication. Use `series.decide("freeze" | "request_review" | "resolve_review", reference_id=..., decision=...)` to append a documented lifecycle decision. A `Decision` contains a unique decision ID, actor ID, role, UTC time and reason. Bind the actor and role to the authenticated user before calling.
5. Persist each version through `task2_record(series.active, schema_version=...)`. Persist audit snapshots via `audit_event(event)` and recover a series with `restore_series(log)`. Store both in one atomic application transaction when activating, with a compare-and-swap on the complete series revision so concurrent review and publication cannot bypass a hold. Keep the log ordered per series and use unique reference and decision IDs. Authorize audit reads to the same subject partition. Immutable raw records and protected audit snapshots are needed for replay.
6. Use `compare(target, policy, series, as_of_utc=...)` with the UTC time at which the application asks the comparison question. It evaluates raw quality and calls the actual Task 3 comparison API with metric-specific checks. `result.assessment_context` can also be passed to `status.information_status` for a persisted record, subject to the Task 3 storage rules. A missing slot without a record can use display-only `Observation(None, {})`. Keep follow-up state in its own workflow.

For replay, pass the as-of decision time and the record available at that time. Frozen baselines keep their original fit window across later comparisons. For an unavailable reference with a provisional build result, present the build status and counts alongside Task 3's current-reading information. These two states describe different questions.

## Decisions for Ahmed

| Decision | Required at integration |
|---|---|
| Metric policy | Approve each minimum-day/lookback policy, its comparison question and any expiration or recertification policy. Decide whether and when to permit an automated change flag. This package uses an explicit decision and ships with no numeric decline cutoff. |
| DECODE comparison | Approve the familiarization and exposure-band criteria, protocol/key equivalence and technical conditions that the adapter can attest. Exact matching ships as the conservative default. Define who verifies raw events and timing. |
| Source adapters | Confirm method/context vocabulary, mission-day boundaries, research filename/version identity, source/local-hour deduplication and null/omission conventions. Verify conflict flags against the source beyond individual request windows. |
| Persistence and roles | Approve lifecycle/audit storage, authorized roles, immutable IDs, transaction constraints and replay semantics. Task 2 reference rows use the existing field set. The audit log is a proposed persistence design outside the Task 2 record schema. |
| Information Status identity | Approve storage keys before persisting separate raw and comparison assessments or several sleep-field assessments for one record. Existing `information_status.record_ref` does not identify a field. |

The standalone module has been exercised against the shipped Python engine and the proposed Task 2 contract. App adapters, transactional storage, role permissions, screens and complete scenario journeys still require application-level tests.


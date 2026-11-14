# Data Status Handoff for Ahmed

Run from the package root with Python 3.9+ and its standard library. The source repository currently has no files. The package uses the Product Scope path `science/status.py`. Run `python -B -m unittest discover -s tests -v`.

## Calls

```python
from science.status import evaluate, information_status

context = {
    "subject": {
        "subject_profile_id": "sim:1",
        "subject_mode": "mission_simulation",
    },
}
record = {
    "measurement_id": "m1", "schema_version": "0.9",
    "subject_id": "sim:1", "data_origin": "simulated_mission",
    "is_simulated": True, "created_at_utc": "2026-11-14T09:00:00Z",
    "metric_code": "hr_resting_bpm", "value": 63, "unit": "bpm",
    "observation_date": "2026-11-14", "capture_method": "simulator",
    "source_metric_granularity": "daily",
}
assessment = evaluate("measurement", record, context=context)
row = information_status(
    "measurement", record, context=context, information_status_id="q:1",
    schema_version="0.9", created_at_utc="2026-11-14T10:00:00Z",
)
```

## Input

`kind` is `measurement`, `sleep_record` or `decode_session`. `record` uses the corresponding Task 2 mapping or `None` for an expected reading with no record. All records use the entity ID, `schema_version`, `subject_id`, `data_origin`, `is_simulated` and `created_at_utc`. UTC accepts ISO timestamps with seconds, optional fractional seconds and an explicit Z or +00:00. The entity payloads are:

- Measurement uses `metric_code`, `value`, `unit`, `capture_method`, `source_metric_granularity` and the appropriate `observation_date` (daily/hourly), `hour_local` (hourly) or `observed_at_utc` (event). Research additionally requires `source_file` and `source_field`. The metric registry fixes the supported resolution and units. Event format is validated, but the current registry has daily/hourly mappings only.
- Sleep uses `observation_date` and the observed fields in `SLEEP_UNITS`. Research uses `source_file`. App-generated live sleep uses `sleep_metric_method`. Simulated sleep attributes the source to the simulator by origin.
- DECODE uses `protocol_version`, `key_version`, `input_method` (keyboard/touch/other), `app_version`, `is_practice`, `planned_duration_ms`, `session_state` (started/completed/interrupted/aborted) and `start_at_utc`. Completed sessions need `end_at_utc` and `elapsed_monotonic_ms`. The planned and observed acceptance-window duration must both equal the documented 90,000 ms. Supply the measured game window, excluding callback latency, instruction time and review time. Do not round, clamp or substitute the planned duration for a measured duration. Supply `interruption_reasons` as an optional list of codes.

## Adapter context

These are keyword-call inputs and are outside the persisted application schema. Populate them from trusted backend or offline domain logic. A client submission alone cannot establish verification.

| Key | Contract |
|---|---|
| `subject` | Resolved profile with `subject_profile_id`, `subject_mode` and research `source_participant_id`. Mode mapping is real_research → real_research, simulated_mission → mission_simulation, live_decode → live_player, and application_generated input → live_player (provisional). DECODE allows live_decode and simulated_mission. |
| `source_link_verified` | Literal true after authenticating the research source row-to-profile link and dataset. |
| `events_verified` | Literal true only after verifying the complete raw ledger, including session and subject linkage, origin/mode, timing, acceptance, and any stored summaries. The engine requires this attestation for completed sessions and rejects inconsistent aggregate fields independently. All four summary fields can be omitted when the output is session quality only. If publishing summaries, supply both counts, unrounded accuracy for a positive accepted count, and the median when a correct response exists. Zero accepted requires null or omitted accuracy. Zero correct requires null or omitted median. |
| `duplicate_state` | none (default), exact (noncanonical copy), or conflict (all members). Use origin, subject partition, source, metric and timestamp as appropriate when grouping. Hourly groups need local date and hour. Preserve row locators and record IDs. |
| `require_measurement_context`, `conditions_compatible` | True on the first key requires the relevant existing context field. False on the second records known wrong conditions. Sleep uses sleep_metric_method and DECODE uses technical_context. |
| `comparison` | Omit or use null for raw evaluation. For a requested comparison pass an object with literal booleans `same_subject_partition`, `same_metric_unit`, `same_resolution`, `same_device_method`, `compatible_protocol`, `compatible_conditions` and `reference_sufficient`. False indicates a known mismatch. Missing/unknown indicates missing comparator evidence. Use a documented satisfied check where the dimension is inapplicable. Task 4 supplies reference sufficiency when available. For sleep, also pass `sleep_field` with the exact observed field name, for example `minutes_asleep` or `recorded_interval_ms`. Use the unit in `SLEEP_UNITS` for that field. Resolve the field and unit on both sides, and verify the documented `sleep_metric_method` against the comparator before setting the compatibility flags. The result describes that field only. Preserve the target in caller context and obtain approval for storage identity before persisting multiple sleep field assessments. |

## Output

`evaluate` returns `subject_id` and `record_ref` (string or null), `status` (one of four stable enums), `reason_codes` (ordered list of strings), `source_known`, `unit_verified`, `measurement_time_known` (booleans), `method_consistent` and `reference_eligible` (boolean or null), and `ruleset_version` (string). For the example record, status is valid, reasons are empty, the three quality flags are true, and both nullable flags are null. `reference_eligible` is a technical gate. Null means unassessed. False excludes the record for the current use, exact copies and practice. True means supplied comparison checks passed for that use.

`information_status` returns those keys plus `information_status_id`, `schema_version`, `created_at_utc` (caller-provided strings), `data_origin` (application_generated) and `is_simulated` (evaluated record flag). Follow `record_ref` within the checked subject partition to recover original provenance. If the app already has a genuine Task 2 measurement row with a null or omitted value, pass that row to persist `no_reading` against its actual record ID. Preserve the null value and the original observation date. If only an expected slot exists, call `evaluate(kind, None)` for display and defer persistence. Task 2 requires a non-null `record_ref` to a measurement, sleep record or DECODE session. Keep the raw observed record ID null where no record exists. An expected-slot ID cannot be written to this field under v0.9. The adapter resolves actual target records in storage before calling the helper.

Unsupported kind raises ValueError. A non-mapping context raises TypeError. Bad record evidence returns a status. Persistence errors raise ValueError. The caller owns IDs, time, storage and error-to-UI mapping.

## Sleep and DECODE consistency

The sleep check compares `minutes_asleep` with its corresponding `recorded_interval_ms` after unit conversion. Equality passes. Missing companion fields stay missing. Invalid or contradictory companions block reference use even in a field-specific assessment. The adapter must establish that the fields describe the same interval, as specified in Task 2. There is zero rounding allowance pending approval of source-specific precision and rounding. Other sleep fields have no new cross-field constraints.

For a completed 90,000 ms monotonic window, UTC start and end must describe that same window. Any UTC duration disagreement returns `incomplete` unless both `context.clock_adjustment_verified` and `context.events_verified` are literal true. An unverified reversed interval also reports `unknown_measurement_time`. The new context flag is outside the Task 2 schema. Leave it unset until a trusted adapter verifies that an actual clock adjustment explains the discrepancy and that event-ledger completeness, monotonic timing, and session continuity are intact. Capture the supporting audit evidence outside this result. A clock adjustment cannot override recorded interruption, pause, focus loss, suspension, or a protocol-duration mismatch.

Ahmed and the DECODE frontend owner must approve the timestamp capture semantics, producer precision, authoritative clock-change evidence and pause/suspension handling. If the producer uses coarse UTC timestamps or includes callback latency, agree the producer policy before interpreting exact disagreements. Confirm any source-specific sleep rounding rules with the data owner before enabling an allowance.

## Supported indicators

| Use | Engine support |
|---|---|
| P0 simulation | Contract HR and step metric codes, observed sleep fields, and DECODE session quality. |
| P1 LifeSnaps | Daily bpm and resting bpm, plus observed sleep fields. |
| P2 descriptive research | Hourly bpm and daily/hourly step counts. |
| Pending | `activity_minutes`, `nightly_skin_temperature` and `skin_temperature_variation` are recognized Task 2 codes with no verified runtime mapping here. Map `unsupported_metric` to unavailable or under review in the UI. |

Sleep values use the `sleep_record` entity. Task 2 uses `sleep_minutes_asleep` in a rule example, while its measurement enum excludes it. The runtime measurement registry follows that enum.

## Decisions for Ahmed and the DECODE frontend owner

1. Freeze Task 2 v0.9 or agree a versioned adapter. Confirm namespaced IDs, typed reference routing, null representation, the origin/mode matrix, and separate assessment identity for each sleep comparison target.
2. Decide how Scenario S2 persists an expected slot when an observation record does not exist. Options include an app-owned schedule or follow-up event referencing that slot, or a separately approved typed target reference. Neither adds or changes fields in the supplied Task 2 schema.
3. Approve DECODE ledger acceptance and the producer timing definition for each protocol revision. Specify end-window boundary, late and duplicate submissions, pauses, focus loss, clock precision and ledger closure including a verified zero-response session. Until approval, the engine uses the documented exact window and requires trusted ledger verification. Approve serialization of derived summaries and any future precision/tolerance policy explicitly.
4. Confirm source registry, research source linkage, duplicate canonicalization, metric mappings, and Task 4 compatibility inputs. Run app-adapter fixtures for research joins, duplicates, DECODE raw events and actual UI JSON serialization.

Import this module in a Python application. For a JS-only application, agree adapter or port behavior using the same fixtures after confirming the stack. Integration and application-level acceptance remain open.

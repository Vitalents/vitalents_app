# Data Status Decision Table

Ruleset `status-0.3.0`. Product Scope PDF page 7 defines the four statuses, explicitly including different devices, interrupted sessions and wrong conditions under noncomparability. PDF page 7 also keeps the comparison limited to documented matching conditions and preserves the raw result when reference evidence is insufficient. Master Specification pages 12, 15–17 and 25 specify acquisition quality, DECODE protocol and provenance. Scope Update sections 5–7 and 10 govern source isolation, local descriptive research and missingness. Task 2 v0.9 supplies field names and mappings. Its schema remains proposed.

## Decision order

Evaluate all applicable checks. The first matching row selects status. Reasons appear in missing, incomplete, incompatibility, then informational order. Repeated reason codes appear once. The ordering and exact gates are **PROVISIONAL**.

| Priority | Status | Condition |
|---|---|---|
| 1 | `no_reading` | Expected record absent, measurement value omitted/null, or the relevant sleep reading is omitted/null. A targeted comparison uses only the selected observed field. |
| 2 | `incomplete` | Record exists with missing or invalid technical evidence, invalid provenance or unresolved duplicate conflict. |
| 3 | `not_comparable` | Present technically documented record/session has an identified incompatibility, interruption, or an explicit comparison lacks sufficient context. |
| 4 | `valid` | Applicable checks pass for the requested use. A raw result can be valid before comparison evidence exists. |

A completed DECODE session with zero accepted answers can still be a technically valid session if its event ledger is verified, including the zero-response case. Preserve undefined accuracy and reaction-time summaries as null. A started session is incomplete. An interrupted or aborted session with sufficient session metadata is not comparable. A practice session can be valid and is excluded from reference use. DECODE keys can change within a compatible protocol. Neither slow reaction time nor a low score alone affects technical quality.

Exact duplicate observations remain visible with a reason and are excluded from reference entry for the copy flagged by the adapter. The caller chooses the canonical row and retains every original row locator. Conflicts require review across affected observations. Key discovery and resolution belong to the adapter.

For sleep, raw `unit_verified` requires at least one present observed field with a dictionary-defined unit and valid numeric values for the observed fields. In a targeted assessment the flag applies to the selected field only. Eligibility also requires documented method and passed target-specific comparator checks. Verified units and protocol comparability are separate flags.

## Reason codes

| Code | Meaning |
|---|---|
| `missing_record`, `missing_value` | No supplied record or no applicable primary observed value. |
| `invalid_record_type`, `invalid_value` | Record is not an object, or observed data is nonnumeric, nonfinite, boolean or negative for the supported value fields. |
| `invalid_provenance` | Origin is unrecognized or inconsistent with entity or simulation flag. |
| `unverified_subject`, `subject_source_mismatch` | No resolved profile, or the profile ID, partition or research-source linkage failed verification. |
| `invalid_record_metadata` | Record ID, schema version or persistence UTC time is missing or malformed. |
| `unknown_source` | Source attribution required for the entity is absent or unusable. |
| `unknown_measurement_time` | Appropriate local date/hour or UTC timing is missing or invalid, or a research row claims unsupported UTC time. |
| `unknown_metric`, `unknown_unit` | Metric lacks a supported mapping or its unit cannot be verified. |
| `unknown_granularity`, `temporal_resolution_mismatch` | Resolution missing/unsupported, conflicts with metric, or differs across comparison records. |
| `source_metric_mismatch` | Research field differs from the documented source column. |
| `missing_measurement_context` | Caller requires conditions for the intended use and the entity lacks their description. |
| `wrong_conditions` | Adapter identifies incompatible measurement or comparison conditions. |
| `session_interrupted`, `session_unfinished` | Interrupted/aborted session or session has no recognized terminal state. |
| `missing_decode_metadata`, `missing_decode_timing` | Required DECODE protocol, app, key, practice or input metadata, or completed-session monotonic duration is unavailable. |
| `protocol_duration_mismatch` | Planned duration differs from the 90-second protocol or the completed measurement window differs in either direction. |
| `unverified_decode_events` | Completed session lacks adapter verification of supporting events and any summaries. |
| `invalid_interruption_reasons` | Interruption codes have an invalid type or content. |
| `incomplete_decode_summary`, `invalid_decode_summary` | A supplied summary lacks required companion fields or violates the Task 2 summary definitions. |
| `missing_sleep_comparison_target`, `missing_sleep_target_value`, `unknown_sleep_method` | No supported field selected, selected observation absent, or target method undocumented. |
| `sleep_asleep_exceeds_interval` | Estimated minutes asleep exceed the corresponding interval after conversion to milliseconds. |
| `unverified_decode_clock_disagreement` | A completed 90-second monotonic measurement has a different UTC duration and lacks verified clock-change evidence. |
| `unsupported_metric` | Task 2 measurement code recognized, with runtime mapping awaiting verification. |
| `duplicate_observation`, `conflicting_duplicate`, `unknown_duplicate_state` | Identical copy, disagreement within a duplicate key, or invalid adapter classification. |
| `missing_comparison_context`, `insufficient_reference` | Comparison preconditions unverified or Task 4 evidence explicitly insufficient. |
| `comparison_subject_mismatch`, `comparison_metric_mismatch` | Different subject/partition or different metric/unit for the requested comparison. |
| `device_method_mismatch`, `protocol_mismatch` | Different device or method, or incompatible protocol. |

The registry preserves daily and hourly bpm separately from resting HR, and daily steps separately from hourly steps. Sleep interval is `recorded_interval_ms` in milliseconds while `minutes_asleep` is estimated minutes asleep. A derived hours field cannot establish reading presence. Keep all absent values null or omitted. Supported research time uses the original local calendar date and integer hour where required. Unverified temperature fields remain outside the registry. Technical validity carries no clinical classification, diagnosis or readiness score.


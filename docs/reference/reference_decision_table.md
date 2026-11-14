# Personal reference decisions

The module builds descriptive comparisons for one metric under one versioned policy. The supplied resting-HR demo policy uses five distinct preceding days in a fourteen-day lookback. Each other metric requires an explicit policy. These counts are engineering heuristics. They carry no clinical meaning.

## Status rules

| Stage | Result | Rule |
|---|---|---|
| Build | `not_built` | The target or selected metric cannot be verified, or the lookback contains zero eligible days. The reference value is null. |
| Build | `provisional` | At least one eligible day exists and the policy minimum has yet to be met. The reference value is null. Counts and source evidence remain available for audit. |
| Build | `usable_for_question` | The configured number of eligible days is met for a verified target. The median describes that metric in the recorded context. The candidate requires a recorded activation decision before use. |
| Compare | `not_built` | No active version is visible at the comparison as-of time, the target or the version is incompatible, or the version's target or source dates postdate the comparison target. |
| Compare | `needs_review` | A compatible active version is under an explicit review hold, or the requested policy differs from the version's policy. The comparison value and difference are null. |
| Compare | `usable_for_question` | An active or explicitly frozen version passes the target, temporal and policy checks. The difference is observed value minus reference value, in the original unit. |

Build status describes a candidate. Compare status describes whether the application can use a published version for the current question. The Task 3 Information Status reflects reading and comparison quality. The application owns Follow-up Status.

## Eligibility and aggregation

| Dimension | Rule |
|---|---|
| Subject and origin | Match data origin, subject mode, subject ID and timestamp basis. For research also match authenticated participant and dataset revision. Discard other partitions before grouping and redact their IDs in the exclusion audit. |
| Time | Use dates in `[target day − lookback, target day)`. Research uses the source's local date and hourly slot, with unknown UTC offset. Simulation uses the mission date. Application-generated readings use the profile's UTC date. DECODE uses the UTC start date and requires the end to fall before the target's UTC date. Adjusted DECODE clock disagreement is excluded from temporal ordering even when Task 3 accepts the session for raw quality. When both measurement UTC times exist, the historical time must also be strictly earlier. The caller supplies the history available to the analysis as of its data snapshot. |
| Measurement | Task 3 validates units, source and granularity. Match the capture method, source file/field and `measurement_context` exactly. Hourly references compare the same local hour across dates. Supported groups are daily and hourly HR, resting HR, and daily and hourly steps. |
| Sleep | Compare a selected daily field in its verified unit with the same documented `sleep_metric_method` and source file. `minutes_asleep`, `minutes_awake`, `minutes_to_fall_asleep` and `minutes_after_wakeup` use minutes. `recorded_interval_ms` is the recorded interval in milliseconds. Task 3 checks that minutes asleep fit within the interval when both are present. Derived hours and source sleep efficiency are outside this registry. |
| DECODE | Use completed, event-verified, non-practice sessions. Require exact protocol, key, planned duration, app version, input method, technical context and exposure-band matches, plus verified familiarization. Supported results are accepted response count, correct count, accuracy percent and median correct latency in milliseconds. Undefined selected summaries stay absent. Familiarization and matched exposure reduce a comparability problem. Residual practice effects remain a limitation. |
| Values and duplicate records | Task 3 rejects invalid values, contradictory summaries, and explicit duplicate flags. Null and omission both represent absence. Use observed zero where accepted by Task 3. Group research rows by source file, metric and date/hour, and use DECODE start instant for sessions. Group other measurements by documented method, source, conditions and date/hour. Group other sleep records by date, source and method. Exclude every member of contradictory groups or reused conflicting IDs within the candidate window. Keep one eligible identical copy in deterministic ID order. Adapters must attest broader source conflicts when their records fall outside the candidate slice. |
| Calculation | Use the median within each eligible day, then the median across days. This gives each day equal weight. No interpolation fills gaps. The audit includes each contributing observation, the daily values, calculation and policy versions, excluded record IDs and reason codes. |
| Unsupported fields | Return `unsupported_reference_metric`. Examples include unverified temperature, activity minutes, sleep efficiency, questionnaire scores and any composite readiness score. |

## Lifecycle

- Activation records the full candidate, a unique version ID, reviewer identity and role, UTC decision time and rationale. A replacement requires a later comparison target, a new ID and the expected currently active ID. Earlier versions stay available in the log.
- A freeze retains the active baseline for compatible comparisons and blocks replacement. An explicit review hold blocks comparisons and replacement. A recorded resolution clears the hold or freeze and keeps the same active baseline until a separate activation.
- Comparison is read-only. A published reference retains its original fit window, including when later observations extend beyond that window. The demo has no automatic expiration or decline threshold. A sustained change can trigger a manual freeze or review without recalculating the baseline.
- The log can be serialized and restored through the provided functions. Role checks and durable transactions belong to the application adapter.

The project scope update supplies the descriptive comparison and data-separation requirements. The Task 2 contract defines the names and units of the observations. The Task 3 ruleset supplies the quality checks.


# Tasks 6 and 7 decision tables

## Daily review

Inputs are scoped to one subject and one mode. Information status comes from Task 3 and comparison from Task 4. Existing follow-up states are returned independently.

| Condition | Observation or limitation | Step offered and decision owner |
|---|---|---|
| Explicit review request, scoped symptom report, or review already open | Include request, report, or follow-up IDs. Retain all data and plan findings regardless of DECODE. | 1. `request_review` for medical review. Prepare or continue the existing workflow. |
| Exact approved medical rule match with the required records, quality, evidence and approval | Trace the rule, evidence and supporting records. Preserve the descriptive results. | 1. `request_review`, medical |
| Expected slot absent, incomplete, or interrupted | Retain raw and assessed information states and their reason codes. | 2. `complete_measurement`, astronaut, when permitted |
| Exact approved plan match with required records, quality, evidence and approval | Trace the rule and evidence versions, input record/reference IDs and decision owner. | 3. `approved_plan_step`, rule's decision owner |
| Comparable signed difference or unavailable/unsupported comparison | Display separate metric observations and limitations. A signed difference is descriptive and carries no clinical interpretation. | 4. `observe` if no higher-priority proposal applies, astronaut |
| Expected match missing, unapproved rule, insufficient evidence or wrong role | Return a limitation for that rule version. Continue considering independent proposals. | No proposal from that match |

Priority is a workflow default. Within a category, user-initiated or existing review comes before matched rules. Otherwise, ties follow caller order. Exactly one main step is selected. Other proposals, readings and follow-ups remain visible. Built-in workflow proposals cite Product Scope v1.2 M4/M8. They are in-memory proposals, and approved matches carry the supplied rule and evidence IDs.

## Schedule comparison

| Condition | Result |
|---|---|
| Missing required baseline inputs, buffer values or resource calendars | `insufficient_constraints` with reason. Explicit zero buffers and empty resource lists are accepted. |
| Baseline intervals invalid, overlapping, outside the horizon, or inconsistent with resource availability | `invalid_constraints` with reason. |
| Move changes fixed work or task duration, overlaps occupied time, exits the horizon, uses another clock, or exceeds availability | Alternative is `rejected` with reasons. |
| Valid baseline and no feasible supplied alternative | `no_valid_alternative`. Includes baseline rest opportunity and any proposal rejection reasons. Covers S3. |
| Feasible move lacks approvals | `pending_approval` and required roles. Show rest intervals, total, longest continuous interval and deltas. |
| Feasible move has every required role approval for the exact key | `valid` and approval references. Adoption is owned by the application and responsible humans. |

Intervals are half-open with full dates. Occupied time includes preparation before start and transition after end. Resources must be available through the buffered interval. Rest opportunity is the sum of free intervals in the target window. Sleep is a separate measurement.

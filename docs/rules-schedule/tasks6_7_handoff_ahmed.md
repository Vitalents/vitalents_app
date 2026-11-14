# Tasks 6 and 7 handoff for Ahmed

Extract the ZIP into a fresh directory and run `python -B -m unittest discover -s tests -v`. The consolidated Tasks 3–5 package is included so both modules and all original tests run together.

## Python entry points

- **Rules** — Call `science.rules.evaluate` with ordered `Reading` slots wrapping `reference.Observation`, the authenticated subject partition and UTC as-of time. Supply the selected metric policy and reference series where applicable. Send the authorized snapshot of symptom reports, review request IDs and existing follow-ups. A missing expected slot uses `Observation(None, {})`. Use `main_next_step` and render independent findings, other proposals and follow-up states. Render raw quality separately from comparison eligibility. Each nonzero comparable difference is descriptive.
- **Approved matches** — Supply `ApprovedMatch` only after the authorized workflow verifies the exact predicate, decision, approval scope, currency and evidence. Bind it to the ordered slot, input record and reference IDs. Use immutable input records or adapter-verified revisions, and recompute matches after corrections. Index approved rule definitions and evidence by exact (ID, version). Pass `expected_rule_versions` for decisions expected at this review whose approved match may be absent. The Task 2 condition description is prose. There is no clinical predicate interpreter. The accepted quality modes are `valid` and the explicit runtime option `reference_eligible`.
- **Schedule** — Call `science.schedule.compare` with the simulated subject's complete Task 2 schedule snapshot, an explicit constraint horizon, linked target rest window, resource availability and named alternatives with one or more time-only moves. Supply resource calendars net of external bookings. Zero means a confirmed zero buffer. An empty resource list means no extra resources. Use `clock_basis="UTC"` for explicit UTC timestamps, including Task 2's "UTC demo clock", or `fixed_rate_mission_clock` for a verified offset-free clock with full dates and no discontinuities. Convert other clocks explicitly before calling. The calculator compares supplied moves. S3 applies to that candidate set.
- **Adoption** — A feasible proposal stays pending until all required roles approve the exact `proposal_key`. Supply trusted `Approval` records from the application. Recheck against the current baseline, calendars, role grants and approvals in the application transaction before adoption. The result is a calculation and approval check. The module has no write path.

The dataclasses and result dictionaries are runtime interfaces. Keep Task 2 persisted field names and enums. Ahmed's adapter owns generated IDs, timestamps, record links, the in-memory-to-persistence mapping, deduplication, authorization and lifecycle transitions. For a review request, prepare a restricted summary from authorized record references and let the user preview sharing. Planner-facing responses should contain operational schedule information only.

## Unresolved approvals

| Owner | Decision |
|---|---|
| Amr and team | Sign off on the workflow priority, tie order, rule wording and evidence. Confirm which rule versions and metric policies are eligible in each mode. |
| Medical owner | Approve any actual plan, applicable predicate, permitted action and symptom or urgent handling protocol. Approved clinical limit sets and emergency protocols were absent from the handoff. The only approved-plan records in the new fixtures are synthetic. |
| Planner and medical owners | Confirm schedule data completeness, clock and buffer conventions, resource booking/availability source, and which roles approve each move. The chosen buffer convention is prep before work and travel after work. Confirm any task move windows or dependencies when assembling permitted candidates. |
| Ahmed | Confirm authenticated role and approval binding, immutable record revisions, approval revocation and transaction behavior, persistence mapping, and review/share privacy. Test app adapters and scenarios before declaring application integration. |

The Task 2 and Tasks 3–5 open decisions continue to apply. This work uses synthetic fixtures and needs no LifeSnaps redistribution.

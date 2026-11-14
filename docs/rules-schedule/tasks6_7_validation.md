# Tasks 6 and 7 validation

## Results

| Suite | Passed | Failures | Errors | Skipped |
|---|---:|---:|---:|---:|
| Tasks 3–5 baseline | 161 | 0 | 0 | 0 |
| Task 6 rules | 18 | 0 | 0 | 0 |
| Task 7 schedule | 18 | 0 | 0 | 0 |
| Complete suite | 197 | 0 | 0 | 0 |

Counts are unittest methods. Run `python -B -m unittest discover -s tests -v` from the ZIP root. Verified with Python 3.12.14 and 3.15.0 on Windows. The final ZIP was also re-extracted and checked with 3.12.14.

## Validation scope

- S1 verifies two descriptive differences through the original Python engines and resolves a synthetic approved plan with exact evidence, record and reference bindings.
- S2 covers missing sleep, interrupted DECODE and a missing selected game metric. It preserves open follow-up state and supplies no invented reading.
- S3 rejects a move blocked by fixed work and a move of a fixed task, preserves the baseline calculation and returns `no_valid_alternative`.
- S4 preserves a scoped symptom with an unsupported temperature metric and favorable DECODE performance. Review wins even alongside missing data and a matched plan.
- Edge tests cover incorrect rule versions and quality, role mismatches, cross-mode isolation, approvals bound to schedule constraints, buffer and calendar conflicts, date rollover, invalid intervals and zero-length rest opportunity.
- Additional read-only smoke checks used Task 2's supplied synthetic schedule, sleep and follow-up examples. The test fixtures in this ZIP are synthetic.
- Self-review caught a metric relabeling path and stale reference approval risk. Both were fixed and covered by regression tests. The 161 baseline tests and all original handoff files were retained byte-for-byte. The Task 2 schema is unedited.

Validation covers standalone Python behavior, including calls to the actual Data Status and Personal Reference modules. Application authentication, persistence, sharing, end-to-end scenarios, clinical validity and S5 sync are outside these test results.

## Source trace

- Vitalents Product Scope v1.2, M4–M5, M8 and M10.
- Scope Update, sections 4–8, including separate statuses, descriptive comparisons and S1–S4.
- Task 2 Data Dictionary, Core Entity Fields, Enumerations and Relationships. Task 2 synthetic examples.
- Tasks 3–5 consolidated handoff, `status-0.3.1` and `reference-1.0.1`.

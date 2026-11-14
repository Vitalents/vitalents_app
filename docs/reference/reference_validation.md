# Personal reference validation

## Reproduce the test runs

Apply this ZIP over a fresh extraction of `Vitalents-Task3-final.zip`. Run from the combined package root.

```console
python -B -m unittest discover -s tests -p test_reference.py
python -B -m unittest discover -s tests -p test_status.py
python -B -m unittest discover -s tests
```

| Local suite | Passed | Failed | Errors | Skipped |
|---|---:|---:|---:|---:|
| Task 4, including 5 Task 3 and contract integration tests | 40 | 0 | 0 | 0 |
| Task 3 existing regression suite | 88 | 0 | 0 | 0 |
| Combined discovery run | 128 | 0 | 0 | 0 |

The combined run repeats the two preceding suites. Tests ran on Windows using Python 3.12.14. All six files from the supplied final Task 3 archive were checked byte-for-byte before packaging. The Task 3 engine reported ruleset `status-0.3.0` and SHA-256 `bfa37a29f08a03b6df29473eb60ccd0e59c41a0939336a0495265d8401d4ecf2`.

## Contract checks

Three additional local contract checks passed, one each for measurement, sleep and DECODE. For each check, the Task 4 `personal_reference` projection and Task 3 `information_status` output were serialized and compared directly with the required and allowed fields in Task 2's core-fields CSV and enums in its contract metadata JSON. The checks also verified date order, unique source IDs, finite reference values, simulation labeling and comparison eligibility. The application audit event is a separate adapter object. It carries the full calculation and review history using the existing reference ID. The Task 2 schema is the proposed v0.9 contract, which does not include an application runtime validator.

## Synthetic coverage and limits

- Reference tests check day counts, robust aggregation, null and omitted values, measured zero, unsupported metrics, units, method, context, granularity, date window boundaries, timestamps, duplicate handling, research/source isolation and DECODE quality and familiarization.
- Lifecycle tests cover immutable publication, replacement and retry behavior, clock bounds, freeze and review, policy revision, replay from serialized audit data and reference-ID isolation.
- S1 compares simulated sleep and DECODE latencies independently. Across four consecutive simulated changes the sleep reference stays at 420 minutes and the DECODE reference at 620 ms. The two observations make no inference about cause. The outside follow-up fixture remains `watching`.
- S2 tests an absent sleep value, a slot without a source record and an interrupted session. Sleep returns `no_reading` for the selected field and the interrupted session returns `not_comparable`. No comparison difference is returned. The outside follow-up fixture remains `action_open`.
- Local results exercise Python module interoperability and contract shape with synthetic data. Application-level tests are pending for adapter attestations, live event verification, database transactions and access controls, and the end-to-end scenario screens. There was no validation on raw LifeSnaps participant rows or actual DECODE player data.

## Basis for descriptive comparisons

The supplied scope update and Product Scope ground the project behavior. The Task 2 audit and Fitbit field documentation distinguish the recorded interval from accumulated minutes asleep. The LifeSnaps study explains the local time and anonymized offset. A primary repeated-testing study documents practice effects in a written symbol-digit task. That finding motivates treating matched exposure as a comparability requirement for this demo. It does not establish a DECODE familiarization cutoff or validate DECODE as an assessment.

- [LifeSnaps study and anonymization method](https://pmc.ncbi.nlm.nih.gov/articles/PMC9622868/)
- [Fitbit sleep log fields](https://dev.fitbit.com/build/reference/web-api/sleep/get-sleep-log-by-date/)
- [Repeated assessment and practice effects in the written Symbol Digit Modalities Test](https://pubmed.ncbi.nlm.nih.gov/25994156/)


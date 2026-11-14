# Task 5 tests and integration handoff

This ZIP is a standalone Python package containing both Vitalents engines, the original Task 3 and Task 4 tests and fixtures, and the added synthetic Task 5 tests. Extract it into a fresh folder and run from the package root.

```console
python -B -m unittest discover -s tests -v
```

## Verification

| Suite | Passed | Failures | Errors | Skipped |
|---|---:|---:|---:|---:|
| Original Task 3 status tests | 88 | 0 | 0 | 0 |
| Original Task 4 reference tests | 40 | 0 | 0 | 0 |
| New Task 5 status unit and boundary tests | 13 | 0 | 0 | 0 |
| New Task 5 reference and cross-engine tests | 20 | 0 | 0 | 0 |
| Complete suite | 161 | 0 | 0 | 0 |

The new reference suite includes six cross-engine tests. Counts use unittest test methods. Parameterized subcases and the permutation check are included within those methods. All input examples are synthetic. The original tests and fixtures are included byte-for-byte. The complete suite was verified on Windows with Python 3.12.14, including a run from a fresh extraction of the final ZIP.

## Confirmed bugs fixed

- Task 3 now rejects a DECODE median correct reaction time above the documented 90,000 ms acceptance window with the existing `invalid_decode_summary` reason. Task 4 excludes that session. This is a protocol consistency check.
- Task 4 now treats equal valid UTC instants as equal when detecting duplicates, including `Z`, `+00:00`, and equivalent fractional spellings. It retains the selected source's original timestamp in the audit.
- Task 4 lifecycle decisions and comparison as-of times now use the same UTC parser as Task 3. The format requires a date, time with seconds, and an explicit UTC suffix. Older audit records using this format replay with their recorded calculation versions. If an adapter stored a compact timestamp or omitted seconds, review and normalize the timestamp before replay.

## Integration

Use `science/status.py` and `science/reference.py` together. They report versions `status-0.3.1` and `reference-1.0.1`. Record fields, enum values, the persisted reference schema and the audit shape follow the existing contract. Existing reference versions remain in the audit log. If a historical DECODE baseline used an impossible summary, use the existing documented review and replacement workflow, keeping the prior version in the log.

Local tests cover comparison compatibility, source isolation, audit replay, and synthetic S1 and S2 through the Python APIs. Real application adapters, transactional persistence, permissions and end-to-end screens still require application-level verification.


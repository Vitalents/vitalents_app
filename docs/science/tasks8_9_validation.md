# Tasks 8 and 9 validation

| Suite | Passing unittest methods |
|---|---:|
| Original Tasks 3–7 | 197 |
| Task 8 simulation and cross-module tests | 8 |
| Task 9 DECODE verifier tests | 21 |
| Total | 226 |

The full suite passed on Windows with Python 3.12.14 and 3.15.0 from a fresh extraction of the delivery ZIP. There were zero failures, errors, and skips. All original engine, test and fixture bytes match the Tasks 6–7 handoff. The root README now covers the consolidated package. No blocking issue required editing an existing engine.

## Reproduce

```console
python -B -m unittest discover -s tests -v
python -B -m science.simulator --out mission_replay.json
```

Replay SHA-256 under both tested runtimes, with sorted JSON keys, UTF-8 and LF line endings.

```text
e3827e7bd43ffd9132ad8d28bb7e8d5af89cdd95cb59ffe5f6f02c774d22252d
```

- Task 8 checks S1–S4 against fixed expectations for raw and assessed Information Status, reference values and deltas, proposal priority, follow-up state, schedule feasibility and approval, and specialist preview scope. All 24 generated DECODE ledgers re-verify against the generated summaries. The suite tests isolation across two fictional subjects and compatible key-version filtering.
- Task 9 checks a mixed hand-derived vector with 4 accepted attempts, 3 correct, 75% accuracy and 401 ms median correct RT. It exercises odd/even medians, zero and undefined outcomes, response timing at the protocol boundaries, malformed and missing rows, replay of immutable IDs, valid duplicate and late attempts, interruption, practice, provenance, and propagation of missing ledger evidence into the existing quality and review engines.
- These results describe deterministic software behavior. Browser and device capture, production timing and phase order, application storage and permissions, S5 sync, and clinical or readiness validity are outside this validation. The handoff records the provisional ledger conventions and corresponding integration checks.

## Source trace

- Product Scope v1.2 M3–M5 and M8–M10 supply the DECODE procedure, workflow and scenario expectations. Scope Update sections 4–8 supply the provenance, missingness and descriptive reference constraints.
- The proposed Task 2 dictionary, metadata, example records and open decisions supply the record fields, enum values and ledger contract. The relevant contract files are copied in `task2_contract/`.
- Original engines are the supplied Tasks 6–7 handoff, which includes Tasks 3–5. All new measurements, responses, approvals and scenario records are generated synthetic fixtures.

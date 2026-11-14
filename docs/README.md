# Documentation

Start with the [project overview](../README.md) and [live demo](https://vitalents.life/).

| Read | Purpose |
|---|---|
| [Demo guide](demo-guide.md) | A short walkthrough of Fahim's simulated day, plus optional Decode and counter-scenarios |
| [Architecture](architecture.md) | How the browser, deterministic engine, data tools and optional assistant fit together |
| [Validation and limitations](validation.md) | What the recorded checks establish and what remains unverified |
| [Sources and credits](credits.md) | Scientific background, source-review status, AI disclosure and fictional media |
| [Contributing](../CONTRIBUTING.md) | Setup, checks and product invariants |

## Technical reference

| Read | Purpose |
|---|---|
| [Data contract](CONTRACT_P0.md) · [schemas and vectors](../contracts/) | Record shapes, missing-value policy, origins and D-1–D-13 decisions |
| [Requirements](SRS.md) · [design system](DESIGN.md) | Requirement IDs and design intent; current code and test results establish implementation |
| [App](../app/README.md) · [science](../science/README.md) · [research](../research/README.md) · [assistant](../ai/README.md) | Component-specific setup and reproducibility |
| [Engine integration notes](reference/INTEGRATION_NOTES.md) | App D-10 policy versus the independent scientific estimator |
| [Dictionary](data-dictionary/README.md) · [status API](data-status/api.md) · [reference API](reference/api.md) · [rules and schedule API](rules-schedule/api.md) | Detailed interfaces and constraints |
| [Data provenance](science/data-sources.md) · [replay and Decode](science/replay-and-decode.md) | Distinct data origins and simulation boundaries |
| [Proof format](proof/validation_schema.md) · [historical validation](science/validation-history.md) | Evidence structure and dated scientific-package checks |
| [Source catalog](../content/SOURCES.md) · [media provenance](media-provenance.json) | Attribution and reproducibility records |

Historical reports retain their original scope; older counts are not a statement about the current checkout. Simulation results and passing software tests are not evidence of clinical validity.

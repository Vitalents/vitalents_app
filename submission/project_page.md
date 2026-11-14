> **Project-page draft · 14 November 2026.** Repository facts and source links are filled in. Event registration, the exact challenge Resources match, current submission rules/deadline and the presentation artifact still require external confirmation; see `submission/checklist.md`. This file does not record submission or team approval.

# Vitalents · NASA Space Apps 2026

## Challenge

[Create Health Monitoring Software for Astronauts on Space Missions](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/)

## Summary

Vitalents demonstrates astronaut health follow-up: collect, review, understand, act, follow and review the plan. It brings simulated physical indicators, a 90-second symbol task called Decode and self-assessment into a body map and personal record. Data quality, follow-up status and delivery status remain separate. Decode and alertness are displayed side by side, without a combined health score.

The browser engine applies explicit demonstration rules and proposes steps for a human owner. Completing a step without a suitable later reading leaves it awaiting review. Recording an observation does not close the follow-up; the owner reviews it and closes separately with a reason. Nothing establishes that a step caused a change.

A local language model can explain source material with citations. Its citation and refusal checks do not guarantee scientific accuracy, and the core workflow does not depend on it. Sharing and communication delay are simulated locally; role views demonstrate access boundaries in one browser, not authenticated clinical accounts or real ground communication.

This is an educational prototype with simulated histories. A live Decode round can be added to that history and is labelled separately. It is not a medical device. The custom task, thresholds and follow-up policy need independent validation before any clinical use.

## Links and demonstration

- [Functional app](https://vitalents.life/) · [fallback deployment](https://vitalents.pages.dev/)
- [Source repository](https://github.com/Vitalents/vitalents_app)
- Five simulated scenarios: S1 Fahim's performance change, S2 missing measurement, S3 no schedule alternative, S4 symptom requiring review despite a good Decode result, S5 communication delay.
- A final submission video or slide deck has not been produced in this phase. The app link is a functional experience, not a claim that the presentation requirement is complete.

Cloudflare Pages builds force reviewed `cached` mode; the public site does not rely on the separately running live backend. Local `auto`/`live` mode can use the laptop assistant, including the optional `ask.vitalents.life` tunnel. Ollama remains on the laptop. The live backend must receive the updated corpus and be reviewed separately before public reconnection. Core use is local after the app and assets have been loaded; first access and an uncached scenario need connectivity.

## What is implemented

| Area | Demonstrated behavior and boundary |
|---|---|
| Body map | Seven domains; heart, sleep, cognition and symptoms have the core simulated workflow. Nutrition, movement and radiation use sample/context cards. |
| Daily check | Sleep, alertness and mood; missing readings remain missing. Personal reference comparison is used only when the metric and reference support it. |
| Decode | Nine symbol-to-digit mappings, 90 seconds, response timestamps and separate late/duplicate/interrupted events. A short presentation round is excluded from measurement references. The custom browser task is not the validated research battery. |
| Personal reference | D-10 demonstration policy: earlier valid readings in 14 days, median and min/max, at least 5 values, with the first 2 Decode sessions excluded. A follow-up freezes its reference. These are team parameters, not NASA medical cutoffs. |
| Actions and follow-ups | Explicit owners, source-linked reasons, a later observation review and manual closure. Observations without a comparable reference are labelled as observations, not effects of the action. |
| Scheduling | Compares rest opportunity within task constraints and planner approval; no feasible change produces an explicit no-alternative result. Opportunity is not measured sleep or proven benefit. |
| Sharing | Previewed summaries, local delivery-state simulation and an explicit medical review event. Private notes are excluded from shared summaries. Role switching is a demo, not authentication. |
| Assistant | Local retrieval plus a model, citation/number/refusal checks, knowledge gaps and a source-comparison publication policy for recorded fallback entries. No guarantee of live scientific entailment. |

## Technology and reproducibility

- React 19, TypeScript, Vite, React Router, Zustand, Dexie/IndexedDB and Recharts; Vitest and Playwright for software checks.
- Python 3.11 for simulation, research analysis and the contract oracle. The app's D-10 policy is checked against `science/contract_logic.py` and shared `contracts/vectors/`. The independent `science/reference.py` research estimator has a different scope; it is not interchangeable with the app policy.
- FastAPI, LangChain, Ollama `gpt-oss:20b` and `nomic-embed-text`. Cloudflare Pages serves the app; the optional Cloudflare Tunnel exposes the assistant API, not Ollama.
- JSON Schemas and semantic fixture checks; generated fixtures, research examples and proof records carry their source files and denominators. Simulated test outcomes do not measure clinical accuracy or health benefit.

## AI disclosure and measured limits

AI coding agents assisted implementation, tests, research comparison and documentation under the project specification. The repository records software checks and source comparisons; it does not establish that every change was personally approved by every team member. No final AI image/video disclosure for the future presentation is asserted here.

The saved `science/out/assistant_eval_gptoss.json` records `gpt-oss:20b`: 9/10 expected source-title matches for answerable questions, 5/5 expected abstentions, 14/15 combined checks and 2/15 blocked responses. This evaluation checks title matching and refusal behavior, not claim accuracy, and predates the current source metadata corrections. No new live-model evaluation is claimed.

The five-entry recorded fallback preserves its original raw model recording. Source comparison withdrew the sleep explanation's unsupported guarantee and the pulse explanation's unsupported absolute/misattributed claim; both now show an explicit publication-review refusal. The retained light explanation's science text is unchanged. New recordings cannot inherit approval from an older answer to the same question.

The 14 November source audit retrieved 34 sources and matched 97 displayed excerpts and 168 corpus fragments to source text. Nine printed-page locators were corrected. These checks establish quotation traceability within their stated scope, not clinical validation, complete redistribution permission or human source approval. All sources remain `draft`; `ai/source_verification.json` records source hashes, rights uncertainty and corrections.

## NASA resources used

These sources provide background and explanatory excerpts. They are not astronaut measurement data and do not approve the app's numeric rules. The exact match to an item on the official challenge Resources tab remains an external submission check.

| Source | Use |
|---|---|
| [5 Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/) | Context for the domain map |
| [Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/) | Named research risks |
| [Risk from Inadequate Sleep and Irregular Schedules](https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/) | Sleep background |
| [Risk of Behavioral Changes and Psychiatric Disorders](https://www.nasa.gov/reference/risk-of-behavioral-changes-and-psychiatric-disorders/) | Behavioral-health context |
| [Spaceflight Standard Measures](https://www.nasa.gov/humans-in-space/spaceflight-standard-measures-characterizing-how-humans-adapt-in-space/) | Measurement context |
| [Medical Operations technical brief](https://www.nasa.gov/wp-content/uploads/2025/08/ochmo-tb-044-medical-operations.pdf?emrc=69583461d2c7e) | Medical roles and communication context |

## Other sources and credits

- [ESA: Radiation and magnetic fields](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Proxima/Radiation_and_magnetic_fields): radiation context; redistribution rights remain unverified.
- [University of Pennsylvania: Cognition test battery](https://www.med.upenn.edu/uep/cognition.html) and [Basner et al., 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4691281/): background for the nine-symbol, 90-second DSST structure. Their research validation does not transfer to this custom implementation; open redistribution licences have not been established for these excerpts.
- [Dev et al., 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11614644/), *Cognitive performance in ISS astronauts on 6-month low earth orbit missions*: research context, CC BY as stated by the paper.
- [LifeSnaps v4](https://zenodo.org/records/7229547), [dataset paper](https://www.nature.com/articles/s41597-022-01764-x): credited Earth-based wearable dataset, CC BY 4.0. It is a candidate for separate descriptive evaluation, not astronaut data. The current app's research examples are synthetic; this release claims no measured LifeSnaps result.

The complete source index is `ai/corpus/sources.json`, with display excerpts in `content/library.json` and `content/library.extra.json`. NASA's general reuse guidance is not blanket clearance for third-party material. Remaining source-specific rights and team review belong in the submission handoff.

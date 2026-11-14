> **DRAFT · owner: Amr Abd ElHaleem.** Edit freely. Every `[bracket]` is a placeholder that must be replaced with a real value before submitting. Do not add numbers that don't come from `science/out/` or the repo.

# Vitalents · NASA Space Apps 2026 project page

## Project name

Vitalents

## High-level summary

Vitalents is health follow-up that an astronaut understands and acts on. A body map brings together physical indicators, a 90-second cognitive task called Decode, and the astronaut's own self-assessment. For each change it shows the data, the context and the limits, proposes one step with its source and decision owner, and keeps a follow-up of what happened next. It compares each astronaut with their own past readings rather than a fixed population value, keeps information quality, follow-up and connection status as three separate labels, and runs fully offline. A local NASA library answers questions with citations and refuses when the evidence is missing. Summaries for the medical team wait honestly through communication delay. All data in the demo is simulated. Vitalents supports human decisions; it does not diagnose or decide readiness.

*(Word count: about 140.)*

## Link to demo

[Link to the 7-slide deck or the 30-second video — Youssef/Amr add before submitting]

## Link to final project

https://vitalents.life
Fallback if the domain is not active yet: https://vitalents.pages.dev

The public site runs in demo mode with simulated data. The onboard assistant runs on a local model, so the public site shows answers recorded from that model, labelled as such.

## Detailed project description

### What it does

On a long mission, an astronaut needs to understand a measurement in its context, know what deserves follow-up, and know the next step, while help from Earth can be minutes away. Vitalents follows one loop: **collect → review → understand → act → follow → review the plan.**

### How it works

- **Body map.** Seven domains: heart and circulation, sleep and daily rhythm, cognition and subjective state, symptoms and temperature, nutrition and hydration, movement and exercise, radiation exposure. Four are live in the demo; three are sample cards. Each domain card has three tabs: **Now** (latest value, source, quality, trend against the personal reference), **Understand** (why it matters in space, its limits, NASA sources) and **Act** (how to measure, the next step, when to involve the medical team).
- **Three separate states.** Information status (is the data usable: valid, limited, stale, not comparable, incomplete, no reading), follow-up status (does it need attention) and connection status (has the summary been sent, delivered, reviewed) are never merged into one colour. "No reading" never means "fine", and the map never shows a health verdict.
- **Decode.** A 90-second task inspired by the Digit Symbol Substitution Test (DSST): nine symbols linked to the digits 1–9. Rules inside the 90 seconds never change; the symbol key changes each session. Every trial is recorded with timing; missed, late, duplicate and interrupted answers are never counted as wrong. A message from Earth opens after every completed round, whatever the score. The result is shown **beside** the self-rating, never combined into one number.
- **Personal reference.** Each result is compared with the astronaut's own valid past sessions (a demonstration rule: at least 5 valid sessions in the last 14 days, excluding the first two). The reference is versioned and frozen while a follow-up on that indicator is open, so a decline is never absorbed into "normal". The screen states the period, the data used, the method and its limits.
- **Rules with sources.** Rules turn observations into one step at a time, in a fixed order: help requests first, then due follow-ups, then changes needing review, then missing information. Every step shows its reason, its source and who owns the decision. Two observations that happen together are shown as two observations, never as a cause.
- **Follow-ups.** Every action keeps its status (proposed, accepted, in progress, completed, deferred, declined, unable, awaiting impact review). An action carried out with no later reading stays open; it never closes as "recovered".
- **Rest window.** When a rest-related step applies, Vitalents compares schedule alternatives within the mission's fixed tasks, preparation time and the planner's approval. In the demo, moving a meeting gives a rest opportunity of 7 hours instead of 6. When no valid alternative exists, it says so.
- **Onboard AI that cites and refuses.** A local language model searches a curated NASA library first and answers only from the retrieved excerpts, with citations. It keeps "your data" (built from the record by code, not by the model) separate from "scientific information". It refuses medication and dose questions, refuses when retrieval is weak, blocks answers with uncited claims or numbers not present in the inputs, and treats retrieved text as data, never as instructions. Unanswered questions go to a review list.
- **Sharing with delay.** Summaries for the medical team are previewed and confirmed by the astronaut before sending, then move through saved → queued → sent → delivered → reviewed, each shown only with its proof. The app keeps working while messages wait.
- **Roles and privacy.** Astronaut, medical team and mission planner see different things, enforced in the data layer. Private notes never leave the astronaut. The planner sees only operational requests, never health data or Decode results. No "ready / not ready" verdict exists for any role.

### Benefits

- Earth-independent follow-up: the full loop works offline on one laptop.
- Honest data: quality, missing readings and limits are visible instead of hidden.
- Personal comparison instead of population thresholds.
- Less burden: the daily check takes about 3 minutes.
- Every number and step can be traced to its data, rule and source.

### Tools

React, Vite, TypeScript, React Router, Zustand, Dexie (IndexedDB), Recharts · Python (data-status and reference logic, simulator) · FastAPI, LangChain, Ollama with gpt-oss:20b or Qwen 27B and nomic-embed-text · JSON Schema data contract shared by Python and TypeScript, checked with shared test vectors · Cloudflare Pages · GitHub.

### Limits (stated honestly)

All data in the demo is simulated and labelled. Vitalents is advisory and not a medical device: it does not diagnose, prescribe, give doses or decide readiness. Thresholds and reference rules are demonstration values, not approved medical limits. Decode is inspired by the DSST; our version needs independent validation. Any health effect is a hypothesis that needs an independent study.

## Use of AI tools

**AI inside the product.** Vitalents contains a local language model used only to explain and summarise. It never sets a status, chooses an action, diagnoses, or gives a medication or dose. The model runs locally with Ollama ([gpt-oss:20b or Qwen 27B — the one chosen by the evaluation]), with nomic-embed-text for search; the product calls no cloud model. Answers come only from a curated library of NASA and research documents, and every sentence cites an excerpt. When the evidence is insufficient, the assistant abstains and logs the question for review. Code checks reject citations that were not retrieved and any number not present in the inputs; retrieved text is treated as data, never as instructions. Evaluation on [15] questions: [x/15 from science/out/assistant_eval.json] (correct source or correct abstention). The public website shows answers recorded from the onboard model, labelled as such.

**AI used to build the project.** Claude Code agents wrote parts of the software under the team's specification and review; every change was reviewed and tested by a team member. AI tools assisted research, source checking and drafting; all sources were checked by the team. [If any AI-generated images or video are used, they carry a visible watermark — Amr to confirm.] All data in the app is simulated and labelled.

## NASA data and resources

- NASA Human Research Program: 5 Hazards of Human Spaceflight — the frame for the body map. **[Amr: confirm which item(s) come from the official challenge Resources tab and cite them exactly.]**
- NASA Human Research Program: Risks of Human Spaceflight — each domain links to a hazard and a risk.
- NASA: Risk from Inadequate Sleep and Irregular Schedules — sleep domain and rest-window steps.
- NASA: Risk of Behavioral Changes and Psychiatric Disorders — cognition and subjective state domain.
- NASA: Standard Measures — which measurements are realistic in flight.
- NASA: Medical Operations — how the medical team works with the crew; sharing and review design.

These NASA documents form the onboard library the assistant answers from. They are evidence and context, not astronaut measurement data.

## Space agency partner and other data

- ESA: Radiation and magnetic fields — radiation domain limits text.
- LifeSnaps v4 (real Earth-based study participants, not astronauts): Zenodo record 7229547, licence CC BY 4.0, with the Scientific Data paper describing the dataset. Used for descriptive checks of the personal-reference method on sleep and heart rate. [Amr/Shaimaa: state whether LifeSnaps is used in the submitted build or only in the offline analysis.]
- University of Pennsylvania: Cognition test battery — background for Decode (DSST).

## References

1. NASA Human Research Program. 5 Hazards of Human Spaceflight. [URL]
2. NASA Human Research Program. Risks of Human Spaceflight. [URL]
3. NASA. Risk from Inadequate Sleep and Irregular Schedules. [URL]
4. NASA. Risk of Behavioral Changes and Psychiatric Disorders. [URL]
5. NASA. Standard Measures. [URL]
6. NASA. Medical Operations. [URL]
7. ESA. Radiation and magnetic fields. [URL]
8. University of Pennsylvania. Cognition test battery. [URL]
9. Basner et al. 2020. Practice effects in the Cognition battery. [URL]
10. LifeSnaps v4. Zenodo record 7229547 (CC BY 4.0). https://zenodo.org/records/7229547
11. LifeSnaps dataset paper. Scientific Data, 2022. https://www.nature.com/articles/s41597-022-01764-x

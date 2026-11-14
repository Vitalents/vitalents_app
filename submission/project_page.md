> **DRAFT · owner: Amr Abd ElHaleem.** Edit freely. Every `[bracket]` is a placeholder to replace before submitting. Numbers come only from `science/out/` or the repo; sources come only from `content/library.json`. A source marked `[SOURCE: pending review]` has no reviewed URL in `content/library.json` yet (its `content_version` is `0.1-draft`).

# Vitalents · NASA Space Apps 2026 project page

## Project name

Vitalents

## Challenge

Create Health Monitoring Software for Astronauts on Space Missions

## High-level summary

Vitalents is health follow-up that an astronaut understands and acts on. On missions far from Earth, messages to the ground take minutes each way, so the crew has to make sense of more of their own data. Vitalents brings physical indicators, a 90-second cognitive task called Decode and the astronaut's self-assessment together on a body map and a personal record. It follows one loop: collect, review, understand, act, follow, and review the plan. For each change it shows the data, its quality and its limits, proposes one step with its source and its decision owner, and keeps the follow-up open until a later reading exists. Each astronaut is compared with their own past readings, not with a population value. Data quality, follow-up and delivery are three separate labels, never merged into one colour. The self-rating and the Decode result are shown side by side, never combined. A local assistant answers from a NASA library with citations and refuses medication and dose questions. Summaries for the medical team are previewed by the astronaut and wait honestly through the communication delay. The whole loop runs offline on one laptop. All data in the demo is simulated. Vitalents supports human decisions: it is advisory and not a medical device.

*(About 200 words.)*

## Links

- **Final project (live app):** https://vitalents.life (fallback: https://vitalents.pages.dev). Opens with no login. Demo mode, simulated data.
- **Code repository:** https://github.com/Vitalents/vitalents_app
- **Demo (7 slides or fewer, or a video of 30 seconds or less):** [LINK: 30-second video from `deck/video_script.md` or the 7-slide deck from `deck/outline.md`. Youssef/Amr add before submitting.]

The public site shows answers recorded from the onboard model, labelled "Recorded from the onboard model". The live assistant runs only on the demo laptop.

## How Vitalents addresses the challenge

| Challenge need | What Vitalents does | Where in the app |
|---|---|---|
| Monitor astronaut health indicators | Seven domains on a body map: heart and circulation, sleep and daily rhythm, cognition and subjective state, symptoms and temperature (live in the demo), nutrition and hydration, movement and exercise, radiation exposure (sample cards) | Today & map |
| Visual self-assessment | Daily check (sleep, alertness, mood) and the Decode task, shown side by side | Check & Decode |
| Trends over time | Each indicator against the astronaut's own personal reference, with gaps shown as gaps | Record & trends |
| Guidance with sources | One next step at a time with its reason, source and decision owner; "Why?" on every finding | Today's review, Plan & follow-ups |
| When to involve the medical team | Rules in a fixed order (help requests first); a reported symptom opens a review at once, even with a good Decode result | Request help, Today's review |
| Work far from Earth | Local-first storage, full loop offline, delivery states that wait through delay | Review & sharing |
| Engagement | A message from Earth after every completed round and a completion streak; the reward never depends on the score | Check & Decode |

## How it works

- **Body map and domain cards.** Each domain card has three tabs: **Now** (latest value, source, data status, comparison with the personal reference), **Understand** (why it matters in space, limits, NASA sources) and **Act** (how to measure, the next step, when to involve the medical team).
- **Three separate states.** Data status (valid, limited quality, out of date, not comparable, incomplete, no reading), follow-up status (no open follow-up, watching, action open, review requested, under specialist review, closed) and delivery status (saved on device, waiting to send, sent, delivered, reviewed) are never merged. "No reading" never means "fine", and no screen shows a health verdict.
- **Decode.** A 90-second task inspired by the Digit Symbol Substitution Test (DSST): nine symbols linked to the digits 1–9. The rules inside the 90 seconds never change; the symbol key changes each session. Every response is recorded with its timing. Missed, late, duplicate and interrupted answers are stored separately and never counted as wrong. A 30-second demo length exists for presentations; it is labelled "Demo length, not a measurement" and never enters the reference. Our version needs independent validation.
- **Personal reference.** Each result is compared with the astronaut's own valid past sessions in a stated window, with a stated method. The reference is versioned and frozen while a follow-up on that indicator is open, so a decline is never absorbed into the reference. Session counts are demonstration parameters, not medical rules.
- **Rules with sources.** Rules turn observations into one step at a time, in a fixed order: help requests and urgent review first, then due follow-ups, then changes needing review, then missing information. Two observations that happen together are shown as two observations, never as a cause.
- **Follow-ups.** Every step keeps its status (proposed, accepted, in progress, done, deferred, declined, could not do, waiting for a later reading). A step carried out with no later reading stays open; it never closes on its own.
- **Rest window.** When a rest-related step applies, Vitalents compares schedule options within fixed tasks, preparation time and the planner's approval, and shows the rest opportunity now and with the change. When no option fits, it says "No valid alternative within the current constraints."
- **Onboard assistant (Ask NASA).** A local model searches a curated library first and answers only from retrieved excerpts, citing every sentence. "Your data" is built from the record by code, not by the model. It refuses medication and dose questions, abstains when retrieval is weak, blocks uncited claims and numbers not in its inputs, and treats retrieved text as data, never as instructions. Unanswered questions go to a review list. The core app never depends on it.
- **Sharing with delay.** The astronaut previews and confirms every summary. It then moves through saved, waiting to send, sent, delivered and reviewed, each with its time. "Reviewed" appears only from a review by the medical team. A resend never creates a duplicate.
- **Roles and privacy.** Astronaut, medical team and mission planner see different things, enforced in the data layer. Private notes never leave the astronaut. The planner sees only operational requests.
- **Scenarios.** Five simulated scenarios: S1 performance change (Fahim), S2 missing measurement, S3 no schedule alternative, S4 a symptom needing review with a good Decode result, S5 communication delay.

## Benefits

- **Earth-independent:** the full loop works offline on one laptop.
- **Honest data:** quality, missing readings and limits are visible instead of hidden.
- **Personal:** each astronaut is compared with themselves, not a fixed population value.
- **Light:** the daily check is designed to take about three minutes.
- **Traceable:** every number and step links to its data, rule and source.
- **Safe by design:** no diagnosis, no medication or dose, no readiness verdict, no causal claims.

## Tools, coding languages, hardware and software

- **Languages:** TypeScript, Python 3.11, JSON Schema.
- **App:** React 18, Vite, React Router, Zustand, Dexie (IndexedDB), Recharts, Vitest.
- **Science logic:** Python with NumPy, pandas, SciPy, scikit-learn, pytest. The Python code is the source of truth; the app's TypeScript engine must reproduce its shared test vectors (`contracts/vectors/`).
- **Assistant:** FastAPI, LangChain, Ollama with [MODEL: gpt-oss:20b or Qwen 27B, the one chosen by `science/out/assistant_eval.json`] and nomic-embed-text for search.
- **Data contract:** JSON Schemas in `contracts/`, checked by `scripts/validate_data.py`.
- **Hosting:** Cloudflare Pages (static app, recorded-answer mode), GitHub.
- **Hardware:** one demo laptop with 32 GB unified memory (docs/SRS.md section 2.2) running the app and the local model. No cloud model, no special sensors.

## Limits (stated honestly)

All data in the demo is simulated and labelled. Vitalents is advisory and not a medical device: it does not diagnose, prescribe, give doses or decide readiness. Thresholds and reference rules are demonstration values, not approved medical limits. Decode is inspired by the DSST; our version needs independent validation. Any health effect is a hypothesis that needs an independent study.

## Use of AI

**AI inside the product.** Vitalents contains a local language model used only to explain and summarise. It never diagnoses, sets a status, chooses an action, or names a medication or dose. It runs locally with Ollama ([MODEL: from `science/out/assistant_eval.json`]) with nomic-embed-text for search; the product calls no cloud model. Answers come only from a curated library of NASA and research documents, and every sentence cites an excerpt. When the evidence is not enough, the assistant abstains and logs the question for review. Code checks reject citations that were not retrieved and any number not present in the inputs. Retrieved text is treated as data, never as instructions. Evaluation: [NUMBER: `science/out/assistant_eval.json` → correct source or correct abstention / total questions]; injected instruction ignored in [NUMBER: `science/out/assistant_eval.json` → injection blocked / injection tests]. The public website shows answers recorded from the onboard model, labelled as such.

**AI used to build the project.** Claude Code agents wrote parts of the software and these pitch drafts under the team's specification; every change was reviewed and tested by a team member. AI tools assisted research, source checking and drafting; the team checked every source. [CONFIRM (Amr): whether any AI-generated image or video is used; if so, it carries a visible watermark.] All data in the app is simulated and labelled.

## NASA data and resources

These are the NASA items in the onboard library (`content/library.json`). They give evidence and context for each domain card and for the assistant; they are not astronaut measurement data. **[Amr: confirm which item matches the official challenge Resources tab and cite it exactly.]**

| Resource | Publisher | How Vitalents uses it | Link |
|---|---|---|---|
| 5 Hazards of Human Spaceflight | NASA Human Research Program | Frame for the body map: each domain links to a hazard | [SOURCE: pending review] |
| Risks of Human Spaceflight | NASA Human Research Program | Each domain links to a named risk | [SOURCE: pending review] |
| Risk from Inadequate Sleep and Irregular Schedules | NASA Human Research Program | Sleep domain and the rest-window step | [SOURCE: pending review] |
| Risk of Behavioral Changes and Psychiatric Disorders | NASA Human Research Program | Cognition and subjective state domain | [SOURCE: pending review] |
| Standard Measures | NASA | Which measurements are realistic in flight | [SOURCE: pending review] |
| Medical Operations | NASA | How the medical team works with the crew; sharing and review design | [SOURCE: pending review] |

## Space agency partner and other data

| Resource | Publisher | How Vitalents uses it | Link |
|---|---|---|---|
| Radiation and magnetic fields | ESA | Radiation domain limits text | [SOURCE: pending review] |
| Cognition test battery | University of Pennsylvania | Background for Decode (DSST) | [SOURCE: pending review] |
| LifeSnaps v4 (Earth-based study participants, not astronauts), CC BY 4.0 | Zenodo record 7229547 | Offline descriptive check of the personal-reference method on sleep and heart rate | https://zenodo.org/records/7229547 |

[CONFIRM (Shaimaa): whether LifeSnaps results appear in the submitted build or only in the offline analysis, and add the numbers from `science/out/validation.json` if they exist.]

## References

1. NASA Human Research Program. 5 Hazards of Human Spaceflight. [SOURCE: pending review]
2. NASA Human Research Program. Risks of Human Spaceflight. [SOURCE: pending review]
3. NASA Human Research Program. Risk from Inadequate Sleep and Irregular Schedules. [SOURCE: pending review]
4. NASA Human Research Program. Risk of Behavioral Changes and Psychiatric Disorders. [SOURCE: pending review]
5. NASA. Standard Measures. [SOURCE: pending review]
6. NASA. Medical Operations. [SOURCE: pending review]
7. ESA. Radiation and magnetic fields. [SOURCE: pending review]
8. University of Pennsylvania. Cognition test battery. [SOURCE: pending review]
9. Basner et al. 2020. Practice effects in the Cognition battery. [SOURCE: pending review]
10. LifeSnaps v4. Zenodo record 7229547 (CC BY 4.0). https://zenodo.org/records/7229547
11. LifeSnaps dataset paper. Scientific Data, 2022. https://www.nature.com/articles/s41597-022-01764-x

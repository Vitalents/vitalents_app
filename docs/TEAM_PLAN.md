# Vitalents · Team plan (v1.4)

Team: Ahmed Ehab · Amr Abd ElHaleem · Shaimaa Muhammed · Youssef Elbaz.

## 1. How to use this plan

This is the **prioritized plan for each team member**. It works with two other files only: the *SRS and build plan* (cited as **SRS n**) and the *Product scope* (cited as **Scope**). Each task names the section to read first, the file it produces, and the test that proves it is done.

| Priority | Increments | Meaning |
|---|---|---|
| **P0** | 0 – 2 | Without it there is no demo. Finish before anything else. |
| **P1** | 3 – 5 | The full loop: act, understand, share. |
| **P2** | 6 | Proof: scenarios, validation numbers, submission. |
| **P3** | 7 | Polish and research paths. Only when everything above works. |

**Three rules for everyone:**

1. **Work top to bottom.** Never start a P1 task while one of your P0 tasks is open, unless you are blocked and have said so in the group.
2. **Hand off files, not screens.** Every output is a file in the agreed format (SRS section 4). Ahmed builds the screens that read them.
3. **Ship every increment.** Merge, deploy, record 20 seconds of video. That video is the fallback demo.

<div class="card tint" markdown="1">
**Where documents disagree:** this plan wins on *what we build today and in what order*; section 9 of this plan and SRS section 19 hold the latest product decisions and override older text in the SRS.
</div>

## 2. The demo story we build toward

Everything below serves one end-to-end story plus one counter-case.

<div class="card dark" markdown="1">
<div class="label">Hero scenario: “Fahim” (hypothetical)</div>

Fahim is on a training task. He has a documented Decode reference on one device. He logged less sleep than usual. His wrist sensor had weak contact, and he still has an open pain follow-up from earlier.
</div>

| Stage | What the system does | Built by |
|---|---|---|
| **Measure** | Saves the Decode result with its events and context. Marks the wrist (PPG) source as limited; **never fills in a substitute pulse value.** | Ahmed (Decode, app), Shaimaa (data-status logic) |
| **Review** | Shows correct answers below the median of comparable sessions, with accuracy and time; shows reported sleep **separately**, not as the cause. | Shaimaa (reference logic), Ahmed (review screen) |
| **Understand** | Fahim opens the comparison and quality details and asks what the result means; the assistant explains the task’s limits from a known source. | Ahmed (assistant), Amr (library) |
| **Act** | A movable meeting exists, so a rest-opportunity comparison appears with constraints and the approver. | Shaimaa (schedule calculation), Ahmed (screen) |
| **Follow** | Records whether the step was accepted or declined, and why. The pain follow-up stays visible even if tomorrow’s session improves. | Ahmed |
| **Share** | Sends a summary with the observation, actions, context and question. With no connection, it stays **saved, awaiting send.** | Ahmed |
| **Next day** | If correct answers rise, the system records the change with sleep, schedule and conditions; it **never says the meeting move fixed it.** No new data → the result stays “not available” and the follow-up stays open. | Youssef (scenario), Shaimaa (rules) |

**Counter-case for the pitch (one of these):** no reference yet · connection lost · no valid schedule alternative · a symptom needing the urgent path despite a good Decode result.

## 3. Team overview

**Youssef is mostly unavailable today**, so his build work moves to agents run by Shaimaa and Amr. He keeps what he does best and can do asynchronously: the pitch story, the deck outline and the rehearsal.

| Member | Owns | P0 deliverable by H5 | Critical handoff |
|---|---|---|---|
| **Ahmed Ehab** · AI engineering, frontend, backend | App, **Decode (the mini-game)**, data schemas, app engine (ported from Shaimaa’s Python), assistant service, sync, permissions, integration | Map, cards and review on the fixture; Decode working end to end | Needs Amr’s components and Shaimaa’s logic and test vectors; gives everyone the running app |
| **Amr Abd ElHaleem** · organization, research, UI/UX, management | Scope, design system, domain content, rules wording, library, assistant test set and counts, submission text | Components, sleep and cognition cards, first rules | Gives Ahmed components and content; gives Ahmed and Shaimaa rule text |
| **Shaimaa Muhammed** · classical models, datasets, research | **Fahim fixture**, data dictionary, data-status, reference, rules and schedule logic in Python with test vectors, **simulator and four scenarios**, validation summary | Fixture at H0:45; data dictionary; data status and reference in Python; test vectors | Gives Ahmed the fixture, the logic and its test vectors |
| **Youssef Elbaz** · statistics, ML, presentation (part-time today) | Pitch story, deck outline, rehearsal, presenting | Nothing on the critical path | Needs screenshots and the validation summary by H11 |

## 4. Ahmed Ehab · AI engineering, frontend, backend

Ahmed is the bottleneck. He runs up to four Claude agents in parallel (shell and store; Decode; app engine port; assistant) and reviews every merge. If he falls behind at H5, Amr cuts in this order: trend chart → consult-note wording by the model → round-result polish.

| # | P | Inc | Task | Read first | Output | Done when | h |
|---|---|---|---|---|---|---|---|
| A-01 | P0 | 0 | Repo, Vite + React + TypeScript, Dexie store with schema versions, simulated-data banner; **Cloudflare Pages** connected to GitHub with `_redirects` and `_headers` (SRS 3.5) | SRS 3, SRS 4 | `app/`, `vitalents.pages.dev` | App opens on the public link with the banner; each branch gets a preview URL | 1 |
| A-01b | P0 | 0 | JSON schemas from Shaimaa’s data dictionary, including provenance fields and schema versions | SRS 4 | `contracts/*.schema.json` | Fixture validates | 0.5 |
| A-02 | P0 | 0–1 | Shell: six entries, **Report something** and **Request help** reachable from every screen | SRS 15, SRS 4.3 | `app/src/shell` | Help works from any screen, including mid-Decode | 1 |
| A-03 | P0 | 1 | Today & map and the domain card (Now / Understand / Act) on the fixture, showing **three separate states**: data, follow-up, connection | SRS 15, SRS 4.3, SRS 13 | `features/map` | “No reading” never shows as healthy; a region is never shown fine because of one indicator | 2.5 |
| A-04 | P0 | 1 | Today’s review: recorded, changed, missing, next step, other open follow-ups, “Why?” panel | SRS 5.6, SRS 6 | `features/review` | Every finding opens its data and rule | 1.5 |
| A-05 | P0 | 2 | **Decode by protocol**: practice not logged; key and sequence loaded before start; monotonic timer; one symbol and one response per trial; fixed difficulty; window closes at 90 s; late responses not counted; incomplete trial saved separately (not as wrong); interruption question after; no erasing or picking the best session | SRS 7 | `features/decode` | Session JSON matches the schema; replayed events give the same metrics (test with Youssef) | 4 |
| A-05b | P0 | 2 | App engine (agent): port data status, reference and change from Shaimaa’s Python into `app/src/engine` | SRS 8.1, SRS 8 | `app/src/engine` | Matches Shaimaa’s test vectors to 3 decimals | 1.5 |
| A-06 | P1 | 3 | Live rules wiring, action lifecycle (proposed → accepted → in progress / done → deferred / declined / unable → awaiting impact review), follow-ups | SRS 6, SRS 5.7 | `features/followups` | An accepted then executed action without a later reading does **not** close as recovered | 2.5 |
| A-06b | P1 | 3 | Port the rules evaluator and schedule calculation from Shaimaa’s Python (agent) | SRS 6, SRS 10 | `engine/rules.ts`, `engine/schedule.ts` | Matches her test vectors | 1 |
| A-07 | P1 | 3 | Rest-window screen using the schedule engine: before / after, constraints, approver, “no valid alternative” | SRS 10 | `features/schedule` | Fahim’s meeting move shows; a blocked case says no alternative | 1 |
| A-08 | P1 | 4 | **Ask NASA** service: constrained retrieval; answer split into *your data* and *scientific information*; excerpt, source and limits; abstain → knowledge gap; trace log (question, chunks, versions, model, answer, rating); **retrieved text treated as data, never instructions** | SRS 11 | `ai/`, `features/ask` | Out-of-library question abstains; an injected instruction in a document is ignored | 2.5 |
| A-09 | P1 | 5 | Outbox and connection states (draft → saved → awaiting send → sent → acknowledged → reviewed), idempotent resend, specialist summary and share preview | SRS 5.7, SRS 12 | `sync/`, `features/sharing` | Sending three times creates one record; “reviewed” appears only after a review event | 2 |
| A-10 | P1 | 5 | Roles (astronaut, crew medical officer, ground medical team, planner) with permissions **enforced in the data layer**, not by hiding buttons | SRS 9 | `store/permissions.ts` + tests | Planner or assistant trying to read a private note or another person’s record is refused and logged | 1.5 |
| A-11 | P2 | 6 | Automate the Plan 10 acceptance tests that touch the app (section 10 of this plan) | Plan 10 | `app/tests/acceptance` | Tests run in one command | 1.5 |
| A-12 | P2 | 6 | Cached assistant mode for the public link; custom domain **vitalents.life** live on Cloudflare | SRS 11 | `cached_answers.json` | vitalents.life works with no local service | 1 |
| A-13 | P3 | 7 | Trend chart with gaps and baseline band; “Your reference” screen polish; preferences; 30-second demo mode | SRS 8, SRS 5.10, SRS 13 | — | Gaps visible, never a continuous line across them | 2 |
| A-14 | P3 | 7 | Optional camera pulse (rPPG), clearly labelled experimental, local processing only | Scope M10 | — | Only if all of the above is done | — |

## 5. Amr Abd ElHaleem · organization, research, UI/UX, management

Amr owns the clock and every cut decision, and checks every screen against the language rules (SRS 13).

| # | P | Inc | Task | Read first | Output | Done when | h |
|---|---|---|---|---|---|---|---|
| M-01 | P0 | 0 | Lock the product name and scope; freeze data formats with the team; set the checkpoints; **register vitalents.life** (or confirm the fallback `vitalents.pages.dev`) | Plan 2, Scope 6 | Decision log in the repo | Everyone has a task card; domain decision made | 0.5 |
| M-02 | P0 | 0–1 | Design tokens and core components: **three state chips** (data, follow-up, connection), body region, card with three tabs, action card, banner | SRS 13 | `app/src/ui` | Color never carries meaning alone; contrast checked | 3 |
| M-03 | P0 | 1 | Domain content, in order: sleep and cognition (Inc 1) → heart and symptoms (Inc 3) → nutrition, movement, radiation (Inc 5). Use each domain’s limits text from the Scope (e.g. “pulse alone doesn’t describe heart health”) | SRS 4.3 | `content/domains.json` | Every card has a source and its limits text | 3 |
| M-04 | P0 | 1–3 | Rules table with the four rule types (quality and source; change description; approved plan; approved medical condition), the attention order, owner and follow-up date; messages that state observations, never causes | SRS 6 | `content/rules.json` | No message states a cause, a percentage or a readiness verdict | 2 |
| M-05 | P1 | 4 | Library: 15–25 items, each with title, publisher, link, date, license, scope and approval status | SRS 11, SRS 1.5 | `content/library.json` + files | All items load into the assistant | 2 |
| M-06 | P1 | 4 | Assistant test set: answerable, partial evidence, conflicting or outdated, out of scope, and one document containing a malicious instruction | Plan 10, SRS 14.3 | `content/eval.json` | 15+ questions with expected source or expected abstention | 1 |
| M-06b | P1 | 5 | Run the assistant test set (agent) and record counts: correct source, correct abstention, injection ignored, per model | SRS 14.3 | `science/out/assistant_eval.json` | Counts behind every rate; handed to Shaimaa for the validation summary | 0.5 |
| M-07 | P1 | 5 | Designs for the share preview, Medical view and Planner view; forbidden-wording list for `check_language.py` | SRS 5.7, SRS 9, SRS 13 | `content/language.json` | Planner view contains no health data | 1.5 |
| M-08 | P1 | 5 | Five-minute usability check with 3 people: can they tell what was measured vs estimated, why a follow-up exists, whether a summary arrived, where the source is? | SRS 13 | Notes in the repo | Findings fixed or logged | 0.5 |
| M-09 | P2 | 6 | Project page text in English, AI-use disclosure (including the in-product model), NASA resources used, references | Plan 2, SRS 1.5 | `submission/` | Every claim on the page has a source | 1.5 |
| M-10 | P2 | 6 | Screenshots and a 2-minute backup demo video | Plan 2 | `deck/assets` | Video plays offline | 1 |
| M-11 | P2 | 6–7 | Slide design from Youssef’s outline; screenshots | Plan 2 | `deck/` | Matches the brand | 1.5 |
| M-12 | P3 | 7 | Prepare Arabic strings and RTL layout for after the hackathon | SRS 13 | — | — | 2 |

## 6. Shaimaa Muhammed · classical models, datasets, research

Shaimaa’s Python is the source of truth for every calculation. She delivers each piece as Python code plus hand-checked test vectors; Ahmed’s agent ports it into the app and must reproduce those vectors exactly. With Youssef part-time she also takes the fixture and the simulator, each driven by its own Claude agent, and QoL_Stress moves to P3.

| # | P | Inc | Task | Read first | Output | Done when | h |
|---|---|---|---|---|---|---|---|
| S-00 | P0 | 0 | **Fahim fixture** (agent): his reference sessions, the low-sleep day, the weak wrist signal, the open pain follow-up, the movable meeting | Plan 2 | `app/public/data/fixtures/` | Validates against the schemas; screens can start | 0.5 |
| S-01 | P0 | 0 | **Data dictionary**: every field, unit, allowed value and state for reading, raw segment, session, reference and observation, with provenance fields (source, unit, measured / received / recorded times, quality, tool version, correction) | SRS 4 | `docs/data_dictionary.md` | Ahmed turns it into schemas with no open questions | 1 |
| S-02 | P0 | 1 | **Data-status pipeline**: identify source → capture time → keep original → quality check → output. States: valid / limited · invalid / missing · **stale** (exists but past the plan’s freshness window). Missing is never turned into zero | SRS 8.1 | `science/status.py` | “Absence vs zero” test passes (section 10) | 2 |
| S-03 | P0 | 1–2 | **Reference engine** with four states (not built yet · initial / limited · valid for this question · needs re-review), `baseline_version`, absolute change, and relative change only where the indicator allows it. Session counts are configurable demo parameters, never fixed claims | SRS 8 | `science/reference.py` | No version rewrites an earlier result; a decline never silently moves the reference | 2.5 |
| S-04 | P0 | 2 | **Test vectors**: hand-checked input / output examples for data status, reference and change, including edge cases (missing, stale, device change, decline during a follow-up) | SRS 8, Plan 10 | `contracts/vectors/` | Python passes them; Ahmed’s port is checked against them | 1.5 |
| S-05 | P1 | 3 | Rules logic in Python for Amr’s rule format with the attention order, plus test vectors | SRS 6 | `science/rules.py` + vectors | A help request ranks first; a good Decode result never hides a symptom | 1.5 |
| S-06 | P1 | 3 | **Schedule calculation**: half-open intervals; blocked = tasks + preparation + transit; free = rest window − union(blocked); total and longest opportunity; midnight crossing; unknown window → “not computable”, never zero; alternatives ranked by keeping tasks, then longer rest, then fewer changes | SRS 10 | `science/schedule.py` + vectors | Matches a hand calculation for Fahim and for a midnight-crossing case | 1.5 |
| S-07 | P1 | 3–4 | **Simulator and four scenarios** (agent): parameters with source and status; seeded; every record flagged simulated; bundles SC-1, SC-3, SC-5, SC-6 (section 10) | Plan 10 | `science/sim.py`, `scenarios/` | Each scenario loads and shows its expected outcome | 2 |
| S-08 | P1 | 4 | Decode computability test (agent): replay fixed event sequences and recompute the metrics independently | SRS 7, Plan 10 | `science/test_decode.py` | App metrics equal the independent calculation; slow responses kept | 0.5 |
| S-09 | P1 | 4 | Reference change log and the data behind the “Your reference” screen | SRS 8, SRS 5.10 | `references.json` | Shows period, sessions, version, exclusions and why | 1 |
| S-10 | P2 | 6 | **Validation summary**: integrity and acceptance-test results, Decode check, assistant counts from Amr; what was not tested | SRS 14.3 | `science/out/validation.json` | Every number on the evidence slide comes from this file | 1 |
| S-11 | P2 | 6 | Data-sources note: Standard Measures, OSDR, LSDA / NLSP, what is and isn’t available for Decode | SRS 14.1 | `docs/data_sources.md` | Every source has title, link and access status | 0.5 |
| S-12 | P3 | 7 | QoL_Stress analysis per Scope M10 with participants held out; remaining scenarios SC-2, SC-4, SC-7; one descriptive pattern | SRS 5.10, Scope M10, Plan 10 | — | Only after P2 | 3 |

## 7. Youssef Elbaz · statistics, ML, presentation (part-time today)

Nothing Youssef owns blocks anyone else. He can work in short blocks, from anywhere, and late in the day.

| # | P | When | Task | Read first | Output | Done when | h |
|---|---|---|---|---|---|---|---|
| Y-01 | P2 | Any time | Pitch story: Fahim plus one counter-case; the three moments judges should remember | Plan 2 | `deck/story.md` | Fits the local time limit | 1 |
| Y-02 | P2 | After H9 | Deck outline (7 slides or fewer) using screenshots from Amr | Plan 2 | `deck/outline.md` | Every slide has one message and one visual | 1 |
| Y-03 | P2 | After H11 | Check the evidence slide against `validation.json`: no number without its count, no claim beyond what was tested | Scope M10, SRS 14.3 | Comments on the deck | Every rate shows its denominator | 0.5 |
| Y-04 | P2 | Pitch morning | Rehearse three times with Ahmed driving the demo; present | Plan 2 | — | Under the time limit three times in a row | 1 |
| Y-05 | P3 | Only if free | Review Shaimaa’s validation summary statistically; research prototype on simulated data | SRS 5.10, Scope M10 | — | — | — |

## 8. Handoffs and dependencies

| When | From | To | What | If late |
|---|---|---|---|---|
| H0:30 | Shaimaa | Ahmed | Data dictionary (S-01) → schemas (A-01b) | Ahmed uses the SRS examples and reconciles later |
| H0:45 | Shaimaa (agent) | Ahmed | Fahim fixture (S-00) | Ahmed hand-codes one day of data |
| H2 | Amr | Ahmed | Components and sleep / cognition cards (M-02, M-03) | Ahmed uses plain components; restyle later |
| H3 | Amr | Shaimaa, Ahmed | First rules (M-04) | Shaimaa writes two placeholder rules marked `TODO(review)` |
| H4 | Shaimaa | Ahmed | Python logic and test vectors for status and reference (S-02 – S-04) → app engine (A-05b) | Review screen keeps reading precomputed findings |
| H6 | Shaimaa | Ahmed | Rules and schedule logic with vectors (S-05, S-06) → port (A-06b) | Fahim’s alternative is scripted from the fixture |
| H7 | Amr | Ahmed | Library and test set (M-05, M-06) | Ship with 8 core sources |
| H8 | Shaimaa (agent) | All | Four scenarios (S-07) | Demo runs on Fahim plus one counter-case |
| H11 | Shaimaa, Amr | Youssef | Validation summary, screenshots | The evidence slide shows only what was tested |

## 9. Latest decisions that override the SRS

These are the newest product decisions. Agents follow them where older SRS text says otherwise; SRS section 19 repeats them.

| # | Decision | See |
|---|---|---|
| 1 | **Three separate states**: data, follow-up and connection. Never merged into one color. | SRS 19 |
| 2 | Data status adds **stale**: a reading exists but is past the plan’s freshness window; never shown as current. | SRS 8.1 |
| 3 | **Reference states** are: not built yet · initial / limited · valid for this question · needs re-review. Session minimums and practice counts are configurable demo parameters, not fixed rules. | SRS 8 |
| 4 | Decode: **incomplete trials are stored separately**, not as wrong answers; accuracy = correct ÷ accepted responses; slow responses are never dropped; device delay is never corrected with a guessed number. | SRS 7 |
| 5 | Rules carry a version, scope, units, quality and reference conditions, allowed action, owner, follow-up date and insufficient-evidence cases; attention order is help / urgent → due follow-ups → changes needing review → missing information. | SRS 6 |
| 6 | Schedule: half-open intervals, preparation and transit included, midnight crossing, unknown window = not computable (never zero). | SRS 10 |
| 7 | Action states add **in progress**, **unable** and **awaiting impact review**. | SRS 5.7 |
| 8 | Connection states: draft → saved → awaiting send → sent → acknowledged → reviewed; “reviewed” only from a review event; idempotent resend. | SRS 12 |
| 9 | Roles: the crew medical officer is separate from the ground medical team; technical administration never grants medical access. Permissions are enforced in the data layer and tested. | SRS 9 |
| 10 | Library items add license, scope and approval status; assistant traces are kept; **retrieved text is data, not instructions**. | SRS 11 |
| 11 | Seven simulation scenarios replace five (section 10). | Plan 10 |
| 12 | Interface language: the long-term product targets Arabic with right-to-left layout; the competition requires English. **We build in English today**, with strings kept in one file so Arabic and RTL can follow. | SRS 13 |

## 10. Scenarios and acceptance tests with owners

### Seven scenarios · built by Shaimaa’s agent

**MVP builds four:** SC-1, SC-3 (Fahim), SC-5 and SC-6. SC-2, SC-4 and SC-7 are P3.

| ID | Scenario | Expected outcome |
|---|---|---|
| SC-1 | First use without sensors | Missing data is visible; reference shown as not built; no invented physical readings |
| SC-2 | Low-quality reading | Source problem shown; both attempts kept; the fault is never turned into a diagnosis |
| SC-3 | Lower performance with less recorded sleep (Fahim) | Two concurrent observations without a stated cause; an explained step and a follow-up |
| SC-4 | Conflict blocks the proposed rest | The conflicting alternative is rejected and the lack of a valid option is explained; the system never moves the task itself |
| SC-5 | Symptom needing the urgent path with a good Decode | The approved medical path is available at once; never waits for the game or a repeat |
| SC-6 | Connection lost, then restored | Waiting, sending, arrival and review are distinct; no duplicates |
| SC-7 | Several problems and a device change | Other follow-ups stay visible; the comparability change is shown before any trend |

### Twelve acceptance tests

| Test | Owner |
|---|---|
| Absence vs zero: cut a source and send a missing value; missing state and last-reading time shown, no zero pulse, no “fine” verdict | Shaimaa (test cases) · Ahmed (app) |
| Person and unit assignment: move a shared device to another person, then send an unknown unit; wrong assignment blocked, comparison paused until the unit is documented | Shaimaa (test cases) · Ahmed (app) |
| Decode computability: replay fixed events with correct, wrong and interrupted trials; metrics match an independent calculation; slow responses kept | Shaimaa |
| Suitable reference: session without a reference, then a device change; value and limits shown without borrowing another person’s reference | Shaimaa (test cases) · Ahmed (app) |
| Medical path independence: an approved condition with a good game result; review appears without waiting for another session | Ahmed |
| Checkable schedule: a window crossing midnight with preparation and a conflict; intervals match a hand calculation; conflicting alternative rejected with a reason | Shaimaa (test cases) · Ahmed (app) |
| Execution is not recovery: accept and execute an action with no later reading; states stay separate and nothing closes automatically | Ahmed |
| Real local operation: disable network and assistant; measurement saved, rules and fixed content work, summary waits to send | Ahmed |
| Duplicates and conflicts: send a message three times and edit a plan from two devices; one logical record and a conflict for a human decision | Ahmed |
| Access protection: planner or assistant tries to read a private note or another person’s record; refused and logged without leaking content | Ahmed |
| Grounded and abstaining explanation: in-library, out-of-library and malicious-document questions; correct claims, support, abstention, permissions kept | Amr |
| Simulation and version separation: export a scenario and update a rule or reference; simulated source stays visible; earlier result can be recomputed | Shaimaa |

## 11. Launching the agents and how long it takes

### Agents to run (eight, across three people)

| Agent | Run by | Work | Starts | Typical run |
|---|---|---|---|---|
| A · Shell and store | Ahmed | A-01, A-02, A-09, A-10 | H0:30 | 30–60 min per increment |
| B · Decode | Ahmed | A-05 (the mini-game) | H1 | 60–90 min, plus review |
| H · App engine port | Ahmed | A-05b, A-06b | H4 | 30–45 min per part; checked by vectors |
| C · Assistant | Ahmed | A-08, A-12 | H5 | 60–90 min |
| D · UI components | Amr | M-02, then screens from designs | H0:30 | 45 min per component set |
| E · Research and content | Amr | M-03, M-05, M-06, M-06b | H0:30 | Runs in the background |
| F · Science logic | Shaimaa | S-01 to S-06, S-09 (Python + test vectors) | H0:30 | 45–60 min per part |
| G · Data | Shaimaa | S-00, S-07, S-08 | H0:15 | 20 min fixture; 60 min simulator |

Each agent gets CLAUDE.md, the relevant SRS sections, this plan and its task card. Run each in its own branch or worktree; Cloudflare Pages gives every branch its own preview URL, so review happens on a live link before merging. **The limit is not the agents: it is human review.** Plan 10–15 minutes of review per agent result, and expect about one in three results to need a second pass.

### Time estimate (wall clock, from the moment we start)

| Phase | What happens | Time |
|---|---|---|
| **Setup** | Repo, docs in `docs/`, CLAUDE.md, data dictionary and schemas, eight task cards, branches | 45–60 min |
| **P0 · Inc 0–2** | Fixture, map, cards, review, Decode, engine core | 4–5 h |
| **Minimum winning demo (Inc 0–3)** | Plus rules, actions, follow-ups, rest window | **about 6–7 h in total** |
| **P1 · Inc 4–5** | Assistant, sharing, sync, roles, permissions | +3–4 h |
| **Full MVP (Inc 0–5), network-off gate** | | **about 10–11 h in total** |
| **P2 · Inc 6** | Scenarios, validation, cached mode, submission text, video | +1.5–2 h |
| **Everything to submit** | | **about 12–13 h in total** |

**If time is shorter than that:** stop at the minimum winning demo (about 7 h), record the video, and spend the last hour on the deck. Every increment ends in something you can show, so stopping early never leaves you with nothing.

## 12. Checkpoints and what we never cut

| When | Checkpoint |
|---|---|
| **H0 + 30 min** | Name, scope, schemas frozen; every member has their first task card |
| **H3** | Fahim’s day on the map and the review screen from the fixture |
| **H5** | Decode session flows into the review with a live finding |
| **H9** | The full loop works with the network and the assistant off. Nothing new starts until this passes. |
| **H11** | Four scenarios load; validation numbers exist |
| **H12** | Backup video recorded; vitalents.life live |

**Never cut:** three separate states · sources on every card and step · Request help reachable everywhere · share preview · the network-off run · labels for simulated data and “not a diagnosis”.

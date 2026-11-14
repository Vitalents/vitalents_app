> **DRAFT · owner: Youssef Elbaz** (design: Amr). Local live pitch, 12 slides. Every `[NUMBER: …]` and `[SOURCE: …]` is a placeholder: fill it from the file named, or delete the sentence. Never type a number by hand.
>
> **Two decks, two rules.** This deck is for the **local live pitch**. The global submission "Link to demo" must stay within **7 slides or a 30-second video** (see `submission/checklist.md` item 2): use `deck/outline.md` or the 30-second cut in `deck/video_script.md` for that.
>
> **Short slot?** If the local slot is about 5 minutes [TIME: from the Local Lead], use slides 1, 2, 4, 5 (3-minute demo), 9 and 12 only.

# Vitalents · pitch deck (local, live)

Screens named below are routes in the app (`app/src/main.tsx`). Take screenshots from scenario S1 unless a slide says otherwise. On-slide text is the headline plus the body line; the body stays at 25 words or fewer.

---

## Slide 1 · Title

**Headline:** Vitalents

**On slide:** Health follow-up the astronaut understands and acts on. NASA Space Apps 2026 · vitalents.life · simulated data, advisory only.

**Visual:** Vitalents lockup (`app/public/brand/lockup.svg`) on the teal cover colour. Crop of **Today & map** (`/`) on mission day 27, S1. Team names in small type. No NASA logos.

**Speaker notes (about 30 s):** Good morning. We are Vitalents, and we took the challenge "Create Health Monitoring Software for Astronauts on Space Missions". On a long mission, the astronaut is often the first person to notice a change in their own body or performance. Our question was simple: what would help that person understand the change and decide what to do next, without waiting for Earth? What you will see runs on one laptop, offline, on simulated data. It is advisory. It does not make medical decisions.

---

## Slide 2 · Problem

**Headline:** Far from Earth, the astronaut has to read their own data.

**On slide:** Mars-distance missions: minutes of message delay each way. Earth can't answer in real time. A number without context tells nobody what to do.

**Visual:** Simple line drawing: astronaut → data → "?" → long dashed line → Earth, labelled "one-way delay [NUMBER: Mars one-way light delay range — SOURCE: pending review, add to `content/library.json`]". No stock space imagery.

**Speaker notes (about 40 s):** Missions beyond the Moon change the support model. A message to Earth takes minutes to arrive, and the answer takes as long to come back [NUMBER: one-way delay range, with its source]. So the crew has to handle more on their own. At the same time, they collect many numbers: sleep, pulse, symptoms, test results. A number on its own does not say if it is usable, if it is a change for this person, or who should look at it. Medical monitoring already exists at NASA. Our hypothesis is that the astronaut's side of it can be clearer and easier to act on. That is a hypothesis, and it needs testing.

---

## Slide 3 · The astronaut

**Headline:** Meet Fahim. He feels fine.

**On slide:** Fictional crew member, mission day 27. Self-rating: 8 out of 10. Three short nights. Decode below his own range. An open pain follow-up.

**Visual:** **Today & map** (`/`), S1: the body figure with the cognition region "Watching", heart "Limited quality", symptoms "Under specialist review". Crew label "Fahim (fictional crew member)" visible in the header.

**Speaker notes (about 40 s):** This is Fahim. He is fictional, and every record behind him is simulated and labelled that way. On mission day 27 he rates himself 8 out of 10. His record also shows three nights under six hours, and two Decode results below his own personal range. He also has a back pain report from a week ago that the medical team is still looking at. Nothing here is an emergency. It is exactly the kind of day where a person can miss a pattern, or over-react to one number. Vitalents puts it all in one place and keeps each piece honest.

*Values from `app/public/data/fixtures/S1.json` (stand-in fixture). Re-check them on screen after the simulator replaces it.*

---

## Slide 4 · The loop

**Headline:** Collect → review → understand → act → follow → review the plan.

**On slide:** One loop, every day. Each step shows its reason, its source and who decides. About three minutes for the daily check.

**Visual:** The six nav entries as a ring: **Today & map** (`/`), **Check & Decode** (`/check`), **Today's review** (`/review`), **Record & trends** (`/record`), **Plan & follow-ups** (`/plan`), **Review & sharing** (`/share`). Small screenshot under each.

**Speaker notes (about 40 s):** The whole product is one loop. Collect: a short daily check and a 90-second task called Decode. Review: what was recorded, what changed from your own reference, what is missing. Understand: why it matters in space, its limits, and the NASA source. Act: one step at a time, with the reason and the decision owner. Follow: every step keeps its status, and it never closes just because it was done. Then review the plan with the medical team, through a delayed link. Every screen in the navigation is one stage of this loop.

---

## Slide 5 · Live demo

**Headline:** Live: Fahim, scenario S1.

**On slide:** Map → Decode (30-second demo length) → review → rest window → share with delay → medical view.

**Visual:** Switch to the app on the demo laptop. Keep the backup video open in a second tab.

**Speaker notes:** Run `deck/demo_script.md`: the 3-minute version in a short slot, the 5-minute version if time allows. Hand back to slide 6 when the medical view shows "Reviewed".

---

## Slide 6 · Trust 1: three separate states

**Headline:** Three separate states, never one colour.

**On slide:** Data: is the reading usable? Follow-up: does it need attention? Delivery: has it reached Earth? "No reading" never means nothing is wrong.

**Visual:** Close-up of one domain card (`/domain/heart`, S1): "Limited quality" data badge beside the follow-up chip, and the header sync label. Then the map legend ("How to read the map").

**Speaker notes (about 40 s):** Most dashboards squeeze everything into one green, amber or red light. We keep three things apart. Data status says whether a reading can be used: valid, limited quality, out of date, not comparable, incomplete, or no reading. Follow-up status says whether something needs attention. Delivery status says whether a message reached the ground. Fahim's pulse has limited quality because of weak sensor contact: that is a data problem, not a health statement. And when there is no reading, we say "No reading". We never show "fine", and the app has no health verdict anywhere.

---

## Slide 7 · Trust 2: sources and no medical claims

**Headline:** Every number has a "Why?". Every step has a source.

**On slide:** No diagnosis, medication, dose or readiness verdict. Two observations together are shown as two observations. The assistant cites NASA sources or says it doesn't know.

**Visual:** **Today's review** (`/review`) with the "Why?" panel open: supporting records, rule ID and version, limits. Beside it, **Ask** (`/ask`) showing a cited answer and the dose question refused. [SCREENSHOT: take from the demo laptop in live mode; the public site has no recorded answers yet, see `app/public/data/cached_answers.json`.]

**Speaker notes (about 45 s):** Open "Why?" on any finding and you see the records behind it, the rule and its version, and its limits. Fahim's finding says two things happen together: lower Decode results and short nights. It does not say one caused the other. Decode and his self-rating sit side by side and are never merged into one number. The onboard assistant only explains. It answers from a curated NASA library, cites every sentence, and refuses medication and dose questions. When the library does not cover a question, it says so and logs the question for review. The core app never needs the model.

---

## Slide 8 · Trust 3: offline and private

**Headline:** Works offline. Shares only what the astronaut confirms.

**On slide:** Everything is stored on the device first. Delivery waits honestly through delay. Private notes never leave. The planner sees schedule requests, never health data.

**Visual:** **Review & sharing** (`/share`): the "What will be sent" preview with "Not included: Your private notes". Beside it, **Mission planner view** (`/planner`) showing only the rest-window request.

**Speaker notes (about 40 s):** The app is local-first. Every record is saved on the device, and the whole loop runs with the network off. When Fahim shares a summary, he sees exactly what will be sent before anything leaves. Then it moves through saved, waiting to send, sent, delivered and reviewed, and each step shows its time. "Reviewed" only appears when the medical team actually marks it. Roles are enforced in the data layer, not by hiding buttons. The planner gets the schedule change request and nothing else: no health records, no Decode results.

---

## Slide 9 · Proof

**Headline:** What we tested, and what we didn't.

**On slide:** Python vs app engine on shared test vectors. Scenarios vs expected outcomes. Assistant: source or refusal. Counts below. All data simulated.

**Visual:** One table, every rate with its count:

| Check | Result | Source |
|---|---|---|
| Shared test vectors, Python vs TypeScript engine | [NUMBER: science/out/validation.json → vectors passed / total] | `contracts/vectors/` |
| Python science tests | [NUMBER: science/out/validation.json → tests passed / total] (interim report: `docs/rules-schedule/tasks6_7_validation.md`) | `science/tests/` |
| Scenarios showing their expected outcome | [NUMBER: science/out/validation.json → scenarios passed / 5] | `app/public/data/fixtures/` |
| Assistant: correct source or correct refusal | [NUMBER: science/out/assistant_eval.json → correct / total questions] | `content/eval.json` |
| Injected instruction in a document ignored | [NUMBER: science/out/assistant_eval.json → injection blocked / injection tests] | `ai/tests/injection.md` |
| Reference never absorbs a decline (S1) | [NUMBER: science/out/validation.json → S1 reference check] | `science/reference.py` |

**Speaker notes (about 45 s):** Every number on this slide comes from a script you can re-run; if it is not in the output file, it is not on the slide. The Python science code is our source of truth, and the app's engine must reproduce its test vectors to three decimals. Each scenario has an expected outcome, and we check it. The assistant is scored on whether it cites the right source or refuses when it should. Now where we lose: all data is simulated. Our Decode task is inspired by a known test, and our version needs independent validation. The thresholds are demonstration values. Any health effect needs an independent study.

---

## Slide 10 · Research track

**Headline:** Testing the method on real people, honestly labelled.

**On slide:** Same personal-reference method, run offline on LifeSnaps: real Earth-based volunteers, not astronauts. Descriptive results only. A per-person model stays a research prototype.

**Visual:** One small chart or table from the LifeSnaps check: per participant, how often a reference can be built, and how often values fall outside the personal range vs one fixed range [NUMBER: science/out/validation.json → LifeSnaps section, if it exists]. Label: "Research prototype · not astronaut data". If the file has no LifeSnaps section, drop this slide.

**Speaker notes (about 40 s):** We wanted to know if comparing a person with their own past readings is even workable on real data. So we ran the same reference method, offline, on LifeSnaps, a public study of Earth-based volunteers, licensed CC BY 4.0. It is not astronaut data, and we never show it as such. The results are descriptive [NUMBER: LifeSnaps counts from science/out/validation.json]. A per-person performance model is on our research track, on simulated data only, clearly labelled as a research prototype. It is not part of the product you just saw. [Shaimaa: confirm what was run before the pitch.]

---

## Slide 11 · Team

**Headline:** Four people, one loop.

**On slide:** Ahmed Ehab: app, Decode, assistant. Amr Abd ElHaleem: design, content, research. Shaimaa Muhammed: data, science logic. Youssef Elbaz: statistics, story.

**Visual:** Four name cards with roles. No photos needed. Small line: "Built with Claude Code agents under team review."

**Speaker notes (about 30 s):** Ahmed built the app, the Decode task, the engine port and the onboard assistant. Amr owns the design system, the domain content, the library and the submission. Shaimaa wrote the data-status, reference, rules and schedule logic in Python, with the test vectors the app must pass. Youssef owns the statistics and the story. We used Claude Code agents to write parts of the software, under our specification, and every change was reviewed and tested by one of us.

---

## Slide 12 · Next

**Headline:** What would make this real.

**On slide:** Independent validation of Decode. Medical review of rules and wording. Real wearable data. An analog-mission trial. Arabic and right-to-left. Advisory, not diagnostic.

**Visual:** Short roadmap of five steps. vitalents.life QR code and the repo link github.com/Vitalents/vitalents_app.

**Speaker notes (about 35 s):** Here is what would make Vitalents real. First, validate Decode against the standard test, independently. Second, have medical specialists review every rule, threshold and sentence. Third, connect real wearables instead of simulated records. Fourth, try it in an analog mission, with real crews and a real delay. And the strings are in one file, so Arabic and right-to-left can follow. Vitalents tells the astronaut what it knows, what it doesn't, and who decides. Thank you. The app is live at vitalents.life.

> **DRAFT · owner: Youssef Elbaz** (design: Amr). Max 7 slides. Every `[bracket]` is a placeholder; evidence numbers must come from `science/out/validation.json` and `science/out/assistant_eval.json`, never typed by hand.

# Vitalents · pitch deck outline

Screenshots to take from the live app (Amr): `map-day27.png`, `card-cognition-now.png`, `decode-round.png`, `decode-result.png`, `review-day27.png`, `review-why.png`, `rest-window.png`, `ask-cited.png`, `ask-refusal.png`, `s4-urgent.png`.

---

## Slide 1 · Title

**Headline:** Vitalents: health follow-up the astronaut understands and acts on.

- NASA Space Apps 2026 · Create Health Monitoring Software for Astronauts on Space Missions
- Team Vitalents: Ahmed Ehab · Amr Abd ElHaleem · Shaimaa Muhammed · Youssef Elbaz
- vitalents.life

**Visual:** Vitalents logo on teal; `map-day27.png` cropped.

**Speaker notes:** One sentence: "On a long mission, the astronaut is the first person who notices a change. We built the tool that helps them understand it and act on it, without waiting for Earth."

---

## Slide 2 · Problem

**Headline:** Far from Earth, the astronaut has to understand their own data.

- Long missions combine disrupted sleep, heavy workload, isolation and environmental exposures.
- Distance limits immediate support: messages to Earth wait through communication delay.
- A number without its context, quality and limits does not tell anyone what to do next.

**Visual:** Simple diagram: astronaut → data → "?" → Earth (delay).

**Speaker notes:** Medical monitoring already exists at NASA. Our hypothesis is that it can be clearer, more continuous and less burdensome for the person using it. That is a hypothesis to test, not a claim.

---

## Slide 3 · Solution: one loop

**Headline:** Collect → review → understand → act → follow.

- Body map with seven domains; each card: Now / Understand / Act.
- Three separate states: data quality, follow-up, connection. "No reading" never means "fine".
- Each astronaut is compared with their own past readings, not a fixed population value.
- One step at a time, with its reason, source and decision owner.

**Visual:** `map-day27.png` + `review-day27.png` side by side.

**Speaker notes:** Point at Fahim's map: heart shows "Limited quality" because of weak sensor contact; cognition shows "Watching"; symptoms shows "Under specialist review". Three labels, never merged.

---

## Slide 4 · Decode

**Headline:** 90 seconds, measured the same way every day.

- Inspired by the Digit Symbol Substitution Test (DSST); our version needs independent validation.
- Fixed rules inside the 90 seconds; the symbol key changes each session.
- Missed, late, duplicate and interrupted answers are never counted as wrong.
- Shown beside the self-rating, never combined. A message from Earth after every round.

**Visual:** `decode-round.png` + `decode-result.png`.

**Speaker notes:** Fahim rated himself 8/10. His last two sessions were below his personal range (41–44). We show both side by side and say what we know: two observations that happen together, not a cause.

---

## Slide 5 · Onboard AI that cites and refuses

**Headline:** A local NASA library that answers with sources, or says it doesn't know.

- Runs offline on the laptop; no cloud model.
- Answers only from retrieved NASA excerpts, with citations; "your data" is built by code, not by the model.
- Refuses medication and dose questions; blocks uncited claims and invented numbers.
- Unanswered questions go to a review list.

**Visual:** `ask-cited.png` + `ask-refusal.png`.

**Speaker notes:** The core of the app never depends on the model. The model only explains and summarises.

---

## Slide 6 · Evidence (and where we lose)

**Headline:** What we tested, and what we didn't.

- Shared test vectors: Python logic and the app's TypeScript engine produce the same results [n/n vectors pass].
- Data-status engine: [88/88] tests pass; agrees with the app on [30/30] sleep and heart-rate records in the Fahim scenario.
- Assistant: [x/15 from science/out/assistant_eval.json] correct source or correct refusal; [n] injected-instruction test blocked.
- Scenarios: [n/5 from validation.json] S1–S5 show their expected outcome.
- **Where we lose:** all data is simulated; Decode is not validated; reference rules are demonstration values; any health effect needs an independent study.

**Visual:** Simple table of the numbers above, each with its count.

**Speaker notes:** Every number on this slide comes from a script that can be re-run. If a number isn't in the file, it isn't on the slide.

---

## Slide 7 · Fit and next

**Headline:** Built with what NASA measures, for the missions NASA is planning.

- Challenge fit: visual self-assessment tool, guidance with sources, when to involve doctors, gamification, trends, offline.
- Next: real wearable integration, independent validation of Decode, medical review of thresholds, analog-mission trial.
- Advisory, not diagnostic.

**Visual:** Challenge checklist with ticks; vitalents.life QR code.

**Speaker notes:** Close on the loop and the honesty: "It tells the astronaut what it knows, what it doesn't, and who decides."

---

## Live demo script (about 3 minutes)

| Time | Who | What happens on screen |
|---|---|---|
| 0:00–0:20 | Youssef | Hook: "Fahim feels fine. He rated himself 8 out of 10." Open the map on mission day 27. |
| 0:20–0:45 | Ahmed | Map: point at the three separate labels — heart "Limited quality", cognition "Watching", symptoms "Under specialist review". Open the cognition card: Now tab, personal range 41–44, frozen while the follow-up is open. |
| 0:45–1:15 | Ahmed (or a judge) | Play a short Decode round (demo mode, labelled "Demo length, not a measurement"). Show the result beside the self-rating. |
| 1:15–1:45 | Ahmed | Today's review: Changed → "Why?" (supporting records, rule, limits). Next step → rest window: meeting moves, rest opportunity 6 h → 7 h, approver: planner. |
| 1:45–2:20 | Ahmed | Turn Wi-Fi off. Ask NASA: "Why does sleep matter on a long mission?" → cited answer. Ask: "What dose of melatonin should I take?" → refusal, added for review. |
| 2:20–2:45 | Ahmed | Counter-case S4: a reported symptom with a good Decode result → the medical review opens immediately; it never waits for the game. |
| 2:45–3:00 | Youssef | Evidence numbers [from slide 6] and the close: "Advisory, not diagnostic." |

**If anything fails:** switch to the backup video tab immediately and keep talking.

## 30-second video script (global submission variant)

| Time | Shot | Voice-over |
|---|---|---|
| 0–5 s | Map, day 27 | "Far from Earth, the astronaut is the first to notice a change." |
| 5–11 s | Cognition card, then Decode result beside the 8/10 rating | "Vitalents compares Fahim with himself, not with a population, and keeps how he feels beside how he performs." |
| 11–18 s | Review → Why? → rest window 6 h → 7 h | "One step at a time, with its source and who decides." |
| 18–25 s | Wi-Fi off, Ask NASA cited answer, then dose refusal | "Offline, the onboard library answers with NASA sources, or says it doesn't know." |
| 25–30 s | Logo + vitalents.life | "Vitalents. Advisory, not diagnostic. Simulated data." |

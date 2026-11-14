> **DRAFT · owner: Youssef Elbaz** (driver: Ahmed). Live demo on scenario S1 (Fahim). Button and label names below are copied from the app's string files (`app/src/content/strings.ts` and each feature's `strings.ts`). If a label changes, update this script.

# Vitalents · live demo script

## Before the pitch (10 minutes)

1. **Run locally on the demo laptop**, not from the public site: `cd app && npm run dev` (localhost:5173) with `VITE_ASSISTANT_MODE=live`, and the assistant on port 8008 (`cd ai && uvicorn ask_nasa:app --port 8008`). The public site has no recorded answers yet (`app/public/data/cached_answers.json`), so Ask only works live.
2. Open **Settings** (`/settings`) → **Choose a scenario**: `S1 · Performance change` → **Load S1** → **Confirm: replace local data with S1**. This resets anything played in rehearsal.
3. Still in Settings → **Simulated Earth link**: **Link available** = Up, **One-way delay** = **24 min**, tick **Speed up the demo (1 minute passes in 1 second)**. The panel should read "Round trip 48 min, shown in 48 s."
4. **Demo role** = **Astronaut**.
5. Open three tabs: the app on `/`, the backup video (offline file), and https://vitalents.life as a second backup.
6. Turn Wi-Fi **off** once the app and assistant are running. The demo is offline from here.

**On-screen values to re-check after the simulator replaces the stand-in fixture** (`app/public/data/fixtures/S1.json`): mission day 27; self-rating 8/10 (`sim:self_report:alert-d27`); personal range 41–44 (`sim:personal_reference:decode-d25`); Decode 37 and 36 on days 25–26; three nights under 6 h; rest opportunity 6 h now and 7 h with the meeting moved (`sim:mission_schedule:*-d27`). If a value on screen differs, say the value on screen, not the one here.

---

## 3-minute version

| Time | Route · exact clicks | What to say |
|---|---|---|
| 0:00–0:20 | **Today & map** (`/`). Point at the header: crew label, mission day, sync label. | "This is Fahim, a fictional crew member, on mission day 27. Everything here is simulated, and the banner says so. He rates himself 8 out of 10. He feels fine." |
| 0:20–0:45 | Still on the map. Point at three regions: heart, cognition, symptoms. Then click the **cognition** region → domain card, **Now** tab. | "Three different labels, never one colour. Heart: limited quality, weak sensor contact: a data problem. Cognition: watching. Symptoms: under specialist review. On the card: his Decode result against his own personal range, and the reference is frozen while this follow-up is open, so a lower result never becomes his new reference." |
| 0:45–1:25 | Nav: **Check & Decode** (`/check`). Daily check shows "Already recorded today" → **Go to Decode**. Tick **Demo length (30 s)** → **Start practice** (10 s, not recorded) → **Start the round** → play 30 s → **No** (no interruption) → **Message from Earth** → **See your result**. | "Decode is 90 seconds, measured the same way every day. For the demo we use a 30-second length, and the app labels it 'Demo length, not a measurement': it never enters his reference. Missed and late answers are never counted as wrong. A message from Earth after every round, whatever the score. And the result sits beside his self-rating. Two scales, never combined." |
| 1:25–1:55 | Nav: **Today's review** (`/review`). Under **Changed**, open **Why?**. | "Today's review: recorded, changed, missing, one next step. 'Why?' shows the records behind it, the rule and its version, and its limits. Two observations happen together: lower Decode results and short nights. It does not say one caused the other." |
| 1:55–2:30 | Nav: **Plan & follow-ups** (`/plan`). On "Review tonight's rest window" → **Compare schedule options** (`/rest-window`). Show **Now** vs **With the change** → **Request this change**. | "The step is to review tonight's rest window. A meeting can move. Rest opportunity goes from 6 hours to 7. That is time to rest, not a promise of sleep. The planner approves, and the planner sees only this request, nothing about his health." |
| 2:30–2:50 | Nav: **Review & sharing** (`/share`). Add a short question → **Check what will be sent** → point at **Not included: Your private notes** → **Send to the medical team**. Point at **Delivery**: Saved on device → Waiting to send → Sent. | "Before anything leaves, he sees exactly what is sent. Private notes stay with him. The link has a 24-minute delay each way, sped up here. The app keeps working while it waits." |
| 2:50–3:00 | Back to slides (slide 6). | "It tells the astronaut what it knows, what it doesn't, and who decides." |

---

## 5-minute version

Same as the 3-minute version up to 2:50, then:

| Time | Route · exact clicks | What to say |
|---|---|---|
| 2:50–3:20 | Click the **sleep** region on the map (`/domain/sleep`) → **Understand** tab → ask "Why do we measure sleep on a long mission?" | "Offline, Wi-Fi is off. The onboard assistant answers only from the NASA library, with a citation on every sentence. 'Your data' is built by code, not by the model." |
| 3:20–3:40 | Same box: ask "What dose of melatonin should I take tonight?" → **Add this question for review**. | "And it refuses. No medication, no dose. The question goes to a review list. The library only changes after specialist review." |
| 3:40–4:05 | Nav: **Review & sharing** (`/share`). By now **Delivered** shows with its time. **Settings** → **Demo role** = **Medical team** → **Medical team view** (`/medical`) → open the package → **Mark reviewed**. | "Delivered, with the time it arrived. Now I switch to the medical team. They see only what Fahim shared. When they mark it reviewed, and only then, the astronaut sees 'Reviewed'." |
| 4:05–4:20 | **Settings** → **Demo role** = **Planner** → **Mission planner view** (`/planner`). | "The planner sees the schedule and the rest-window request. No health records. That is enforced in the data layer, not by hiding buttons." |
| 4:20–4:45 | **Settings** → **Demo role** = **Astronaut**. **Choose a scenario** = `S4 · Presentation needing review` → **Load S4** → **Confirm: replace local data with S4** → **Today & map** → **Today's review**. | "Counter-case. Crew D, another fictional crew member, reports a headache and feeling hot, and has a good Decode result. The review opens right away. A good game result never closes or delays a medical review." |
| 4:45–5:00 | Back to slides (slide 6). | "Advisory, not diagnostic. Simulated data. Every step with its source." |

---

## Fallbacks

| If this happens | Do this | Say |
|---|---|---|
| Rest window shows something unexpected, or a judge asks "what if nothing can move?" | **Settings** → load **S3 · No schedule alternative** → **Plan & follow-ups** → **Compare schedule options**. Screen says "No valid alternative within the current constraints." | "Here every evening task is fixed. The app says there is no valid alternative. It never moves a task on its own." |
| A judge asks about urgent symptoms, or the S1 story stalls | Load **S4** (see 5-minute version), or press **Request help** in the header from any screen, even during Decode. | "Request help opens a review request right away. It never waits for a game result or a repeat measurement." |
| Decode round breaks or the timer looks wrong | **Quit** → **Back to Decode**; or skip Decode and show the result card from the backup video. | "An interrupted round is saved as interrupted, not as wrong, and is not used for comparison." |
| Delivery is slow to reach **Delivered** | Check **Settings** → **Speed up the demo** is ticked. Round trip with 24 min each way is 48 s sped up. Keep talking and come back to `/share`. | "In a real mission this would take about 48 minutes for the round trip. The app keeps working meanwhile." |
| Want to show "connection lost" | **Settings** → **Link available** = **Down**, then send a package. It stays **Waiting to send**. Set it back to **Up** and it sends once, with no duplicate. | "No link: the package waits on the device and sends when the link is back. One record, never three." |
| Assistant not running | Open any domain card → **Understand**. It shows "Assistant unavailable · reviewed content". | "The core never depends on the model. Here is the reviewed text instead." |
| App will not load at all | Switch to the backup video tab. If the network is up, try https://vitalents.life. | Keep the same story; do not apologise for long. |

## Rehearsal checklist

- [ ] Ran the 3-minute version three times under 3:00.
- [ ] Reloaded S1 after every rehearsal.
- [ ] Wi-Fi off during the full run, assistant still answering.
- [ ] Backup video plays offline.
- [ ] Every sentence on stage follows the CLAUDE.md wording table: observations and sources, no verdicts, no causes.

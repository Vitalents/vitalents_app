> **DRAFT · owner: Youssef Elbaz** (with Amr for research questions). Short, honest answers. Replace every `[bracket]` with a number from `science/out/` or remove the sentence.

# Vitalents · likely judge questions

**1. Is this a medical device?**
No. It is advisory only: no diagnosis, no medication, no dose, no readiness verdict. It helps the astronaut understand a change and tells them when to involve the medical team. Thresholds in the demo are demonstration values, not approved medical limits.

**2. Where does your data come from?**
The demo runs on a simulated crew member, Fahim, with all records labelled simulated. Live Decode rounds played during the demo are labelled as live rounds added to a simulated history. Separately, we checked the personal-reference method on LifeSnaps v4, a public study of Earth-based participants (CC BY 4.0), never presented as astronaut data. [Confirm whether LifeSnaps numbers appear in the final build.]

**3. Why trust a 90-second game?**
Decode is inspired by the DSST, a well-known test of processing speed and attention. We keep the 90 seconds identical every session, record every trial, and compare each astronaut with their own past sessions. We say clearly that our version needs independent validation.

**4. Why not a fixed threshold for everyone?**
People differ. We compare each astronaut with their own valid past readings, state the period and method, and show "not comparable" when the data isn't enough. The reference is frozen while a follow-up is open, so a decline never becomes the new normal.

**5. How does the AI avoid making things up?**
It answers only from retrieved NASA excerpts, every sentence cited. Code checks reject citations that weren't retrieved and any number not in the inputs, and it refuses when retrieval is weak or the question is about medication or doses. On our test set: [x/15 from science/out/assistant_eval.json].

**6. What if the AI is unavailable?**
The core never depends on it. The map, Decode, review, rules, follow-ups and sharing all work without the model; the Understand tab falls back to reviewed fixed content.

**7. How do you handle communication delay with Earth?**
Summaries are saved locally and move through queued → sent → delivered → reviewed, each shown only with its proof. The app keeps working while they wait, and nothing is sent without the astronaut's preview and confirmation.

**8. Who sees what?**
The astronaut sees their full record. The medical team sees what was shared. The planner sees only operational requests, such as a schedule change, never health data or Decode results. Private notes never leave the astronaut. Permissions are enforced in the data layer.

**9. Does a lower Decode score mean poor sleep caused it?**
No. We show two observations that happen together, never a cause. If a step helps afterwards, we record what happened without claiming the step caused it.

**10. What would make this real?**
Independent validation of Decode against the standard test, medical review of the thresholds and wording, real wearable integration, and a trial in an analog mission before any flight use.

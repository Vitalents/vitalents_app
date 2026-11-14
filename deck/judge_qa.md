> **DRAFT · owner: Youssef Elbaz** (with Amr for research questions). Short, honest answers. Replace every `[NUMBER: …]` with a value from the file named, or remove the sentence. If you don't know, say "We haven't tested that" and name what would test it.

# Vitalents · likely judge questions

## Product and safety

**1. Is this a medical device?**
No. It is advisory only: no diagnosis, no medication, no dose, no readiness verdict. It helps the astronaut understand a change and tells them when to involve the medical team. Thresholds in the demo are demonstration values, not approved medical limits.

**2. How is this different from the medical monitoring NASA already does?**
We don't replace it. We focus on the astronaut's side: one place where they can see their own data, its quality and its limits, and the next step with its source and owner. Our hypothesis is that this makes follow-up clearer and less burdensome. That needs testing with real crews.

**3. Why not one green / amber / red status per area?**
Because one colour hides why. A weak sensor, a real change and a message stuck in the link would all look the same. We keep data status, follow-up status and delivery status separate, and "No reading" never means "fine".

**4. Why not a fixed threshold for everyone?**
People differ. We compare each astronaut with their own valid past readings, state the period and method, and show "not comparable" when the data isn't enough. The reference is frozen while a follow-up is open, so a decline never becomes the new reference.

**5. Does a lower Decode score mean poor sleep caused it?**
No. We show two observations that happen together, never a cause. If a step helps afterwards, we record what happened without claiming the step caused it.

**6. What happens when a symptom is reported but Decode looks good?**
The review opens at once. A good game result never closes or delays a medical review. Scenario S4 shows this, and **Request help** works from every screen, even during a Decode round.

## Decode

**7. Why trust a 90-second game?**
Decode is inspired by the DSST, a well-known test of processing speed and attention. We keep the 90 seconds identical every session, record every trial, and compare each astronaut with their own past sessions. We say clearly that our version needs independent validation.

**8. What about practice effects, or someone just pressing keys fast?**
The first sessions are excluded from the reference (a demonstration setting, not a fixed rule), and the practice round uses a different key and is never recorded. Answers that look like random pressing make the session "not comparable" instead of counting it. Missed, late and duplicate presses are stored separately, never as wrong.

**9. Wouldn't one combined score be simpler?**
Simpler, but misleading. How someone feels and how they perform are different scales. We show the self-rating and the Decode result side by side so the astronaut and the medical team can see both.

## Data and evidence

**10. Where does your data come from?**
The demo runs on simulated crew members, with every record labelled simulated. A live Decode round played in the demo is labelled as a live round added to a simulated history. Separately, the team checked the personal-reference method offline on LifeSnaps v4, a public study of Earth-based volunteers (CC BY 4.0), never presented as astronaut data. [CONFIRM (Shaimaa): whether LifeSnaps results are in the final build.]

**11. Why not use real astronaut data?**
Individual astronaut health data is controlled-access, and we could not get it in a hackathon. We say so instead of pretending. The data contract already has a separate realm for research data, so real data can never mix with simulated records.

**12. What did you actually test?**
Python logic and the app's TypeScript engine against shared test vectors: [NUMBER: science/out/validation.json → vectors passed / total]. Scenario outcomes: [NUMBER: science/out/validation.json → scenarios passed / 5]. Assistant: [NUMBER: science/out/assistant_eval.json → correct / total]. We did not test anything with real people or real astronauts.

**13. What happens when data is missing?**
It is shown as missing, never as zero and never as "fine". Scenario S2 has no sleep reading and an interrupted Decode round: both are labelled, nothing is filled in, and the next step is to complete the measurement.

## Assistant

**14. How does the AI avoid making things up?**
It answers only from retrieved NASA excerpts, every sentence cited. Code checks reject citations that weren't retrieved and any number not in the inputs, and it refuses when retrieval is weak or the question is about medication or doses. On our test set: [NUMBER: science/out/assistant_eval.json → correct source or correct abstention / total].

**15. What if a document in the library contains a hidden instruction?**
Retrieved text is treated as data, never as instructions. Our test set includes one document with an injected instruction (`ai/tests/injection.md`): [NUMBER: science/out/assistant_eval.json → injection blocked / injection tests].

**16. What if the AI is unavailable?**
The core never depends on it. The map, Decode, review, rules, follow-ups and sharing all work without the model; the Understand tab falls back to reviewed fixed content.

**17. Which model, and why local?**
A local model through Ollama ([MODEL: gpt-oss:20b or Qwen 27B, from science/out/assistant_eval.json]), because a spacecraft far from Earth cannot count on a cloud service. It runs on one laptop with the network off.

## Operations and privacy

**18. How do you handle communication delay with Earth?**
Summaries are saved locally and move through saved, waiting to send, sent, delivered and reviewed, each shown with its time. The app keeps working while they wait. Nothing is sent without the astronaut's preview and confirmation, and a resend never creates a duplicate.

**19. Who sees what?**
The astronaut sees their full record. The medical team sees what was shared. The planner sees only operational requests, such as a schedule change, never health data or Decode results. Private notes never leave the astronaut. Permissions are enforced in the data layer.

**20. Is there real login or security?**
Not in the MVP. Roles are switched in Settings only to show the permissions. The permissions themselves are enforced and tested in the data layer, but authentication and encryption are future work.

## Honesty and next steps

**21. What is your biggest weakness?**
Everything is simulated, and Decode still needs independent validation against the standard test. We built the tool to be honest about what it knows, but whether it helps real crews is untested.

**22. What would make this real?**
Independent validation of Decode against the standard test, medical review of the thresholds and wording, real wearable integration, and a trial in an analog mission before any flight use.

**23. How did you use AI to build it?**
Claude Code agents wrote parts of the code and drafts under our specification. Every change was reviewed and tested by a team member, and every source was checked by the team.

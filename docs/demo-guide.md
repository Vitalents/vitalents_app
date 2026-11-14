# Explore Vitalents

A short tour of how an astronaut's observations become an understandable review and a next step. [Open the demo](https://vitalents.life/) or [run it locally](../app/README.md).

## Start with Fahim

In **Settings**, select **S1 · Performance change** and the **Astronaut** demo role. If you want a fresh record, choose **Load S1** and confirm; this replaces the current local scenario data.

Fahim is a fictional crew member. His simulated history includes short nights, Decode results below his personal range, a missing pulse reading and an open symptom follow-up. His self-rating and task performance remain separate observations.

## Three-minute tour

| Time | Open | Explore |
|---|---|---|
| 0:00–0:30 | **Today & map** | Read the simulated-data banner. Open a body-map region and distinguish data quality from follow-up status. Missing pulse data remains “No reading.” |
| 0:30–1:10 | **Today's review** | Read what was recorded, what changed and what is missing. Open **Why?** to inspect supporting records and rule limitations. |
| 1:10–1:50 | **Plan & follow-ups** | Open the rest-window action and **Compare schedule options**. Compare the available time to rest; a schedule option does not predict sleep or improvement. The planner owns approval. |
| 1:50–2:25 | **Review & sharing** | Inspect the share preview and what it excludes. Delivery and review are separate states, simulated on this browser. |
| 2:25–3:00 | **Settings → Proof and limits** | Inspect the evidence files, shared engine vectors and explicit limits. Each displayed result belongs to its recorded check, dataset and time. |

This tour uses the existing simulated history. Allow additional time to play Decode or explore the assistant.

## Try Decode

Open **Check & Decode**, then **Go to Decode** or save a daily check. Complete the 10-second practice and start the 90-second round. Answer the interruption question, then open the result. The response ledger, information status and self-rating remain distinguishable.

For a shorter interaction, select **Demo length (30 s)** before starting. This round is saved as practice and excluded from the personal reference. It is not a measurement. A full live round is labelled as a live result added to simulated history; it is not evidence of medical readiness.

**A message from home** can be read or heard independently of the result. Its story, image and voice are fictional demo material, labelled in the app.

## Explore the counter-cases

Choose a scenario in **Settings**. Loading it replaces the current local record after confirmation.

| Scenario | What changes |
|---|---|
| **S1 · Performance change** | Personal-range change, short nights and an open symptom follow-up appear together without a causal claim. |
| **S2 · Missing measurement** | A missing sleep reading and interrupted Decode round remain explicit; values are not invented. |
| **S3 · No schedule alternative** | Fixed tasks leave no valid schedule alternative. |
| **S4 · Presentation needing review** | A reported symptom requests review even when the Decode result is good. |
| **S5 · Communication delay** | Sharing moves through separate delivery states with a simulated 24-minute delay. |

The **Medical team** and **Planner** roles in Settings show different permitted views. These switches demonstrate application permissions, not authenticated accounts or a clinical communication system.

## Sources and assistant

**Ask NASA** offers a source library and recorded responses in the public build. The publication policy withholds two unsupported explanations; a withdrawal notice is an expected outcome. Other questions may have no recorded answer. Source content remains draft pending review, and a citation alone does not prove an explanation is scientifically supported.

The app's core journey works independently of the assistant. For offline exploration, first load the production build online; uncached assets and external source pages need network access. Local live-model setup is described in [the assistant guide](../ai/README.md).

See [evidence and limitations](validation.md) for the scope of the checks and [architecture](architecture.md) for implementation details.

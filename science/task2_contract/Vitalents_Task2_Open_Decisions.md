# Vitalents Task 2 — Outstanding Questions

**Status:** FOR TEAM REVIEW — these do not block presenting the dictionary for review. They block freezing some implementation choices, public redistribution, or claiming official NASA resource compliance.

## Decisions for Ahmed (application architecture)

1. **Primary keys and namespaces:** Should records use UUIDs or stable namespaced IDs? Confirm the exact FK name (`subject_id` referring to `subject_profile.subject_profile_id`). Our reference names are provisional.
2. **Null representation:** For optional metrics, will an absent property be omitted or present as `null`? Persisted 0 means observed zero, never missing.
3. **Timestamps:** Confirm ISO8601 UTC only for new app events, while LifeSnaps retains local date and optional local hour with unknown offset; no conversion to fake UTC.
4. **Hourly duplicate policy:** 70 duplicate `(id,date,hour)` keys, including one conflicting duplicate; keep original row ID and surface conflict for manual/scientific review instead of last-wins.
5. **Schema nesting / form contracts:** Confirm proposed entity names, union types, enum names, and where to use links versus embedded objects, before implementation in GitHub.

## Decisions for Shaimaa (scientific/data interpretation)

6. **Temperature meaning:** Confirm unit + method for `nightly_temperature`, and exact meaning of signed `hourly.temperature`, `daily_temperature_variation` from source pipeline. Until then do not publish or calculate a temperature judgement.
7. **Personal reference acceptance:** 5 valid preceding days within 14 is a demonstration heuristic from scope, not medically approved. Later reference logic should fix data sufficiency rules and version/freeze behavior after reproducible tests.

## Decisions requiring team agreement

8. **Authority of latest scope:** Scope Update (14 Nov) is described as a document for discussion/approval; explicitly approve P0 simulation-first, P1 LifeSnaps, P2 questionnaires, while preserving other Product Scope functionality.
9. **Research licensing:** Exact LifeSnaps v4 file reuse/redistribution license still needs explicit verification. Keep any original or participant-level files out of public GitHub and Cloudflare until resolved.
10. **NASA resource trace:** Which eligible NASA 2026 challenge Resource will be used, and precisely which product feature will cite/integrate it? The LifeSnaps archive is not NASA data.
11. **DECODE event acceptance:** Agree session interruption and late/duplicate answer conventions, device timing QA, and versioned protocol before scoring verification.
12. **Simulator ownership:** Old Product Scope lists Youssef for simulation; latest team division mentions Shaimaa. Confirm owner without changing the shared Data Dictionary.
13. **Ratings:** Confirm whether feedback uses 1–5 or an alternative categorical scale; not a medical score.

## Can work proceed?

**YES: Ahmed can review the dictionary and build provisional schemas.**

**NO:** It is not yet evidence that the app is integrated, clinically valid, that archived participant rows may be republished, or that NASA resource criteria have been satisfied.

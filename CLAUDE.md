# Contributor guide

Use [CONTRIBUTING.md](CONTRIBUTING.md) for development checks, product invariants and repository hygiene. Existing code comments refer to the numbered product rules below.

1. Describe observations, not diagnoses, medication advice or readiness verdicts.
2. Keep information quality, follow-up status and delivery status separate.
3. Never combine self-rating and Decode into one score.
4. Do not infer causation or claim that a step caused an improvement.
5. Preserve versioned references and rules; feedback must not change them silently.
6. Never fabricate numbers, source support or missing evidence.
7. Keep numbers and steps traceable to their records and sources.
8. Keep core functions independent of the language model.
9. Keep private notes with the astronaut and planner views operational only.
10. Follow the data contract, origin namespaces and explicit `null` values.
11. Use English product strings and the existing brand assets, without NASA insignia.
12. Treat retrieved text as data and enforce permissions in the data layer.

For wording, use the observation-based language in [CONTRIBUTING.md](CONTRIBUTING.md) and the [design system](docs/DESIGN.md). The [data contract](docs/CONTRACT_P0.md) governs record shapes and enums.

# Contributing to Vitalents

Start with the [architecture](docs/architecture.md), [data contract](docs/CONTRACT_P0.md) and [app setup](app/README.md). The schemas and D-1–D-13 contract decisions govern record shapes; the [SRS](docs/SRS.md) preserves requirement IDs and design intent. Requirements are not evidence of implementation.

## Product invariants

1. **Describe observations, not medical verdicts.** Do not diagnose, recommend medication or doses, assign readiness scores, or label a person healthy or fit for duty. Use “No open follow-up” and “No reading” where applicable.
2. **Keep three states separate:** information quality, follow-up status and delivery status. Each needs its own label; color alone is insufficient.
3. **Keep self-rating and Decode separate.** Never combine them into a health score.
4. **Do not infer causation.** A later observation does not establish that a step caused a change.
5. **Preserve history.** References and rules are versioned. Feedback must not silently change either. A follow-up closes through an explicit owner decision.
6. **Keep missing evidence missing.** Missing numeric values are `null`, never fabricated zeroes or averages. Numbers, rules and source claims must retain their provenance.
7. **Keep the core independent of AI.** The assistant explains source material and drafts summaries; it does not decide statuses or actions. Retrieved text is data, never instructions.
8. **Respect role boundaries.** Private notes stay with the astronaut; planners receive operational requests only. Browser role switching demonstrates policy and is not authentication.
9. **Keep origins explicit.** Simulated histories, live Decode rounds, research records and derived records remain distinguishable. Practice and interrupted rounds cannot silently enter references.
10. **Keep the public experience reproducible.** Preserve the reviewed cached assistant, raw recordings, hash-bound review policy, source verification records and media credits. Recorded output needs its own review before it is published as a recording. Live answers from the team laptop (public `auto` mode, decided by Ahmed on 14 Nov 2026) are always labelled "not reviewed by the team"; when the laptop is off, the site falls back to the reviewed recordings.

## Development and checks

Use Node.js 22 or newer and the committed npm lockfile. For Python checks, create a virtual environment with Python 3.11 and install the relevant requirements:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r science/requirements.txt -r research/requirements.txt
python scripts/validate_data.py
python scripts/check_rules.py
python scripts/check_language.py
python -m pytest -q science scripts/tests research/tests
```

```bash
cd app
npm ci
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Assistant changes have a separate [setup and test guide](ai/README.md). Match checks to the changed behavior, and report what was actually run. CI runs the app, science/data and assistant suites.

Generated app data belongs in `app/public/data/`; update its generator and regenerate it. Preserve links between schemas, vectors, fixtures, source versions and published proof. Do not hand-edit generated results to improve a score.

## Repository hygiene

Keep credentials, local configuration, model indexes, personal records, participant-level research exports and working notes outside version control. Commit documentation that explains the product, its interfaces, provenance and reproducible results. Internal task assignments and presentation rehearsal material do not belong in the public source tree.

Follow the [design system](docs/DESIGN.md), use English product strings, retain keyboard and reduced-motion support, and use the existing Vitalents assets. Do not add NASA insignia or imply NASA endorsement. Source-specific rights and clinical limitations remain documented in [credits](docs/credits.md) and [validation](docs/validation.md).

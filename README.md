# Vitalents

Astronaut health follow-up demonstration for NASA Space Apps 2026.
**Simulated histories; not a medical device.** A live Decode round can be added to simulated history with a separate origin label. The custom task, reference policy and thresholds need independent validation.

[App](https://vitalents.life/) · [Repository](https://github.com/Vitalents/vitalents_app) · [Project-page draft](submission/project_page.md) · [External submission handoff](submission/checklist.md)

| Folder | Purpose |
|---|---|
| `app/` | React 19 / TypeScript, local storage, five scenarios and browser engine |
| `contracts/` | Frozen data contract, JSON Schemas and shared vectors |
| `science/contract_logic.py` | Python oracle for app D-10 demonstration policy |
| `science/`, `research/` | Separate simulation and research estimators; synthetic examples are not clinical evidence |
| `ai/` | Local Ollama assistant, source index, quote-verification record and reproducible reviewed fallback |
| `content/` | Domain cards, draft source excerpts and demonstration rules |
| `docs/` | Specification, contract and [phase-one evidence limits](docs/phase1-validity.md) |

```bash
cd app
npm ci
npm run dev
npm test
npm run build
```

From the repository root, with project Python dependencies installed:

```bash
python3 scripts/validate_data.py
python3 scripts/check_language.py
python3 -m pytest ai/tests -q
python3 ai/record_answers.py --from-recording ai/recordings/2026-11-14-gptoss20b.raw.json
```

The phase-one fixes connect live record changes to new review records, constrain action ownership and role views, complete the later-reading/manual-closure flow, strengthen fixture checks, and correct source/cached-answer metadata. Scoped regressions accompany these changes; deployment acceptance is a separate check, not implied by this README.

Cloudflare Pages builds force reviewed `cached` mode, so the public app uses the published recording policy. Local builds can use `auto`/`live` with the local `gpt-oss:20b` service and optional tunnel. The core app does not depend on the model. Citation/refusal checks and the historical 15-question source-title evaluation do not establish scientific accuracy. Two unsupported recorded explanations were withdrawn with explicit publication-review notices; raw outputs remain preserved. Sources remain draft, with rights and clinical-review limits documented.

Role switching and delayed delivery are browser demonstrations, not authenticated clinical accounts or real space communication. The functional app does not complete event registration, official-resource confirmation or final video/deck requirements. See the submission handoff before claiming official readiness.

Agents: read `CLAUDE.md` and `docs/CONTRACT_P0.md` first.

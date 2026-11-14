# Vitalents

Astronaut health follow-up that the astronaut understands and acts on. NASA Space Apps 2026.
**Simulated data only. Not a medical device.**

| Folder | What |
|---|---|
| `app/` | Vite + React + TypeScript, deployed by Cloudflare Pages to https://vitalents.life |
| `contracts/` | Data contract v1.0: JSON Schemas, example bundle, test vectors |
| `science/` | Python reference implementation of the logic (source of truth) |
| `ai/` | Ask NASA assistant (FastAPI + Ollama), runs locally only |
| `content/` | Domain cards, rules, messages, eval questions |
| `docs/` | `SRS.md`, `TEAM_PLAN.md`, `CONTRACT_P0.md`, data dictionary |

```bash
cd app && npm i && npm run dev           # app on localhost:5173
python3 scripts/validate_data.py         # check every data file against the contract
```

Agents: read `CLAUDE.md` first.

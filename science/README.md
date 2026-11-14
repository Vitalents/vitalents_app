# science/

Python reference implementation (Shaimaa): `status.py`, `reference.py`, `rules.py`, `schedule.py`, `decode.py`, and the S1-S4 mission replay `simulator.py`. See `docs/science/` and `docs/reference/INTEGRATION_NOTES.md`.

Integration scripts on top of it (they never edit the engines or the replay):

| File | What it does |
|---|---|
| `export_bundles.py` | Replay → app bundles `out/scenarios/S1..S4.json` (contract v1.0, D-1 IDs, mission calendar day 27 = 2026-11-14), S5 copied from the hand-made fixture, `out/export_manifest.json` with every adaptation |
| `validate.py` | `out/validation.json` for the Proof screen (shape: `docs/proof/validation_schema.md`) |
| `contract_logic.py` | Python versions of the contract vector functions (`score_decode`, `build_reference`, `compare_to_reference`, `rest_opportunity`); reproduce `contracts/vectors/` |

```bash
python3 -B -m science.simulator --out mission_replay.json     # Shaimaa's replay (SHA-256 e3827e7b...)
python3 science/export_bundles.py                             # or --replay mission_replay.json; same bytes
python3 science/validate.py && python3 scripts/publish_proof.py
python3 scripts/validate_data.py science/out/scenarios/*.json
cd science && python3 -m pytest -q
```

All data is simulated. The exported bundles are not copied into `app/public/data/fixtures/` until the gaps in INTEGRATION_NOTES ("What the app needs") are settled.

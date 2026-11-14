# Simulation and contract checks

Python tools for synthetic mission scenarios, descriptive reference policies and reproducible software checks. No file in this directory establishes medical validity or real astronaut outcomes.

| Component | Purpose |
|---|---|
| `contract_logic.py` | Python counterpart of the app's scoring, D-10 reference, comparison and rest-opportunity vectors |
| `status.py`, `reference.py` | Independent quality and reference pipeline with explicit adapter context and lifecycle decisions |
| `rules.py`, `schedule.py` | Source-aware review policies and evaluation of supplied schedule alternatives |
| `decode.py` | Raw response-event verification |
| `simulator.py` | Seeded S1–S4 research replay |
| `export_bundles.py` | Replay-to-contract adaptation; writes S1–S5 exports and an adaptation manifest |
| `validate.py` | Produces the stored checks consumed by the Proof screen |

The browser fixtures and research replay have different subjects and policies. Read the [integration boundaries](../docs/reference/INTEGRATION_NOTES.md) before substituting their outputs. The [data contract](../docs/CONTRACT_P0.md) defines the browser format; the [validation schema](../docs/proof/validation_schema.md) defines the proof artifact.

## Run from the repository root

Use Python 3.11 and the project virtual environment:

```bash
python3 -m pip install -r science/requirements.txt pytest
python3 -m pytest -q science
python3 -B -m science.simulator --out mission_replay.json
python3 science/export_bundles.py --replay mission_replay.json
python3 science/validate.py
python3 scripts/validate_data.py science/out/scenarios/*.json
```

The export command writes `science/out/scenarios/` and `science/out/export_manifest.json`; it does not replace `app/public/data/fixtures/`. Publishing proof is an explicit generated-file update:

```bash
python3 scripts/publish_proof.py
```

For the app's separate S1 fixture, use `python3 -m scripts.make_fahim_s1 --check` after installing the app dependencies. Preserve null values, origin labels, raw events, denominators and source metadata when regenerating data. [Validation and limits](../docs/validation.md) explains what the stored results do and do not establish.

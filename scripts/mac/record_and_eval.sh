#!/usr/bin/env bash
# Vitalents · with start_assistant.sh running in another window: record the fallback answers,
# run the 15-question evaluation, publish the proof numbers and push.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/ai"
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install -q -r requirements-dev.txt
curl -fsS http://127.0.0.1:8008/health >/dev/null || { echo "Start the assistant first: bash scripts/mac/start_assistant.sh"; exit 1; }
mkdir -p ../science/out
python record_answers.py
python ask_nasa.py --eval ../content/eval.json --out ../science/out/assistant_eval_gptoss.json
python eval_summary.py ../science/out/assistant_eval_gptoss.json || true
cd "$ROOT"
python3 scripts/publish_proof.py
python3 scripts/check_language.py
git add app/public/data/cached_answers.json app/public/data/proof.json science/out/assistant_eval_gptoss.json
git commit -m "FR-AS-08: recorded answers and assistant evaluation from the onboard model"
git push
echo "Done. Check every recorded answer by reading app/public/data/cached_answers.json."

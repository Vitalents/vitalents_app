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
python scripts/publish_proof.py
python scripts/check_language.py
# The public fallback (app/public/data/cached_answers.json) is published only after a review against the sources
# (ai/cache_review.json, see ai/README.md). Keep the reviewed version; commit the new raw recording as evidence.
git checkout -- app/public/data/cached_answers.json 2>/dev/null || true
git add app/public/data/proof.json science/out/assistant_eval_gptoss.json ai/recordings/*.raw.json
git commit -m "FR-AS-08: recorded answers and assistant evaluation from the onboard model"
git push
echo "Done. New recordings stay withheld until a hash-bound editorial review in ai/cache_review.json. Review raw recordings and the published cache separately."

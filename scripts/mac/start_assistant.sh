#!/usr/bin/env bash
# Vitalents · run the onboard assistant on this Mac and publish it at https://ask.vitalents.life
# through a Cloudflare Tunnel. Ollama itself stays private on this laptop: only the assistant API
# (127.0.0.1:8008, origin-restricted and rate-limited) goes through the tunnel.
#
#   bash scripts/mac/start_assistant.sh            # assistant + tunnel
#   bash scripts/mac/start_assistant.sh --local    # assistant only (no tunnel)
#
# Stop with Ctrl+C. The live site falls back to recorded answers whenever this is not running.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOSTNAME_PUBLIC="${VITA_PUBLIC_HOST:-ask.vitalents.life}"
TUNNEL_NAME="${VITA_TUNNEL_NAME:-vitalents-ask}"
LLM="${VITA_LLM:-gpt-oss:20b}"
EMBED="${VITA_EMBED:-nomic-embed-text}"
PORT=8008
LOCAL_ONLY=0; [[ "${1:-}" == "--local" ]] && LOCAL_ONLY=1

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
need_brew() { command -v brew >/dev/null || { echo "Homebrew is required: https://brew.sh"; exit 1; }; }

say "1/6 Checking tools"
command -v python3 >/dev/null || { need_brew; brew install python@3.11; }
command -v ollama  >/dev/null || { need_brew; brew install ollama; }
if [[ $LOCAL_ONLY == 0 ]]; then command -v cloudflared >/dev/null || { need_brew; brew install cloudflared; }; fi

say "2/6 Starting Ollama (private, localhost only)"
if ! curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  (OLLAMA_HOST=127.0.0.1:11434 ollama serve >/tmp/vitalents-ollama.log 2>&1 &)
  for _ in $(seq 1 30); do curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break; sleep 1; done
fi
for m in "$LLM" "$EMBED"; do
  ollama list | awk '{print $1}' | grep -qx "$m" || ollama list | awk '{print $1}' | grep -qx "$m:latest" || ollama pull "$m"
done

say "3/6 Python environment (ai/.venv)"
cd "$ROOT/ai"
[[ -d .venv ]] || python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install -q --upgrade pip
python -m pip install -q -r requirements.txt

say "4/6 Building the library index from ai/corpus"
python ask_nasa.py --build

say "5/6 Starting the assistant on 127.0.0.1:$PORT"
lsof -ti tcp:$PORT >/dev/null 2>&1 && { echo "Port $PORT is busy; stopping the old process."; kill "$(lsof -ti tcp:$PORT)" || true; sleep 1; }
VITA_LLM="$LLM" python -m uvicorn ask_nasa:app --host 127.0.0.1 --port $PORT >/tmp/vitalents-assistant.log 2>&1 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break; sleep 1; done
curl -fsS "http://127.0.0.1:$PORT/health" && echo || { echo "Assistant did not start; see /tmp/vitalents-assistant.log"; exit 1; }

if [[ $LOCAL_ONLY == 1 ]]; then
  say "Running locally only at http://127.0.0.1:$PORT (Ctrl+C to stop)"; wait $API_PID; exit 0
fi

say "6/6 Cloudflare Tunnel -> https://$HOSTNAME_PUBLIC"
if [[ ! -f "$HOME/.cloudflared/cert.pem" ]]; then
  echo "A browser window opens: sign in to Cloudflare and choose the zone vitalents.life."
  cloudflared tunnel login
fi
cloudflared tunnel list 2>/dev/null | awk '{print $2}' | grep -qx "$TUNNEL_NAME" || cloudflared tunnel create "$TUNNEL_NAME"
TUNNEL_ID="$(cloudflared tunnel list 2>/dev/null | awk -v n="$TUNNEL_NAME" '$2==n {print $1}')"
cloudflared tunnel route dns --overwrite-dns "$TUNNEL_NAME" "$HOSTNAME_PUBLIC" >/dev/null
CONFIG="$HOME/.cloudflared/$TUNNEL_NAME.yml"
cat > "$CONFIG" <<YML
tunnel: $TUNNEL_ID
credentials-file: $HOME/.cloudflared/$TUNNEL_ID.json
ingress:
  - hostname: $HOSTNAME_PUBLIC
    service: http://127.0.0.1:$PORT
  - service: http_status:404
YML
echo "Live: https://$HOSTNAME_PUBLIC/health  ·  the site at https://vitalents.life now answers with the onboard model."
echo "Keep this window open. Ctrl+C stops the tunnel and the assistant."
cloudflared tunnel --config "$CONFIG" run "$TUNNEL_NAME"

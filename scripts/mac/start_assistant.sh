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
trap 'echo; echo "Stopped at line $LINENO (exit $?). Paste this output to the team." >&2' ERR

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
# The assistant needs Python 3.10+ (macOS ships 3.9 in /usr/bin and Command Line Tools).
py_ok() { "$1" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; }
PY=""
for c in python3.13 python3.12 python3.11 python3.10 /opt/homebrew/bin/python3 /usr/local/bin/python3 python3; do
  if command -v "$c" >/dev/null 2>&1 && py_ok "$(command -v "$c")"; then PY="$(command -v "$c")"; break; fi
done
if [[ -z "$PY" ]]; then
  need_brew; echo "Installing Python 3.12 with Homebrew…"; brew install python@3.12
  PY="$(brew --prefix python@3.12)/bin/python3.12"
fi
echo "Python: $PY ($("$PY" --version))"
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
# Rebuild the environment if it was made with an older Python (for example macOS's 3.9).
if [[ -x .venv/bin/python ]] && ! py_ok .venv/bin/python; then echo "Rebuilding ai/.venv with $PY"; rm -rf .venv; fi
[[ -d .venv ]] || "$PY" -m venv .venv
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
# Find the tunnel id by name (JSON, no grep -q, so pipefail cannot stop the script).
tunnel_id() {
  cloudflared tunnel list --output json 2>/dev/null | "$PY" -c '
import json, sys
name = sys.argv[1]
try:
    rows = json.load(sys.stdin) or []
except Exception:
    rows = []
def active(r):
    d = r.get("deleted_at") or ""
    return not d or d.startswith("0001-01-01")  # cloudflared uses the zero time for tunnels that are not deleted
print(next((r.get("id", "") for r in rows if r.get("name") == name and active(r)), ""))
' "$TUNNEL_NAME"
}
TUNNEL_ID="${VITA_TUNNEL_ID:-$(tunnel_id || true)}"
if [[ -z "$TUNNEL_ID" ]]; then
  echo "Creating tunnel $TUNNEL_NAME"
  cloudflared tunnel create "$TUNNEL_NAME"
  TUNNEL_ID="$(tunnel_id)"
fi
echo "Tunnel: $TUNNEL_NAME ($TUNNEL_ID)"
CRED="$HOME/.cloudflared/$TUNNEL_ID.json"
[[ -f "$CRED" ]] || { echo "Missing $CRED (tunnel credentials). Run: cloudflared tunnel token --cred-file $CRED $TUNNEL_NAME"; exit 1; }
# DNS: ask.vitalents.life -> $TUNNEL_ID.cfargotunnel.com is set in the vitalents.life zone.
# Set VITA_ROUTE_DNS=1 only if that record is missing AND your cloudflared login is for vitalents.life.
if [[ "${VITA_ROUTE_DNS:-0}" == "1" ]]; then cloudflared tunnel route dns --overwrite-dns "$TUNNEL_NAME" "$HOSTNAME_PUBLIC"; fi
# Stop an older copy of this tunnel left running from a previous start.
pkill -f "cloudflared tunnel --config $HOME/.cloudflared/$TUNNEL_NAME.yml" 2>/dev/null || true
CONFIG="$HOME/.cloudflared/$TUNNEL_NAME.yml"
cat > "$CONFIG" <<YML
tunnel: $TUNNEL_ID
credentials-file: $CRED
ingress:
  - hostname: $HOSTNAME_PUBLIC
    service: http://127.0.0.1:$PORT
  - service: http_status:404
YML
echo "Live: https://$HOSTNAME_PUBLIC/health  ·  vitalents.life now answers with the onboard model."
echo "Keep this window open. Ctrl+C stops the tunnel and the assistant."
cloudflared tunnel --config "$CONFIG" run "$TUNNEL_NAME"

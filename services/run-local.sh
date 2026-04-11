#!/usr/bin/env bash
# Run database (8002), license (8001), and LLM (8000) locally without Docker.
# Usage: from repo root or services/:  ./run-local.sh
# Requires: Python 3.10+, OpenAI key in services/llm-service/.env (see .env.example)
#
# Stop: Ctrl+C (kills all three).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

export DATABASE_SERVICE_URL="${DATABASE_SERVICE_URL:-http://127.0.0.1:8002}"
LOG_DIR="$ROOT/.local-service-logs"
mkdir -p "$LOG_DIR"

die() { echo "run-local: $*" >&2; exit 1; }

ensure_venv() {
  local dir="$1"
  [[ -d "$dir" ]] || die "missing directory: $dir"
  if [[ ! -x "$dir/venv/bin/python" ]]; then
    echo "Creating venv in $dir ..."
    (cd "$dir" && python3 -m venv venv && ./venv/bin/pip install -q -r requirements.txt)
  fi
}

ensure_venv "$ROOT/database-service"
ensure_venv "$ROOT/license-service"
ensure_venv "$ROOT/llm-service"

LLM_ENV="$ROOT/llm-service/.env"
if [[ ! -f "$LLM_ENV" ]]; then
  if [[ -f "$ROOT/llm-service/.env.example" ]]; then
    cp "$ROOT/llm-service/.env.example" "$LLM_ENV"
    echo "Created $LLM_ENV from .env.example — edit OPENAI_API_KEY before relying on the LLM."
  else
    die "Missing $LLM_ENV — create it with OPENAI_API_KEY (see llm-service/.env.example)."
  fi
fi

# LLM service reads OPENAI_* from llm-service/.env via app/config.py (cwd is llm-service).

PIDS=()
cleanup() {
  echo ""
  echo "Stopping services..."
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}
# INT/TERM only — not EXIT. Otherwise `wait` returns as soon as children exit (e.g. port
# already in use) and the EXIT trap looks like a spurious "Stopping services" while old
# processes on those ports still pass health checks.
trap 'cleanup; exit 0' INT TERM HUP

preflight_ports() {
  local busy=0
  for port in 8002 8001 8000; do
    if command -v lsof >/dev/null 2>&1; then
      if lsof -iTCP:"$port" -sTCP:LISTEN -P -n >/dev/null 2>&1; then
        echo "Warning: something is already listening on port $port — new services may fail to bind."
        busy=1
      fi
    fi
  done
  if [[ "$busy" -eq 1 ]]; then
    echo "Stop those processes (or use Docker/other ports), then run this script again."
    echo ""
  fi
}

preflight_ports

echo "Starting database-service on :8002 ..."
(
  cd "$ROOT/database-service"
  exec ./venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8002
) >"$LOG_DIR/database-service.log" 2>&1 &
PIDS+=($!)

sleep 1

echo "Starting license-service on :8001 ..."
(
  cd "$ROOT/license-service"
  exec env DATABASE_SERVICE_URL="$DATABASE_SERVICE_URL" ./venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8001
) >"$LOG_DIR/license-service.log" 2>&1 &
PIDS+=($!)

sleep 1

echo "Starting llm-service on :8000 ..."
(
  cd "$ROOT/llm-service"
  exec env DATABASE_SERVICE_URL="$DATABASE_SERVICE_URL" ./venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
) >"$LOG_DIR/llm-service.log" 2>&1 &
PIDS+=($!)

sleep 1

echo ""
echo "Services running:"
echo "  database  http://127.0.0.1:8002  (logs: $LOG_DIR/database-service.log)"
echo "  license   http://127.0.0.1:8001  (logs: $LOG_DIR/license-service.log)"
echo "  llm       http://127.0.0.1:8000  (logs: $LOG_DIR/llm-service.log)"
echo ""
echo "Health checks:"
curl -sf "http://127.0.0.1:8002/health" && echo "  database OK" || echo "  database: check log"
curl -sf "http://127.0.0.1:8001/health" && echo "  license OK" || echo "  license: check log"
curl -sf "http://127.0.0.1:8000/api/v1/health" && echo "  llm OK" || echo "  llm: check log (set OPENAI_API_KEY in llm-service/.env for API calls)"
echo ""
echo "Press Ctrl+C to stop."

# Block until interrupt — do not use bare `wait`; if all children exited (e.g. bind
# failure), `wait` returns immediately and would end the script.
while true; do
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo ""
      echo "A service process exited unexpectedly (pid $pid). Check logs under:"
      echo "  $LOG_DIR"
      cleanup
      exit 1
    fi
  done
  sleep 2
done

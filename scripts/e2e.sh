#!/usr/bin/env bash
#
# scripts/e2e.sh — one-command end-to-end run (Q6).
#
# Boots BOTH dev servers, waits for them to be ready, runs the Playwright
# core-loop suite, then tears the servers down (even on failure / Ctrl-C).
#
# The core-loop spec (frontend/e2e/core-loop.spec.ts) self-seeds via
# POST /api/v1/dev/seed-core-loop, which requires the backend to run with
# DEV_MODE=true. Vite proxies /api -> :8000, so everything walks one origin.
#
# Prereqs: Postgres + Redis up (docker compose up -d), backend venv active,
# frontend deps installed, Playwright browsers installed
# (cd frontend && npx playwright install chromium).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACK_PORT="${E2E_BACK_PORT:-8000}"
FRONT_PORT="${E2E_FRONT_PORT:-5173}"
PIDS=()

cleanup() {
  echo "› tearing down dev servers…"
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait_for() {  # wait_for <url> <name>
  local url="$1" name="$2" i
  for i in $(seq 1 60); do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo "  ✓ $name ready"
      return 0
    fi
    sleep 1
  done
  echo "  ✗ $name did not come up at $url within 60s" >&2
  return 1
}

echo "› starting backend (uvicorn, DEV_MODE=true) on :$BACK_PORT…"
( cd "$ROOT" && DEV_MODE=true uvicorn backend.main:app --host 127.0.0.1 --port "$BACK_PORT" ) &
PIDS+=("$!")

echo "› starting frontend (vite) on :$FRONT_PORT…"
( cd "$ROOT/frontend" && npm run dev -- --port "$FRONT_PORT" --strictPort ) &
PIDS+=("$!")

wait_for "http://127.0.0.1:$BACK_PORT/docs" "backend"
wait_for "http://127.0.0.1:$FRONT_PORT" "frontend"

echo "› running Playwright core-loop…"
( cd "$ROOT/frontend" && npx playwright test "$@" )
echo "✓ e2e complete"

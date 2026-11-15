#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================================"
echo "  Starting RiskLens // ZeroHour Risk Engine"
echo "  Backend API : http://localhost:8000"
echo "  Frontend UI : http://localhost:3000"
echo "========================================================"

# Start FastAPI Backend in background
cd "$ROOT_DIR/backend"
/home/paarth/.local/share/zerohour-venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

trap "kill $BACKEND_PID 2>/dev/null || true" EXIT

# Start Instant Next.js Frontend Server on port 3000
cd "$ROOT_DIR/frontend"
node serve.mjs

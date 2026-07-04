#!/usr/bin/env bash
# Rebuild and restart the VSP Phone V3 telephony worker on EC2.
# Run from repo root after API deploy (migrations apply on api container start):
#   bash deploy/deploy-v3-worker.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

BRANCH="${DEPLOY_BRANCH:-main}"

echo "==> VSP V3 worker deploy (${REPO_ROOT})"
echo "==> Target branch: ${BRANCH}"

git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull origin "${BRANCH}"

export GIT_COMMIT="$(git rev-parse HEAD)"
echo "==> Building worker image with GIT_COMMIT=${GIT_COMMIT}"

# Ensure API (and migrations) are healthy before starting the worker.
docker compose up -d --build api

echo "==> Waiting for API /ready"
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3000/ready >/tmp/vsp-ready.json 2>/dev/null; then
    echo "==> API /ready OK"
    break
  fi
  sleep 2
  if [[ "$i" -eq 30 ]]; then
    echo "ERROR: API did not become ready"
    docker compose logs api --tail=80
    exit 1
  fi
done

docker compose up -d --build telephony-v3-worker

echo "==> Waiting for V3 worker heartbeat (/ready/v3)"
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3000/ready/v3 >/tmp/vsp-ready-v3.json 2>/dev/null; then
    ACTIVE="$(node -e "const s=require('/tmp/vsp-ready-v3.json'); process.stdout.write(String(s.workers?.activeCount ?? 0))")"
    if [[ "${ACTIVE}" -gt 0 ]]; then
      echo "==> /ready/v3 OK — active workers: ${ACTIVE}"
      cat /tmp/vsp-ready-v3.json
      break
    fi
  fi
  sleep 2
  if [[ "$i" -eq 30 ]]; then
    echo "ERROR: V3 worker heartbeat not visible in /ready/v3"
    docker compose logs telephony-v3-worker --tail=80
    curl -s http://127.0.0.1:3000/ready/v3 || true
    exit 1
  fi
done

echo ""
echo "==> Worker container health"
docker compose ps telephony-v3-worker

echo ""
echo "==> V3 worker deploy complete. See docs/vsp/deployment/16-telephony-v3-worker.md"

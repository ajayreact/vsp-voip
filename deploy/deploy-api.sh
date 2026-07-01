#!/usr/bin/env bash
# Rebuild and restart the VSP API Docker container on EC2.
# Run from repo root: bash deploy/deploy-api.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

REQUIRED_COMMIT="${REQUIRED_COMMIT:-527b0cafd7b6128cccaece554f72372326ae1726}"
# Optional: pin deploy to a specific increment (e.g. e09648c, 4ed4837, bfed5d6)
DEPLOY_COMMIT="${DEPLOY_COMMIT:-}"
BRANCH="${DEPLOY_BRANCH:-main}"

echo "==> VSP API deploy (${REPO_ROOT})"
echo "==> Target branch: ${BRANCH}"
echo "==> Minimum commit (bridge grace): ${REQUIRED_COMMIT}"

git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull origin "${BRANCH}"

if [[ -n "${DEPLOY_COMMIT}" ]]; then
  echo "==> Checking out deploy pin: ${DEPLOY_COMMIT}"
  git checkout "${DEPLOY_COMMIT}"
fi

CURRENT="$(git rev-parse HEAD)"
echo "==> Current HEAD: ${CURRENT} ($(git log -1 --format='%s'))"

if ! git merge-base --is-ancestor "${REQUIRED_COMMIT}" HEAD; then
  echo "ERROR: HEAD ${CURRENT} does not include required commit ${REQUIRED_COMMIT}"
  exit 1
fi

export GIT_COMMIT="${CURRENT}"
echo "==> Building API image with GIT_COMMIT=${GIT_COMMIT}"

docker compose up -d --build api

echo "==> Waiting for /ready"
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3000/ready >/tmp/vsp-ready.json 2>/dev/null; then
    echo "==> /ready OK"
    cat /tmp/vsp-ready.json
    break
  fi
  sleep 2
  if [[ "$i" -eq 30 ]]; then
    echo "ERROR: API did not become ready"
    docker compose logs api --tail=80
    exit 1
  fi
done

echo ""
echo "==> Checking /ready/v3"
HTTP_V3="$(curl -s -o /tmp/vsp-ready-v3.json -w '%{http_code}' http://127.0.0.1:3000/ready/v3)"
echo "GET /ready/v3 -> HTTP ${HTTP_V3}"
cat /tmp/vsp-ready-v3.json
echo ""

V3_ENABLED="$(node -e "
  const fs = require('fs');
  const body = JSON.parse(fs.readFileSync('/tmp/vsp-ready-v3.json', 'utf8'));
  const f = body.featureFlags || {};
  const enabled = Boolean(
    f.globalEnabled || f.ingressEnabled || f.callManagerEnabled || f.executorEnabled
  );
  process.stdout.write(enabled ? 'true' : 'false');
")"

ACTIVE_WORKERS="$(node -e "
  const fs = require('fs');
  const body = JSON.parse(fs.readFileSync('/tmp/vsp-ready-v3.json', 'utf8'));
  process.stdout.write(String(body.workers?.activeCount ?? 0));
")"

if [[ "${V3_ENABLED}" == "true" ]]; then
  if [[ "${ACTIVE_WORKERS}" -eq 0 ]]; then
    echo "ERROR: V3 is enabled but no worker heartbeat detected (activeCount=0)"
    echo "       Run: bash deploy/deploy-v3-worker.sh"
    docker compose logs telephony-v3-worker --tail=40 2>/dev/null || true
    exit 1
  fi
  echo "==> V3 worker heartbeat OK (activeCount=${ACTIVE_WORKERS})"
elif [[ "${HTTP_V3}" != "200" && "${HTTP_V3}" != "503" ]]; then
  echo "WARN: /ready/v3 returned unexpected HTTP ${HTTP_V3}"
fi

echo ""
echo "==> Verify call-accepted route (expect 401 without token)"
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -d '{}' \
  http://127.0.0.1:3000/api/softphone/call-accepted)"
echo "POST /api/softphone/call-accepted -> ${HTTP_CODE}"

if [[ "${HTTP_CODE}" == "404" ]]; then
  echo "ERROR: call-accepted still missing after deploy"
  exit 1
fi

if [[ "${HTTP_CODE}" != "401" ]]; then
  echo "WARN: expected 401 for unauthenticated probe, got ${HTTP_CODE}"
fi

echo ""
echo "==> Verify DID sync route (expect 401 without token)"
SYNC_CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  http://127.0.0.1:3000/api/admin/numbers/sync)"
echo "POST /api/admin/numbers/sync -> ${SYNC_CODE}"

if [[ "${SYNC_CODE}" == "404" ]]; then
  echo "ERROR: /api/admin/numbers/sync missing — rebuild did not pick up routes/admin.js"
  docker compose logs api --tail=80
  exit 1
fi

if [[ "${SYNC_CODE}" != "401" ]]; then
  echo "WARN: expected 401 for unauthenticated sync probe, got ${SYNC_CODE}"
fi

echo ""
echo "==> Verify pending inbound caller route (expect 401 without token)"
PENDING_CODE="$(curl -s -o /dev/null -w '%{http_code}' \
  http://127.0.0.1:3000/api/softphone/pending-inbound-caller)"
echo "GET /api/softphone/pending-inbound-caller -> ${PENDING_CODE}"

if [[ "${PENDING_CODE}" == "404" ]]; then
  echo "WARN: pending-inbound-caller missing (deploy D3 / bfed5d6+ for inbound caller ID fix)"
elif [[ "${PENDING_CODE}" != "401" ]]; then
  echo "WARN: expected 401 for unauthenticated pending-caller probe, got ${PENDING_CODE}"
fi

echo ""
echo "==> Deploy complete. See docs/vsp/phase3/10-production-deploy-increments.md"
if [[ "${V3_ENABLED}" == "true" ]]; then
  echo "==> V3 enabled — worker verified via /ready/v3"
else
  echo "==> When V3 is enabled, set TELEPHONY_V3_* in .env and run: bash deploy/deploy-v3-worker.sh"
fi

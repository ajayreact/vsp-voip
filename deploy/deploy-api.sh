#!/usr/bin/env bash
# Rebuild and restart the VSP API Docker container on EC2.
# Run from repo root: bash deploy/deploy-api.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

REQUIRED_COMMIT="${REQUIRED_COMMIT:-527b0caafd7b6128cccaece554f72372326ae1726}"
BRANCH="${DEPLOY_BRANCH:-main}"

echo "==> VSP API deploy (${REPO_ROOT})"
echo "==> Target branch: ${BRANCH}"
echo "==> Minimum commit (bridge grace): ${REQUIRED_COMMIT}"

git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull origin "${BRANCH}"

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
echo "==> Deploy complete. Run from your workstation:"
echo "    API_URL=https://api.vspphone.com node scripts/diagnose-did-sync.js"
echo "    API_URL=https://api.vspphone.com EMAIL=... PASSWORD=... node scripts/diagnose-did-sync.js"

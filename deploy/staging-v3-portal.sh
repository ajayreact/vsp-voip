#!/usr/bin/env bash
# Tenant portal deploy on EC2 — V3 is the only supported portal (V2 retired).
# Usage:
#   cd /opt/vsp-voip
#   bash deploy/staging-v3-portal.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

export DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
export DEPLOY_COMMIT="${DEPLOY_COMMIT:-}"

echo "==> Tenant portal deploy (V3)"
echo "==> Branch: ${DEPLOY_BRANCH}"
echo "==> Commit pin: ${DEPLOY_COMMIT:-<latest on branch>}"

set_env_flag() {
  local key="$1"
  local value="$2"
  local file="${REPO_ROOT}/.env"
  if grep -q "^${key}=" "${file}" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${file}"
  else
    echo "${key}=${value}" >> "${file}"
  fi
}

echo "==> Setting optional test-lab flag in .env"
set_env_flag V3_TEST_LAB_ENABLED true
set_env_flag V3_RUNTIME_SYNC_ENABLED false

echo "==> Deploy API (includes prisma migrate deploy via docker entrypoint)"
bash deploy/deploy-api.sh

echo "==> Deploy Web"
bash deploy/deploy-web.sh

echo ""
echo "==> Post-deploy verification"
curl -sf http://127.0.0.1:3000/health | head -c 200; echo
curl -sf http://127.0.0.1:3000/ready | head -c 400; echo
curl -s -o /dev/null -w "GET /api/v3/test-lab/status (no auth) -> %{http_code}\n" http://127.0.0.1:3000/api/v3/test-lab/status || true
curl -sI http://127.0.0.1:3001/dashboard | head -3
docker compose exec -T postgres psql -U vsp -d vsp_voip -c "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;" 2>/dev/null || true
docker compose logs api --tail=30

echo ""
echo "==> Portal deploy complete"
echo "    Git: $(git rev-parse HEAD)"
echo "    Verify externally: https://api.vspphone.com/ready and https://app.vspphone.com/dashboard"

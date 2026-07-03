#!/usr/bin/env bash
# Enable V3 runtime sync for Test Lab tenant only — run on EC2 from /opt/vsp-voip
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

TENANT_ID="${1:-1dc390cf-3dcf-4123-8373-1557adbdca84}"
export DEPLOY_BRANCH="${DEPLOY_BRANCH:-backup/pre-v3-staging}"

echo "==> Pull latest ${DEPLOY_BRANCH}"
git fetch origin "${DEPLOY_BRANCH}"
git checkout "${DEPLOY_BRANCH}"
git pull origin "${DEPLOY_BRANCH}"

set_env_flag() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    echo "${key}=${value}" >> .env
  fi
}

echo "==> Dashboard race fix + runtime sync canary for tenant ${TENANT_ID}"
set_env_flag V3_RUNTIME_SYNC_ENABLED true
set_env_flag "V3_RUNTIME_SYNC_TENANT_ALLOWLIST" "${TENANT_ID}"
set_env_flag V3_TEST_LAB_ALLOW_PRODUCTION false

export DEPLOY_BRANCH
bash deploy/deploy-api.sh

echo ""
echo "==> Verify runtime sync flags in container"
docker compose exec api printenv | grep -E 'V3_RUNTIME_SYNC|GIT_COMMIT' || true

echo ""
echo "==> Done. Run runtime validation via API or /v3/runtime UI."

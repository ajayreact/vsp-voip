#!/usr/bin/env bash
#
# Post-deploy healthcheck for the VSP Phone V3 Multi-Provider Telephony
# Architecture (Telnyx + Twilio). Read-only — makes no writes, activates no
# provider, and never modifies tenant/provider configuration.
#
# Verifies:
#   1. API online                        (GET /health)
#   2. Database connection               (GET /ready -> database.connected)
#   3. Prisma migration status           (npx prisma migrate status, if run with repo access)
#   4. ProviderManager initialized       (GET /ready -> providers.managerInitialized)
#   5. ProviderResolver initialized      (GET /ready -> providers.resolverInitialized)
#   6. Telnyx provider loaded + active   (GET /ready -> providers.providers[])
#   7. Twilio provider available         (GET /ready -> providers.registeredKeys)
#   8. Super Admin Provider API reachable (GET /api/admin/providers -> expect 401, not 404)
#
# Usage:
#   bash scripts/post-deploy-healthcheck.sh
#     Run on the EC2 host after deploy-api.sh — checks localhost:3000 and, if
#     the repo is present, also verifies Prisma migration status directly.
#
#   API_URL=https://api.vspphone.com bash scripts/post-deploy-healthcheck.sh
#     Run remotely (e.g. from a workstation) — skips the local Prisma check.
#
# Exit code: 0 if no FAILs (WARNs are non-fatal), 1 if any FAIL.

set -uo pipefail

API_URL="${API_URL:-http://127.0.0.1:3000}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

pass() { echo "  [PASS] $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
warn() { echo "  [WARN] $1"; WARN_COUNT=$((WARN_COUNT + 1)); }
fail() { echo "  [FAIL] $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

json_get() {
  # Usage: json_get '<json>' '<jsExpression using obj>'
  node -e "
    try {
      const obj = JSON.parse(process.argv[1]);
      const val = (function(obj){ return (${2}); })(obj);
      process.stdout.write(val === undefined ? '' : String(val));
    } catch (e) { process.stdout.write(''); }
  " "$1" 2>/dev/null
}

echo "=== VSP Phone V3 — Post-Deploy Healthcheck (Multi-Provider Telephony) ==="
echo "API_URL=${API_URL}"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# ---------------------------------------------------------------------------
echo "-- 1. API online --"
HEALTH_JSON="$(curl -sf --max-time 10 "${API_URL}/health" 2>/dev/null || true)"
if [[ -n "${HEALTH_JSON}" ]]; then
  pass "GET /health reachable: ${HEALTH_JSON}"
else
  fail "GET /health unreachable — API is not responding"
fi
echo ""

# ---------------------------------------------------------------------------
echo "-- 2-7. Readiness: database, providers --"
READY_JSON="$(curl -sf --max-time 10 "${API_URL}/ready" 2>/dev/null || true)"

if [[ -z "${READY_JSON}" ]]; then
  fail "GET /ready unreachable — cannot verify database/provider status"
else
  READY="$(json_get "${READY_JSON}" 'obj.ready')"
  DB_CONNECTED="$(json_get "${READY_JSON}" 'obj.database?.connected')"
  TELNYX_KEY_CONFIGURED="$(json_get "${READY_JSON}" 'obj.telnyx?.apiKeyConfigured')"
  MGR_INIT="$(json_get "${READY_JSON}" 'obj.providers?.managerInitialized')"
  RESOLVER_INIT="$(json_get "${READY_JSON}" 'obj.providers?.resolverInitialized')"
  REGISTERED_KEYS="$(json_get "${READY_JSON}" '(obj.providers?.registeredKeys || []).join(",")')"
  DEFAULT_KEY="$(json_get "${READY_JSON}" 'obj.providers?.defaultProviderKey')"
  TELNYX_ACTIVE="$(json_get "${READY_JSON}" '(obj.providers?.providers || []).find(p => p.key === "telnyx")?.isActive')"
  TWILIO_PRESENT="$(json_get "${READY_JSON}" '(obj.providers?.providers || []).some(p => p.key === "twilio")')"
  GIT_COMMIT="$(json_get "${READY_JSON}" 'obj.build?.gitCommit')"

  if [[ "${DB_CONNECTED}" == "true" ]]; then
    pass "Database connected"
  else
    fail "Database NOT connected (database.connected=${DB_CONNECTED:-unknown})"
  fi

  if [[ "${TELNYX_KEY_CONFIGURED}" == "true" ]]; then
    pass "Telnyx API key configured (existing production requirement, unaffected by this feature)"
  else
    fail "Telnyx API key NOT configured — /ready should be reporting ready:false"
  fi

  if [[ "${MGR_INIT}" == "true" ]]; then
    pass "ProviderManager initialized"
  else
    warn "ProviderManager did not report initialized (providers.managerInitialized=${MGR_INIT:-unknown})"
  fi

  if [[ "${RESOLVER_INIT}" == "true" ]]; then
    pass "ProviderResolver initialized"
  else
    warn "ProviderResolver did not report initialized (providers.resolverInitialized=${RESOLVER_INIT:-unknown})"
  fi

  if [[ "${REGISTERED_KEYS}" == *"telnyx"* ]]; then
    pass "Telnyx provider registered in ProviderFactory"
  else
    fail "Telnyx provider NOT registered (registeredKeys=${REGISTERED_KEYS:-none})"
  fi

  if [[ "${TELNYX_ACTIVE}" == "true" ]]; then
    pass "Telnyx Provider row is active (default routing target confirmed)"
  else
    warn "Telnyx Provider row not found or not active yet — run: node scripts/seed-provider-tables.js"
  fi

  if [[ "${DEFAULT_KEY}" == "telnyx" ]]; then
    pass "ProviderResolver default-provider key is 'telnyx'"
  else
    fail "ProviderResolver DEFAULT_PROVIDER_KEY is NOT 'telnyx' (got '${DEFAULT_KEY:-unknown}') — production fallback safety net changed!"
  fi

  if [[ "${REGISTERED_KEYS}" == *"twilio"* ]]; then
    pass "Twilio provider available in ProviderFactory (registered, not required to be active)"
  else
    warn "Twilio provider not registered in ProviderFactory (registeredKeys=${REGISTERED_KEYS:-none})"
  fi

  if [[ "${TWILIO_PRESENT}" == "true" ]]; then
    pass "Twilio Provider row exists in DB (Super Admin -> Providers has discovered it)"
  else
    warn "Twilio Provider row not yet created — visit Super Admin -> Providers once, or it is created lazily on first admin API call"
  fi

  if [[ "${READY}" == "true" ]]; then
    pass "Overall /ready = true"
  else
    fail "Overall /ready = false — see database/redis/telnyx/smtp fields above"
  fi

  echo "  Deployed commit (build.gitCommit): ${GIT_COMMIT:-unknown}"
fi
echo ""

# ---------------------------------------------------------------------------
echo "-- 3. Prisma migration status --"
if [[ -f "${REPO_ROOT}/prisma/schema.prisma" ]] && command -v npx >/dev/null 2>&1; then
  MIGRATE_OUTPUT="$(cd "${REPO_ROOT}" && npx prisma migrate status 2>&1 || true)"
  if echo "${MIGRATE_OUTPUT}" | grep -qi "database schema is up to date"; then
    pass "Prisma migrations up to date"
  elif echo "${MIGRATE_OUTPUT}" | grep -qi "following migration.*not yet been applied\|have not yet been applied"; then
    fail "Pending Prisma migrations detected — run: docker compose exec api npx prisma migrate deploy"
    echo "${MIGRATE_OUTPUT}" | tail -20
  else
    warn "Could not determine Prisma migration status (no DB access from this shell, or unexpected output)"
  fi
else
  warn "Skipped — repo/Prisma CLI not available from this shell (expected when run remotely via API_URL)"
fi
echo ""

# ---------------------------------------------------------------------------
echo "-- 8. Super Admin Provider API reachable --"
PROVIDERS_CODE="$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' "${API_URL}/api/admin/providers" 2>/dev/null || echo '000')"
echo "  GET /api/admin/providers -> HTTP ${PROVIDERS_CODE}"
if [[ "${PROVIDERS_CODE}" == "401" ]]; then
  pass "Super Admin Provider API mounted and permission-protected (401 without token)"
elif [[ "${PROVIDERS_CODE}" == "404" ]]; then
  fail "Super Admin Provider API route missing (404) — API build did not pick up routes/adminProviders.js"
else
  warn "Unexpected status ${PROVIDERS_CODE} for unauthenticated probe (expected 401)"
fi
echo ""

# ---------------------------------------------------------------------------
echo "=== Summary ==="
echo "  PASS: ${PASS_COUNT}   WARN: ${WARN_COUNT}   FAIL: ${FAIL_COUNT}"
echo ""

if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  echo "RESULT: FAIL — do not consider this deploy healthy until FAILs are resolved."
  exit 1
elif [[ "${WARN_COUNT}" -gt 0 ]]; then
  echo "RESULT: PASS WITH WARNINGS — review warnings above."
  exit 0
else
  echo "RESULT: PASS — deploy looks healthy."
  exit 0
fi

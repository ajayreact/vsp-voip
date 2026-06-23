#!/usr/bin/env bash
# Deploy the static landing page for https://vspphone.com
# Run on EC2: sudo bash deploy/setup-landing.sh

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/vsp-voip}"
LANDING_DIR="${REPO_ROOT}/landing"
NGINX_USER="${NGINX_USER:-www-data}"

if [[ ! -f "${LANDING_DIR}/index.html" ]]; then
  echo "ERROR: ${LANDING_DIR}/index.html not found."
  echo "Run: cd ${REPO_ROOT} && git pull"
  exit 1
fi

echo "Landing files:"
ls -la "${LANDING_DIR}"

# nginx must traverse repo path and read landing/
chmod o+x "${REPO_ROOT}" 2>/dev/null || true
chmod -R a+rX "${LANDING_DIR}"
chown -R "${NGINX_USER}:${NGINX_USER}" "${LANDING_DIR}"

echo "Permissions after fix:"
ls -la "${LANDING_DIR}"

if command -v nginx >/dev/null 2>&1; then
  nginx -t
  systemctl reload nginx
  echo "Nginx reloaded."
fi

echo "Done. Test: curl -sI https://vspphone.com/ | head -5"

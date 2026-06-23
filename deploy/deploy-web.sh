#!/usr/bin/env bash
# Clean install + build + restart for Next.js web portal on EC2.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="${REPO_ROOT}/web"
MIN_NODE_MAJOR=18

echo "==> VSP web deploy (${WEB_DIR})"

node_major="$(node -p "process.versions.node.split('.')[0]")"
if (( node_major < MIN_NODE_MAJOR )); then
  echo "ERROR: Node $(node -v) is too old. Next.js 16 requires Node ${MIN_NODE_MAJOR}.18+."
  echo "Install Node 20: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  exit 1
fi

echo "Node $(node -v) | npm $(npm -v)"

cd "${REPO_ROOT}"
echo "==> git pull"
git pull origin main

cd "${WEB_DIR}"

expected_next="$(node -p "require('./package.json').dependencies.next")"
echo "==> package.json next: ${expected_next}"

echo "==> stop PM2 (avoid crash loop while node_modules is missing)"
pm2 stop vsp-web 2>/dev/null || true

echo "==> clean node_modules and .next"
rm -rf node_modules .next

echo "==> npm ci"
if ! npm ci; then
  echo "WARN: npm ci failed — retrying with --legacy-peer-deps"
  npm ci --legacy-peer-deps
fi

installed_next="$(node -p "require('./node_modules/next/package.json').version")"
echo "==> installed next: ${installed_next}"
if [[ "${installed_next}" != "${expected_next}" ]]; then
  echo "ERROR: Expected next@${expected_next} but got next@${installed_next}."
  echo "Check that web/package-lock.json is committed and git pull succeeded."
  exit 1
fi

if [[ ! -x "${WEB_DIR}/node_modules/.bin/next" ]]; then
  echo "ERROR: node_modules/.bin/next is missing after npm ci."
  exit 1
fi

export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://api.vspphone.com}"
echo "==> npm run build (NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL})"
npm run build

if [[ ! -f "${WEB_DIR}/.next/BUILD_ID" ]]; then
  echo "ERROR: Build did not produce .next/BUILD_ID"
  exit 1
fi

echo "==> pm2 restart vsp-web"
cd "${REPO_ROOT}"
if pm2 describe vsp-web >/dev/null 2>&1; then
  pm2 restart vsp-web
else
  pm2 start deploy/pm2.ecosystem.config.js
fi

pm2 save
echo "==> deploy complete"
pm2 status vsp-web

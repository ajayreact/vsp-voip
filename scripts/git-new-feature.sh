#!/usr/bin/env bash
# Create a feature branch from development (or development/v2 during transition).
# Usage: bash scripts/git-new-feature.sh warm-transfer
#   → creates feature/warm-transfer
set -euo pipefail

FEATURE="${1:?Usage: git-new-feature.sh <feature-name> (e.g. warm-transfer)}"
BRANCH="feature/${FEATURE}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${REPO_ROOT}"
git fetch origin

BASE="development"
if ! git show-ref --verify --quiet "refs/heads/${BASE}" && \
   ! git show-ref --verify --quiet "refs/remotes/origin/${BASE}"; then
  if git show-ref --verify --quiet "refs/heads/development/v2" || \
     git show-ref --verify --quiet "refs/remotes/origin/development/v2"; then
    BASE="development/v2"
    echo "WARN: using ${BASE} — rename to development when ready (see docs/vsp/git/01-branch-strategy.md)"
  else
    echo "ERROR: neither development nor development/v2 found. Create development first."
    exit 1
  fi
fi

if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "ERROR: branch ${BRANCH} already exists locally"
  exit 1
fi

git checkout "${BASE}"
git pull "origin" "${BASE}" 2>/dev/null || git pull origin "${BASE}" || true
git checkout -b "${BRANCH}"
echo "==> Created ${BRANCH} from ${BASE}"
echo "    Push: git push -u origin ${BRANCH}"

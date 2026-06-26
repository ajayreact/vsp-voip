#!/usr/bin/env bash
# Run standard validators before merging a feature branch.
# Usage: bash scripts/git-pre-merge-check.sh [--telephony]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

TELEPHONY=false
if [[ "${1:-}" == "--telephony" ]]; then
  TELEPHONY=true
fi

echo "==> VSP pre-merge validation"
echo "    Branch: $(git branch --show-current)"
echo "    HEAD:   $(git log -1 --oneline)"

STABLE_TAG=""
if git rev-parse v1.0-telephony-stable >/dev/null 2>&1; then
  STABLE_TAG="v1.0-telephony-stable"
elif git rev-parse v1.0.0 >/dev/null 2>&1; then
  STABLE_TAG="v1.0.0"
fi

if [[ -n "${STABLE_TAG}" ]]; then
  echo "==> Compare telephony diff against ${STABLE_TAG}:"
  git diff "${STABLE_TAG}..HEAD" --stat -- \
    lib/inboundCallControl.js \
    lib/telnyxCallControl.js \
    lib/callControlSessionStore.js \
    web/src/lib/webrtc-audio.ts \
    web/src/lib/telnyx-softphone-session.ts \
    web/src/app/\(app\)/softphone-v2/page.tsx 2>/dev/null || true
fi

echo ""
echo "==> npm run validate:p0"
npm run validate:p0

if [[ "${TELEPHONY}" == true ]]; then
  echo ""
  echo "==> Telephony validators"
  npm run validate:blind-transfer
  npm run validate:call-transfer-session
  npm run validate:rapid-accept-stress
  npm run validate:extension-did
fi

echo ""
echo "==> Docs validators"
npm run validate:git-docs
npm run validate:pbx-docs
npm run validate:deployment-docs

echo ""
echo "==> Pre-merge check complete. Review docs/vsp/git/05-merge-checklist.md before merging."

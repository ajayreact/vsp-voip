# QA & Automated Regression

Pre/post deploy automated validation for VSP Phone.

---

## Quick start

```bash
# Install test dependencies (once)
npm install

# Standard QA gate (API + regression + report)
npm run qa

# Full telephony (protected file changes)
npm run qa:full

# Pre-production release checklist
npm run release:checklist

# Post-deploy smoke (health + critical routes)
npm run smoke:deploy

# Against production API
API_BASE=https://api.vspphone.com QA_EMAIL=... QA_PASSWORD=... npm run smoke:deploy
```

Reports: `reports/qa-report-latest.html`

---

## Structure

```
tests/
  telephony/          # Domain telephony tests (*.test.ts)
  api/                # REST API integration tests
  mobile/             # React Native component tests
  regression/         # Deploy gate suite
  browser/            # Playwright UI tests
  performance/        # k6 load scripts (health + messaging)
  lib/                # Shared clients, endpoint registry, HTML report
docs/qa/
  release-checklist.md
  production-monitoring.md
scripts/
  smoke-deploy.js
  run-release-checklist.js
  run-qa-suite.js
.github/workflows/
  qa-automation.yml   # Full CI QA pipeline
```

---

## Test commands

| Command | Purpose |
|---------|---------|
| `npm test` | Full Vitest suite |
| `npm run test:api` | API integration tests only |
| `npm run test:mobile` | React Native component tests |
| `npm run test:browser` | Playwright (requires `QA_BROWSER_TESTS=true`) |
| `npm run smoke:deploy` | Post-deploy smoke validation |
| `npm run release:checklist` | Pre-production automated checklist |
| `npm run qa:perf:messaging` | k6 messaging load test |
| `npm run qa:perf:messaging-smoke` | k6 messaging smoke (CI-friendly) |

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `API_BASE` | API under test (default `http://localhost:3000`) |
| `WEB_BASE` | Next.js portal (default `http://localhost:3001`) |
| `QA_EMAIL` / `QA_PASSWORD` | Test tenant credentials |
| `QA_LIVE_CALLS` | Enable live PSTN call tests |
| `QA_LIVE_WEBRTC` | Enable RTP verification tests |
| `QA_BROWSER_TESTS` | Enable Playwright suite in `npm run qa` |
| `SMOKE_CHECK_WEB` | Include web portal in `smoke:deploy` |

---

## CI/CD

- **`ci.yml`** — API health + smoke on every PR/push
- **`qa.yml`** — Vitest + smoke on PRs to main/development
- **`qa-automation.yml`** — Full pipeline: framework validation, API tests, web build, mobile typecheck, optional Playwright/k6

---

## Related

- [VALIDATION.md](./VALIDATION.md)
- [release-checklist.md](../docs/qa/release-checklist.md)
- [production-monitoring.md](../docs/qa/production-monitoring.md)
- [.cursor/rules/qa-first.mdc](../.cursor/rules/qa-first.mdc)

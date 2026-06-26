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

# Against production API
API_BASE=https://api.vspphone.com QA_EMAIL=... QA_PASSWORD=... npm run qa
```

Reports: `reports/qa-report-latest.html`

---

## Structure

```
tests/
  telephony/          # Domain telephony tests (*.test.ts)
  api/                # REST API tests
  regression/         # Deploy gate suite
  browser/            # Playwright UI tests
  performance/        # k6 load scripts
  lib/                # Shared clients + HTML report
  VALIDATION.md
  README.md
reports/              # HTML + JSON output
scripts/run-qa-suite.js
```

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

---

## Related

- [VALIDATION.md](./VALIDATION.md)
- [../deployment/15-qa-regression.md](../deployment/15-qa-regression.md)
- [.cursor/rules/qa-first.mdc](../../.cursor/rules/qa-first.mdc)

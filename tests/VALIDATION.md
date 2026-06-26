# QA Framework — Validation Report

Automated checks: `npm run validate:tests-framework`

---

## Test discovery

| Category | Location | Count |
|----------|----------|-------|
| Telephony | `tests/telephony/*.test.ts` | 15 files |
| API | `tests/api/*.test.ts` | 4 files |
| Regression | `tests/regression/deploy-regression.test.ts` | 1 suite |
| Browser | `tests/browser/softphone.spec.ts` | Playwright |
| Performance | `tests/performance/k6-*.js` | 4 scripts |

Runner: `vitest.config.ts` includes `tests/**/*.test.ts`

---

## Coverage map

| Area | Automated | Live/manual |
|------|-----------|-------------|
| Registration | API token + Playwright login | Telnyx register state |
| Inbound | call-accepted probe | `QA_LIVE_CALLS` |
| Outbound | token + config | `QA_LIVE_CALLS` |
| Two-way audio | diagnostics route | `QA_LIVE_WEBRTC` |
| Recording | API list + record-start | Playback manual |
| Voicemail | API list | Leave VM manual |
| Blind transfer | API route + validate script | Live transfer manual |
| DID | sync route + diagnose script | Admin sync manual |
| Tenant isolation | JWT tenantId | Cross-tenant probes |
| Extension routing | extensions API | Dial extension manual |
| Conference | todo tests | v1.4 |
| Warm transfer | todo tests | v1.3 |
| Queue | todo tests | v1.5 |
| IVR | greeting API + todo | Multi-level v1.6 |

---

## Regression suite completeness

`tests/regression/deploy-regression.test.ts` verifies:

- ✓ Registration
- ✓ Inbound
- ✓ Outbound
- ✓ Two-way audio (web diagnostics route)
- ✓ Recording
- ✓ Voicemail
- ✓ Blind transfer
- ✓ DID routing
- ✓ Tenant isolation
- ✓ Extension routing
- ✓ API `/ready`

---

## Reporting

| Output | Path |
|--------|------|
| HTML report | `reports/qa-report-latest.html` |
| JSON report | `reports/qa-report-latest.json` |
| Vitest JSON | `reports/vitest-results.json` |
| Playwright HTML | `reports/playwright-html/` |
| Playwright JSON | `reports/playwright-results.json` |
| Screenshots | `reports/playwright/` (on failure) |

Generator: `tests/lib/report-html.js` via `scripts/run-qa-suite.js`

Fields: Pass, Fail, Skip, Duration, Detail, Screenshot links

---

## Browser tests (Playwright)

`tests/browser/softphone.spec.ts` covers:

- Login
- Softphone / registration navigation
- Dial pad
- Call history, voicemail, recordings, settings
- WebRTC diagnostics route
- Answer/reject/mute/hold/transfer — skipped unless `QA_LIVE_CALLS`

Enable: `QA_BROWSER_TESTS=true`

---

## API tests

| Suite | Endpoints |
|-------|-----------|
| `authentication.test.ts` | login, me |
| `softphone-api.test.ts` | config, token, call-accepted, devices |
| `did-api.test.ts` | numbers/sync, numbers |
| `transfer-recording-voicemail.test.ts` | blind transfer, recordings, voicemails |

---

## Performance tests

| Script | Target VUs |
|--------|------------|
| `k6-100-users.js` | 100 |
| `k6-500-users.js` | 500 |
| `k6-1000-users.js` | 1000 |
| `k6-5000-users.js` | 5000 |

---

## Deployment integration

Documented in [../deployment/15-qa-regression.md](../deployment/15-qa-regression.md):

1. Run QA
2. Generate report
3. Deploy only if tests pass

---

## Cursor rule

[.cursor/rules/qa-first.mdc](../../.cursor/rules/qa-first.mdc)

---

## Application code

**No production telephony logic was modified.**

Created test infrastructure only under `tests/`, `scripts/run-qa-suite.js`, `reports/`, devDependencies in `package.json`.

---

## Commands

```bash
npm run validate:tests-framework
npm run test:telephony
npm run qa
npm run qa:full
```

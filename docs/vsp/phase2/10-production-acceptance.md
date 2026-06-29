# Phase 2 — Production Acceptance Testing (PAT)

**Status:** **Accepted**  
**Date:** June 2026  
**Release tag:** [`phase2-production-ready`](../../git/04-tagging.md) → commit `1c1fb1d`

---

## Outcome

Phase 2 Production Acceptance Testing passed on production (`api.vspphone.com`, `app.vspphone.com`). The PBX backend and tenant administration portal are **feature-complete** and **frozen**.

| Area | Result |
|------|--------|
| Tenant administration portal | Pass |
| PBX configuration (extensions, DIDs, devices, ring groups) | Pass |
| Call Control / Telnyx telephony | Pass |
| QR provisioning (admin → mobile) | Pass |
| Multi-tenant isolation | Pass |
| Reset PBX Configuration (Danger Zone) | Pass |

---

## Release baseline

| Item | Value |
|------|-------|
| Tag | `phase2-production-ready` |
| Commit | `1c1fb1d` — `fix(validate): define pass helper in pbx production validation script` |
| Rollback tag | `phase2-reset-pbx-stable` → `107e027` |
| Prior telephony tag | `phase2-production-ready` (superseded at `bfed5d6`) |

Deploy from `main` at or after `1c1fb1d`. Use the tag for rollback reference only — do not force-push tags on `main`.

---

## Post-PAT rules

1. **Backend feature freeze** — see [06-backend-telephony-freeze.md](./06-backend-telephony-freeze.md).
2. **No new PBX features** without a new approved phase.
3. **Phase 4** — React Native mobile only (`mobile-rn/`). Backend changes allowed **only** for bugs found during mobile development.
4. **Web portal** — administration and bug fixes only; no new telephony or PBX capabilities.

---

## Verification commands (regression gate)

```bash
npm run test:telephony
npm run test:mobile
cd web && npm run build
```

---

## Related docs

- [Phase 2 overview](./README.md)
- [Phase 4 — Mobile application](../phase4/README.md)
- [Phase 3 production readiness](../phase3/README.md)

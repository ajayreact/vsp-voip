# Phase 4 — Backend Freeze Rules

The backend reached production acceptance at tag **`phase2-production-ready`**. Phase 4 is a **mobile-only** delivery phase.

---

## Frozen — do not modify

| Domain | Primary paths |
|--------|---------------|
| **Call Control** | `lib/inboundCallControl.js`, `lib/callSession*.js`, `lib/callFsm.js`, `lib/telnyxCallControl.js` |
| **Telnyx integration** | Webhook handlers, `lib/telnyxWebhookDedup.js`, Telnyx API clients |
| **SIP architecture** | `lib/employeeTelephony.js`, `lib/softphone.js`, `lib/extensionSip.js` |
| **Database schema** | `prisma/schema.prisma`, migrations (no new models or columns) |
| **Extension routing** | `lib/internalExtensionDial.js`, `resolveExtensionRingTargets`, `lib/inboundRouting.js` |
| **QR provisioning** | `lib/extensionProvisioning.js`, `lib/employeeProvisioningProfile.js`, `POST /api/mobile/provision` |
| **Authentication** | JWT issuance, refresh, password flows, role middleware |
| **Multi-tenant architecture** | Tenant scoping, `lib/pbxOwnership.js`, DID isolation |

---

## Allowed backend changes

| Change type | Requirement |
|-------------|-------------|
| **Production bug fix** | Repro on mobile or API; regression test; minimal diff |
| **Documentation** | Always allowed |
| **Deployment / ops** | Scripts, PM2, Nginx — no telephony logic changes |
| **Web portal bug fix** | UI-only or existing API usage; no new PBX features |

---

## Not allowed

- New PBX features (ring strategies, IVR changes, new provisioning flows)
- New REST endpoints for mobile convenience
- Schema migrations for mobile-only fields (use client storage instead)
- Call Control refactors or PSTN path changes
- Re-enabling browser WebRTC in production

---

## Bug reports from mobile (not fixes)

Mobile developers **do not** patch the backend. If mobile work exposes a server defect:

1. Stop implementation that depends on the bug.
2. File a report with reproduction steps and affected route.
3. Continue mobile work only on areas not blocked by the defect.

Backend fixes (when approved) follow the workflow below.

## Backend bug-fix workflow (approved fixes only)

1. Bug reported from mobile with reproduction steps.
2. Confirm root cause is backend (not client).
3. Implement minimal fix with regression test in `tests/`.
4. Run `npm run test:telephony` and `npm run test:mobile`.
5. Deploy API only if fix is server-side.

---

## Related docs

- [Phase 4 mobile development rules](./03-mobile-development-rules.md)
- [Phase 2 backend freeze](../phase2/06-backend-telephony-freeze.md)
- [Protected telephony components](../../../.cursor/rules/protected-telephony-components.mdc)
- [Phase 4 overview](./README.md)

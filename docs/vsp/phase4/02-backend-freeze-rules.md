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

## Bug-fix workflow

1. File issue with reproduction steps from `mobile-rn/`.
2. Confirm root cause is backend (not client).
3. Implement minimal fix with test in `tests/`.
4. Run `npm run test:telephony` and `npm run test:mobile`.
5. Deploy API only if fix is server-side; tag is not required for hotfixes.

---

## Related docs

- [Phase 2 backend freeze](../phase2/06-backend-telephony-freeze.md)
- [Protected telephony components](../../../.cursor/rules/protected-telephony-components.mdc)
- [Phase 4 overview](./README.md)

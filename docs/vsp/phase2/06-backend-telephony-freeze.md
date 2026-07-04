# Phase 2 — Backend Production Freeze

**Status:** **Frozen** — Phase 2 PAT accepted (June 2026).  
**Release tag:** `phase2-production-ready` (`1c1fb1d`)  
**Active development:** [Phase 4 mobile](../phase4/README.md) only.

---

## Frozen components

The following are **production baseline**. Do not modify unless fixing a confirmed production bug discovered during Phase 4 mobile work (or a critical production incident):

| Domain | Primary modules |
|--------|-----------------|
| **Call Control** | `lib/inboundCallControl.js`, `lib/callSession*.js`, `lib/callFsm.js`, `lib/telnyxCallControl.js` |
| **Telnyx integration** | Webhook ingress, `lib/telnyxWebhookDedup.js`, Telnyx REST clients |
| **PSTN routing** | `lib/inboundRouting.js`, `lib/pbxOwnership.js`, parked PSTN handlers |
| **Park / outbound bridge** | Parked PSTN passthrough, WebRTC outbound bridge |
| **QR provisioning** | `lib/extensionProvisioning.js`, `lib/employeeProvisioningProfile.js` |
| **SIP architecture** | `lib/employeeTelephony.js`, `lib/softphone.js`, `lib/extensionSip.js` |
| **Extension routing** | `lib/internalExtensionDial.js`, `resolveExtensionRingTargets` |
| **Authentication** | JWT, refresh tokens, login, role middleware |
| **Multi-tenant architecture** | Tenant scoping, DID isolation, cross-tenant guards |
| **Database schema** | `prisma/schema.prisma` — no new models or columns in Phase 4 |

Employee provisioning endpoints (`POST /api/mobile/provision`, token redeem) are frozen.

---

## Allowed changes after freeze

| Change | Notes |
|--------|-------|
| **Production bug fixes** | Regression test required; minimal diff |
| **Documentation** | Always allowed |
| **Web portal** | Administration UI and bug fixes; reuse existing APIs only |
| **Mobile (`mobile-rn/`)** | Primary Phase 4 work — no backend coupling unless bug fix |
| **Super Admin** | Platform tools unrelated to tenant call routing |
| **Deploy / ops scripts** | No telephony logic changes |

---

## Not allowed without new phase approval

- New PBX or telephony features
- New SIP credential models per extension
- Browser WebRTC re-enablement in production
- Call Control handler refactors
- PSTN path changes
- Duplicate provisioning APIs
- Database schema migrations (except critical bug fix with approval)

---

## Verification baseline

Before any backend hotfix:

```bash
npm run test:telephony
npm run test:mobile
```

All Phase 2 telephony and mobile tests must remain green.

---

## Related docs

- [Phase 2 PAT acceptance](./10-production-acceptance.md)
- [Phase 4 backend freeze rules](../phase4/02-backend-freeze-rules.md)
- [Protected telephony components](../../.cursor/rules/protected-telephony-components.mdc)

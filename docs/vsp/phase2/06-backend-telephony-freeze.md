# Phase 2 — Backend Telephony Production Freeze

**Status:** Frozen as of Phase 2.5 completion.  
**Effective:** Production baseline for all telephony services.

---

## Frozen components

The following backend modules are **production baseline**. Do not modify unless fixing a confirmed production bug:

| Domain | Primary modules |
|--------|-----------------|
| Call Control | `lib/inboundCallControl.js`, `lib/callSession*.js`, `lib/callFsm.js` |
| PSTN routing | `lib/inboundRouting.js`, `lib/pbxOwnership.js`, parked PSTN handlers |
| Park Outbound | `handleParkedPstnOutboundPassthrough`, WebRTC outbound bridge |
| QR provisioning | `lib/extensionProvisioning.js`, `lib/employeeProvisioningProfile.js` |
| SIP identity | `lib/employeeTelephony.js`, `lib/softphone.js`, `lib/extensionSip.js` |
| Employee provisioning | `POST /api/mobile/provision`, provisioning token redeem |
| Extension routing | `lib/internalExtensionDial.js`, `resolveExtensionRingTargets` |
| Mobile telephony | `mobile-rn/src/sip/*`, `mobile-rn/src/calling/*` |

---

## Allowed changes after freeze

- **Production bug fixes** with regression tests
- **Documentation** updates
- **Web portal (Phase 2.7+)** — UI only; must reuse existing APIs
- **Super Admin** platform tools unrelated to tenant call routing

---

## Not allowed without new phase approval

- New SIP credential models per extension
- Browser WebRTC re-enablement in production
- Call Control handler refactors
- PSTN path changes
- Duplicate provisioning APIs

---

## Verification baseline

Before any telephony hotfix:

```bash
npm run test:telephony
npm run test:mobile
```

All Phase 2.4–2.5 tests must remain green.

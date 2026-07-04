# Phase 2 — Deprecated Modules

Modules and paths **still present in the codebase** but **not part of the Phase 2 target architecture**. Do not extend these. Remove or gate them in the phase indicated.

**Legend:** 🟡 Deprecated · 🔴 Remove after phase · 🟢 Keep (target)

---

## Webhooks and inbound routing

| Status | Path / symbol | Reason | Phase |
|--------|---------------|--------|-------|
| 🔴 | `server.js` — `GET/POST /webhook` → `handleTelnyxWebhook` | TeXML inbound; cannot ring WebRTC/SIP app targets | 2.4 |
| 🔴 | `lib/callRouting.js` — `buildInboundCallTexml`, TeXML ring/forward | Legacy PSTN-phone-only inbound | 2.4 |
| 🟡 | `server.js` — `/webhook/voice` dispatching `call.*` to `handleInboundCallControlEvent` | Duplicates `/webhook/call-control` | 2.4 |
| 🟢 | `server.js` — `POST /webhook/call-control` | **Canonical** inbound/outbound Call Control entry | — |
| 🟢 | `lib/inboundCallControl.js` | Inbound FSM, bridge, connect flow | — |
| 🟢 | `lib/telnyxCallControl.js` — `dialDestination` | Pattern 1 bridge | — |

---

## Outbound and internal calls

| Status | Path / symbol | Reason | Phase |
|--------|---------------|--------|-------|
| 🟡 | `lib/internalExtensionDial.js` — `initiateInternalCallFromApi` | Alternate internal originate; mobile uses `newCall` | 2.3 / 2.4 |
| 🟡 | `routes/portal.js` — `POST /api/softphone/internal-call` | API originate path unused by softphone-v2 | 2.4 |
| 🟢 | `lib/internalExtensionDial.js` — `handleParkedWebRtcOutboundInitiated` | **Canonical** parked outbound dispatcher | — |
| 🟢 | `lib/internalExtensionDial.js` — `handleParkedPstnOutboundPassthrough` | PSTN outbound (frozen until 2.4) | — |
| 🟢 | `lib/internalExtensionDial.js` — `handleInternalExtensionCallInitiated` | Extension-to-extension | — |

---

## Ring target resolution (duplicates)

| Status | Path / symbol | Reason | Phase |
|--------|---------------|--------|-------|
| 🟡 | `lib/inboundRouting.js` — `resolveGreetingRingTargets` | Tenant greeting JSON ring group bypasses extension hub | 2.4 |
| 🟡 | `lib/inboundRouting.js` — dual targets in `resolveExtensionRingTargets` (app + desk SIP usernames) | Two SIP identities per extension | 2.4 |
| 🟡 | `lib/numberRouting.js` — `direct_user` routing without `extensionId` | DID → user without extension | 2.4 |
| 🟢 | `lib/inboundRouting.js` — `resolveExtensionForPhoneRecord` | Extension lookup for DID | — |
| 🟢 | `lib/extensionInbound.js` | DND, forward, screen, security policy | — |

---

## SIP credentials (dual identity — to consolidate)

| Status | Path / symbol | Reason | Phase |
|--------|---------------|--------|-------|
| 🟡 | `lib/extensionSip.js` — `ensureExtensionTelnyxCredential` | Separate desk `extensions.telnyxSipUsername` | 2.4 / 2.6 |
| 🟢 | `lib/softphone.js` — `getOrCreateUserTelephonyCredential` | Employee SIP (target single identity) | — |
| 🟡 | Desk registration with extension number as SIP User ID | Misconfiguration; must use Telnyx username | 2.6 docs + validation |

---

## Browser telephony (disable, do not delete yet)

| Status | Path / symbol | Reason | Phase |
|--------|---------------|--------|-------|
| 🟡 | `web/src/app/(app)/softphone-v2/` | Primary WebRTC UI; gated off in 2.2 | 2.2 flag |
| 🟡 | `web/src/app/(app)/softphone/` | Legacy WebRTC UI | 2.2 flag |
| 🟡 | `web/src/lib/telephony/` — orchestrator, FSM, mapper | Browser-only call state | 2.2 flag |
| 🟡 | `web/src/lib/telnyx-softphone-session.ts` | Browser Telnyx session | 2.2 flag |
| 🟡 | `web/src/lib/softphone-v2-reconnect.ts` | Browser reconnect | 2.2 flag |
| 🟡 | `routes/portal.js` — `/api/softphone/token` when called from web | Browser SIP token | 2.2 |
| 🟢 | `/api/softphone/token` for **mobile** clients | Required for mobile-rn | — |

---

## Mobile clients (pick one primary)

| Status | Path | Reason | Phase |
|--------|------|--------|-------|
| 🟢 | `mobile-rn/` | **Primary** Phase 2 telephony client | 2.3+ |
| 🔴 | ~~`mobile/` (Flutter)~~ | Removed Phase 2.8 | 2.8 |

---

## Provisioning (replace in Phase 2.5–2.6)

| Status | Path | Reason | Phase |
|--------|------|--------|-------|
| 🟡 | `lib/extensionProvisioning.js` — partial QR flow | Redesign end-to-end QR payload | 2.5 |
| 🟡 | Manual Grandstream SIP UI entry | Replace with auto-provision profile | 2.6 |
| 🟢 | `lib/pbxOwnership.js` — `syncTenantPhoneExtensionLinks` | Ownership sync (extend in 2.4) | — |
| 🟢 | `lib/extensionOwnership.js` | DID ↔ extension helpers | — |

---

## Portal pages (consolidate in 2.7)

Duplicate or overlapping admin UIs should merge in Phase 2.7 only. No removals in 2.1.

| Area | Notes |
|------|-------|
| Phone system vs settings | Consolidate extension/DID/device config |
| Softphone nav entries | Remove from nav in 2.2, delete routes in later phase |

---

## Documentation superseded by Phase 2

| Document | Notes |
|----------|-------|
| `docs/vsp/pbx/01-system-architecture.md` | Still accurate for **current** deploy; browser-centric diagram updated in Phase 2.2 docs |
| `docs/vsp/pbx/19-mobile-app.md` | Update in Phase 2.3 when mobile is primary |

**Canonical Phase 2 architecture:** [01-architecture-freeze.md](./01-architecture-freeze.md)

---

## Do not deprecate (frozen working paths)

Until Phase 2.4 explicitly refactors them:

- PSTN outbound parked passthrough (`handleParkedPstnOutboundPassthrough`)
- Inbound answer gate / bridge grace (`lib/inboundCallControl.js`, `lib/callControlSessionStore.js`)
- `web/src/lib/telephony/telnyx-mapper.ts` PSTN outbound confirm logic
- Production Call Control webhook URL configuration

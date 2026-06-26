# Current State

What VSP Phone implements today (June 2026). Source: codebase, [../features.md](../features.md), [../../COMPLETE-APPLICATION-AUDIT.md](../../COMPLETE-APPLICATION-AUDIT.md).

**Product maturity:** Pilot / closed-beta — suitable for concierge onboarding (~10 tenants). Not full enterprise GA.

---

## Core telephony — implemented

| Feature | Status | Key implementation |
|---------|--------|-------------------|
| Softphone (Web V2) | ✅ | `softphone-v2/page.tsx`, Telnyx SDK 2.27.1 |
| Softphone (Web V1) | ✅ | Legacy rollback path `/softphone` |
| Telnyx login / token | ✅ | `POST /api/softphone/token` |
| Inbound calls | ✅ | Call Control + WebRTC (`inboundCallControl.js`) |
| Outbound calls | ✅ | SDK `newCall` |
| Two-way audio | ✅ | Environment-dependent (ICE/TURN) |
| Bridge grace | ✅ | `POST /api/softphone/call-accepted` |
| Internal extension dial | ✅ | `internalExtensionDial.js` |
| WebRTC diagnostics | ✅ | `/softphone-v2/diagnostics` |

---

## PBX features — implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Voicemail | ✅ | Call Control + TeXML legacy |
| Call recording | ✅ | Inbound auto + outbound manual |
| Blind transfer | ✅ | Phase 1 — PSTN leg transfer |
| Ring groups | ✅ | Entity model + legacy greeting JSON |
| IVR | 🔄 Partial | Single-level; skipped when mobile rings |
| Business hours | ✅ | Greeting + after-hours VM |
| Call screening | ✅ | Extension gather accept/reject |
| DND / forwarding | ✅ | Extension policies |
| SMS (portal) | ✅ | Mobile push gaps |

---

## Platform & admin — implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-tenant isolation | ✅ | JWT + DID scoping |
| DID management / sync | ✅ | Admin sync, routing types |
| Extension management | ✅ | CRUD, SIP, security |
| Super admin portal | ✅ | `admin.vspphone.com` |
| Stripe / Razorpay billing | ✅ | Subscription flows |
| Call history (CDR) | ✅ | `CallLog` + portal |
| Call quality metrics | ✅ | `CallQualityMetric` model |

---

## Infrastructure — implemented

| Feature | Status | Notes |
|---------|--------|-------|
| EC2 production deploy | ✅ | Docker API + PM2 web + Nginx |
| Deploy automation | ✅ | `deploy/deploy-api.sh`, `deploy-web.sh` — deployment automation |
| Redis session store | ✅ | Call Control sessions |
| Prisma migrations | ✅ | Auto on API container start |
| Webhook signature verify | ✅ | `WEBHOOK_STRICT` |
| Internal documentation KB | ✅ | `docs/vsp/`, `docs/telnyx/` |

---

## Mobile — partial

| Feature | Status | Notes |
|---------|--------|-------|
| Flutter Android | ✅ | Inbound/outbound WebRTC |
| iOS | ❌ | Not shipped |
| Mobile blind transfer | ❌ | Web only |
| Push notifications | 🔄 Partial | Android FCM setup |

---

## Not yet implemented

| Feature | Status |
|---------|--------|
| Warm / attended transfer | 📋 Planned |
| Conference calling | 📋 Planned |
| Call queues (ACD) | 🔮 Future |
| Call parking | 🔮 Future |
| Presence-aware routing | 🔄 Data only |
| CRM integration | 🔮 Future |
| AI transcription / summary | 🔮 Future |
| SSO / LDAP | 🔮 Future |
| ECS / multi-region HA | 📋 Documented |

---

## Known gaps (active engineering)

| Gap | Impact |
|-----|--------|
| Two-way audio send path (Web V2) | Outbound/local send under investigation |
| Outbound extension security enforcement | Permissions stored, not fully checked at dial |
| Presence not used in ring targets | Heartbeat only |
| TeXML + Call Control dual path | Migration in progress |
| Live admin WebSocket dashboard | Planned |

---

## Validation coverage today

Existing scripts (not full unit test suite):

```bash
npm run validate:p0
npm run validate:blind-transfer
npm run validate:call-transfer-session
npm run validate:rapid-accept-stress
npm run validate:extension-did
npm run validate:inbound-media-phase1
```

See [05-testing-strategy.md](./05-testing-strategy.md) for target state.

---

## Related docs

- [02-priority-roadmap.md](./02-priority-roadmap.md)
- [../features.md](../features.md)
- [../pbx/README.md](../pbx/README.md)

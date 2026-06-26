# VSP Phone — Feature Status

PBX and platform feature matrix. Updated from current codebase and application audit.

**Legend:** ✅ Implemented · 🔄 In Progress · 📋 Planned · 🚫 Blocked · 🔮 Future

---

## Core telephony

| Feature | Status | Notes |
|---------|--------|-------|
| Softphone (Web V2) | ✅ Implemented | `softphone-v2/page.tsx`, Telnyx SDK 2.27.1 |
| Softphone (Web V1) | ✅ Implemented | Legacy `/softphone` — rollback path |
| Telnyx login / token | ✅ Implemented | `POST /api/softphone/token` |
| Inbound calls (PSTN → agent) | ✅ Implemented | Call Control + WebRTC |
| Outbound calls (agent → PSTN) | ✅ Implemented | SDK `newCall` |
| Two-way audio | ✅ Implemented | Environment-dependent (ICE/TURN) |
| Internal extension dial | ✅ Implemented | `internalExtensionDial.js` |
| Bridge grace | ✅ Implemented | `call-accepted` endpoint |
| WebRTC diagnostics | ✅ Implemented | `/softphone-v2/diagnostics` |

---

## PBX features

| Feature | Status | Notes |
|---------|--------|-------|
| Voicemail | ✅ Implemented | Call Control + TeXML legacy |
| Call recording | ✅ Implemented | Inbound auto + outbound manual |
| Blind transfer | ✅ Implemented | Phase 1 — PSTN leg transfer |
| Warm / attended transfer | 📋 Planned | Phase 2 warm transfer — see transfer plan |
| Conference calls | 📋 Planned | Phase 3 |
| Ring groups | ✅ Implemented | Entity model + legacy JSON |
| Call queues (ACD) | 🔮 Future | Telnyx enqueue not integrated |
| IVR | 🔄 In Progress | Single-level gather; skipped for mobile ring |
| Business hours | ✅ Implemented | Greeting hours + after-hours VM |
| Call parking | 🔮 Future | Not in codebase |
| Presence | 🔄 In Progress | Heartbeat stored; not used in routing |
| Call screening | ✅ Implemented | Extension gather accept/reject |
| DND / forwarding | ✅ Implemented | Extension policies |
| SMS | ✅ Implemented | Portal SMS — mobile push gaps |
| Fax | 🔮 Future | Not implemented |

---

## Routing & admin

| Feature | Status | Notes |
|---------|--------|-------|
| DID sync (Telnyx → VSP) | ✅ Implemented | Admin sync endpoint |
| DID assignment | ✅ Implemented | routingType per number |
| Extension management | ✅ Implemented | Full CRUD + SIP |
| Multi-tenant isolation | ✅ Implemented | JWT + DID scoping |
| Super admin portal | ✅ Implemented | `admin.vspphone.com` |
| Live operations dashboard | 🔄 In Progress | Real-time WS planned |

---

## Clients

| Feature | Status | Notes |
|---------|--------|-------|
| Flutter mobile (Android) | ✅ Implemented | Inbound/outbound WebRTC |
| Mobile blind transfer | 📋 Planned | Web ahead of mobile |
| Mobile ring groups admin | 📋 Planned | Web only today |
| Desktop app | 🔮 Future | Electron not started |
| iOS | 🔮 Future | Android first |

---

## AI & analytics

| Feature | Status | Notes |
|---------|--------|-------|
| AI call summary | 🔮 Future | Not implemented |
| Transcription | 🔮 Future | Not implemented |
| Call quality metrics | ✅ Implemented | `CallQualityMetric` model |
| Ring group analytics | ✅ Implemented | Ring group routes |

---

## Integrations

| Feature | Status | Notes |
|---------|--------|-------|
| CRM integration | 🔮 Future | No CRM connectors |
| Stripe billing | ✅ Implemented | Subscription billing |
| Razorpay billing | ✅ Implemented | Regional payments |
| Telnyx webhooks | ✅ Implemented | Call Control primary |

---

## Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| EC2 production deploy | ✅ Implemented | Docker + PM2 + Nginx |
| ECS / multi-region HA | 📋 Planned | Launch guide documented |
| Redis session store | ✅ Implemented | Required for production |
| Webhook signature verify | ✅ Implemented | `WEBHOOK_STRICT` |

---

## Validation scripts

| Area | Script |
|------|--------|
| Blind transfer | `npm run validate:blind-transfer` |
| Transfer session | `npm run validate:call-transfer-session` |
| Bridge grace stress | `npm run validate:rapid-accept-stress` |
| Extension / DID | `npm run validate:extension-did` |
| PBX production | `npm run validate:pbx-production` |
| Inbound media | `npm run validate:inbound-media-phase1` |
| Voicemail audio | `npm run validate:exclusive-voicemail-audio` |

---

## Related docs

- [pbx/README.md](./pbx/README.md)
- [pbx/24-future-roadmap.md](./pbx/24-future-roadmap.md)
- [COMPLETE-APPLICATION-AUDIT.md](../COMPLETE-APPLICATION-AUDIT.md)

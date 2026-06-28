# Phase 2.7 — Tenant Portal Redesign

Enterprise PBX administration portal. **UI and workflow only** — backend telephony is frozen ([06-backend-telephony-freeze.md](./06-backend-telephony-freeze.md)).

---

## Principles

1. Browser is **administration only** — no WebRTC, no Telnyx SDK, no SIP registration.
2. Reuse existing `/api/*` endpoints — no duplicate APIs.
3. **Extensions** are the center of PBX administration (Config, QR, employee, DID).
4. Commit in small deployable increments; run `cd web && npm run build` after each.

---

## Information architecture

| Nav item | Route | Backend APIs |
|----------|-------|--------------|
| Dashboard | `/dashboard` | `GET /api/dashboard/stats`, extension stats, devices, users, ring groups, calls |
| Employees | `/employees` | `GET/POST /api/tenant/users` |
| Extensions | `/extensions` | `GET /api/tenant/extensions`, provisioning, SIP config |
| Phone Numbers | `/phone-numbers` | `GET /api/numbers/mine`, `PATCH /api/tenant/extensions/:id/primary-phone-number` |
| Devices | `/devices` | `GET /api/tenant/extensions/devices` |
| Ring Groups | `/ring-groups` | `GET/POST /api/tenant/ring-groups` |
| Call History | `/calls` | `GET /api/calls` |
| Recordings | `/recordings` | `GET /api/tenant/recordings` |
| Voicemail | `/voicemail` | `GET /api/tenant/voicemails` |
| Reports | `/reports` | Extension analytics, call logs (client aggregation) |
| Billing | `/billing` | `GET /api/billing/*`, subscription |
| Settings | `/settings/*` | Profile, greeting, team legacy paths |

Legacy routes (`/phone-system/*`, `/my-numbers`, `/settings/team`) redirect to canonical paths.

---

## Increment plan

| Increment | Scope |
|-----------|-------|
| 2.7.1 | Admin gate, nav IA, dashboard, extensions hub, employees, route aliases |
| 2.7.2 | Phone numbers (DID management), devices, ring groups list UX |
| 2.7.3 | Call history polish, remaining phone-system legacy cleanup |
| 2.7.4 | Recordings, voicemail polish |
| 2.7.5 | Reports, billing hub |
| 2.7.6 | Settings reorganization |

---

## Browser telephony

`NEXT_PUBLIC_BROWSER_CALLING_ENABLED=false` (default). Softphone source remains in repo but routes show admin-only message.

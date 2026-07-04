# API Reference

PBX-related HTTP endpoints. All `/api/*` routes require JWT unless noted. Webhooks use Telnyx signature verification.

---

## Softphone & calls

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/softphone/config` | JWT | Numbers, recording flags, Telnyx diagnostics |
| GET | `/api/softphone/diagnostics` | JWT | Inbound routing diagnostics |
| POST | `/api/softphone/token` | JWT | Telnyx WebRTC login token |
| POST | `/api/softphone/presence` | JWT | Online heartbeat |
| POST | `/api/softphone/call-accepted` | JWT | Bridge grace — pre-answer signal |
| POST | `/api/softphone/internal-call` | JWT | API-initiated extension dial |
| POST | `/api/softphone/transfer/blind` | JWT | Blind transfer |
| POST | `/api/softphone/call-log` | JWT | Client CDR sync |
| POST | `/api/softphone/record-start` | JWT | Outbound recording start |
| POST | `/api/softphone/telemetry` | JWT | Client telemetry |
| POST | `/api/softphone/push-token` | JWT | Mobile push registration |
| GET | `/api/softphone/devices` | JWT | Registered devices |
| DELETE | `/api/softphone/devices/:id` | JWT | Remove device |
| GET | `/api/calls` | JWT | Call history |

**Router:** `routes/portal.js`

---

## Greeting & routing

| Method | Path | Purpose |
|--------|------|---------|
| GET/PUT | `/api/tenants/:tenantId/greeting` | Tenant greeting / IVR |
| GET/PUT | `/api/tenants/:tenantId/call-routing` | Call routing settings |
| PUT | `/api/numbers/:id` | DID assignment / routing type |

---

## Extensions

Base: `/api/tenant/extensions/*` — `routes/extensions.js`

CRUD, SIP credentials, security, forwarding, business settings, intercom, voicemails, provisioning.

---

## Ring groups

Base: `/api/tenant/ring-groups/*` — `routes/ringGroups.js`

CRUD, members, reorder, analytics, destinations, simulate, legacy migration.

---

## Voicemail

| Method | Path |
|--------|------|
| GET | `/api/tenant/voicemails` |
| PATCH | `/api/tenant/voicemails/:id/read` |
| DELETE | `/api/tenant/voicemails/:id` |
| GET | `/api/tenant/voicemails/:id/stream` |

---

## Recordings

| Method | Path |
|--------|------|
| GET | `/api/tenant/recordings` |
| GET | `/api/tenant/recordings/:id/stream` |
| DELETE | `/api/tenant/recordings/:id` |
| POST | `/api/tenant/recordings/sync` |

---

## Admin

| Method | Path | Role |
|--------|------|------|
| POST | `/api/admin/numbers/sync` | SUPER_ADMIN — Telnyx DID sync |

---

## Health (no auth)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/ready` | DB, Redis, Telnyx, build commit |

---

## Webhooks (Telnyx signature)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/webhook/call-control` | Primary Call Control FSM |
| GET/POST | `/webhook` | TeXML inbound (legacy) |
| POST | `/webhook/voice` | Telemetry + recordings |
| POST | `/webhook/call-recording` | Recording saved |
| POST | `/webhook/voicemail` | TeXML VM callbacks |

---

## Related docs

- [05-call-control.md](./05-call-control.md)
- [21-event-sequence.md](./21-event-sequence.md)
- [22-security.md](./22-security.md)

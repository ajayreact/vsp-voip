# Phase 2.9 — Complete Tenant Administration Portal

Enterprise PBX administration only. **Backend telephony is frozen** ([06-backend-telephony-freeze.md](./06-backend-telephony-freeze.md)). No repository cleanup unless fixing a production bug.

---

## Principles

1. Browser is **administration only** — never Telnyx SDK, never SIP registration, never browser calling.
2. Reuse existing `/api/*` endpoints — no duplicate APIs.
3. Small, deployable, tested commits after each increment.
4. Do not begin Phase 3 until all tenant administration pages are complete.

---

## Administration pages

| # | Page | Route | Status |
|---|------|-------|--------|
| 1 | Phone Numbers | `/phone-numbers` | Done (2.7.2, refined 2.9) |
| 2 | Devices | `/devices` | Done (2.7.2, refined 2.9) |
| 3 | Ring Groups | `/ring-groups` | Done (2.9.2) — list, create, detail, member reorder |
| 4 | Call History | `/calls` | Done (2.7.3) |
| 5 | Recordings | `/recordings` | Done (2.7.3) |
| 6 | Voicemail | `/voicemail` | Done (2.7.3) |
| 7 | Reports | `/reports` | Done (2.7.3) |
| 8 | Billing | `/billing` | Done (2.7.3) |
| 9 | Settings | `/settings/*` | Hub done (2.7.3); sub-pages legacy shell |

---

## Increment plan

| Increment | Scope |
|-----------|-------|
| 2.9.1 | Refine phone numbers + devices columns/actions; call history portal; reports stats-only |
| 2.9.2 | Ring groups create/edit portal shell (remove PhoneSystemNav) |
| 2.9.3 | Recordings + voicemail portal shell |
| 2.9.4 | Billing hub at `/billing` |
| 2.9.5 | Settings reorganization (portal headers, unified IA) |

Run after each commit:

```bash
cd web && npm run build
npm run test:telephony
npm run test:mobile
```

---

## Page specifications

### Phone Numbers

Columns: DID, Tenant, Assigned Extension, Assigned Employee, Caller ID, Routing Status, Registration Status.

Actions: Assign Extension, Reassign, Remove Assignment, View Call Routing, View Call History.

APIs: `GET /api/numbers/mine`, `GET /api/tenant/extensions`, `PATCH /api/tenant/extensions/:id/primary-phone-number`.

### Devices

Columns: Employee, Extension, Device Type, Mobile Status, Desk Phone Status, Registration, Last Registration, SIP Username.

Actions: Config, QR, Reset SIP Password, Revoke Device.

APIs: `GET /api/tenant/extensions`, `GET /api/tenant/extensions/:id/sip-credentials`, reset/revoke provisioning endpoints.

### Ring Groups

Columns: Group Name, Extension, Members, Ring Strategy, Status.

Actions: Edit, Add Member, Remove Member, Delete.

### Reports

Dashboard statistics only. No telephony controls.

APIs: `loadPortalDashboardSnapshot()`, `GET /api/calls` (period filter client-side).

---

## Validation checklist

- [ ] Production build passes
- [ ] Telephony tests pass
- [ ] Mobile tests pass
- [ ] No changes under `lib/` call control, routing, provisioning (unless production bug fix)
- [ ] Legacy routes redirect to canonical paths

# V3.0.0 — Features

## Portal Phases

| Phase | Name | Capabilities |
|-------|------|--------------|
| **1** | Provisioning | Employees, PBX health, repair, audit, device provisioning |
| **2** | Marketplace | Number inventory, Telnyx sync, DID assignment, marketplace purchase |
| **3** | Desk Phones | Device CRUD, templates, auto-provisioning, device health/repair |
| **4** | Call Flow Builder | Visual builder, validation, simulator (config) |
| **5** | PBX Objects | Ring groups, queues, business hours, holidays, voicemail |
| **6** | Softphone UX | Profiles, preferences, presence, directory, UX health |
| **7** | Operations | Dashboard, analytics, reports, monitoring, notifications |
| **8** | Billing & Lifecycle | Subscription, license, backup/restore, import/export |
| **9** | Runtime Sync | Config → telephony worker bridge (opt-in) |
| **10** | Production Readiness | Migration, diagnostics, deployment status, production health |

## Post-Phase Additions

| Feature | Description |
|---------|-------------|
| **Migration Wizard** | Super-admin 6-step legacy → V3 orchestration |
| **Test Lab** | Staging validation harness with run history |

## UI Routes (43 pages)

Dashboard, employees, health, numbers, assignments, marketplace, devices, call flows, ring groups, queues, business hours, holidays, voicemail, profile, presence, directory, analytics, billing, backups, runtime, migration, test lab, and more under `/v3/*`.

## API

96 route handlers on `/api/v3/*`. See `API_REFERENCE.md`.

## Default Deployment Mode

- Portal configuration: **enabled** (after flags set)
- Runtime sync: **disabled**
- Live V3 telephony: **disabled** — legacy Call Control remains production path

## Not Included in V3.0.0

- Warm/attended transfer on V3 path
- CRM integrations
- AI features in portal
- Mobile V3 admin app
- Automatic runtime sync for all tenants

See `KNOWN_LIMITATIONS.md`

# V3.0.0 — Changelog

## [3.0.0] — GA (post-UAT)

General Availability release of Tenant Portal V3. Builds on `v3.0.0-rc1` code freeze.

### Added

- Complete portal Phases 1–10
- Migration Wizard (super-admin)
- Test Lab (staging)
- 96 API endpoints on `/api/v3`
- 43 frontend pages under `/v3`
- 22 Prisma V3 models
- 11 database migrations
- 130 V3 unit tests

### Security (RC1 audit)

- Read-only softphone profiles in health checks
- `TENANT_MISMATCH` on import/restore
- Super-admin guards on sensitive UI and subscription PUT
- P2002 race fixes for presence and profiles

### Documentation (GA package)

- `release/v3.0.0/` release package
- `docs/release/` operations handover
- `docs/admin/` administrator manuals
- `docs/developer/` developer manuals
- `docs/architecture/` ER and system diagrams

### Unchanged

- Legacy Call Control telephony path
- Protected telephony files
- WebRTC softphone V2
- Default: runtime sync off

---

## [3.0.0-rc1] — 2026-07-03

Release Candidate 1 — code freeze.

See `CHANGELOG_RC1.md` at repository root.

---

## Prior Development

Development on `backup/pre-v3-staging` / `release/v3.0.0-rc1`. See git log `--grep=v3`.

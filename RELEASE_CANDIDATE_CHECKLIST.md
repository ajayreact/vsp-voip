# Tenant Portal V3 — Release Candidate Checklist (RC1)

**Version:** v3.0.0-rc1  
**Branch:** `release/v3.0.0-rc1`  
**Date:** 2026-07-03  
**Status:** Code freeze — no new features

---

## Phase Completion

| # | Phase | Scope | Status |
|---|-------|-------|--------|
| ✅ | **Phase 1** | Provisioning — employees, PBX health, repair, audit, device provisioning | **Complete** |
| ✅ | **Phase 2** | Marketplace — number inventory, Telnyx sync, assignments, marketplace purchase | **Complete** |
| ✅ | **Phase 3** | Desk Phones — device CRUD, templates, auto-provisioning, device health/repair | **Complete** |
| ✅ | **Phase 4** | Call Flow Builder — engine, nodes, validation, simulator (config only) | **Complete** |
| ✅ | **Phase 5** | PBX Objects — ring groups, queues, business hours, holidays, voicemail | **Complete** |
| ✅ | **Phase 6** | Softphone Management — profiles, preferences, presence, directory, UX health | **Complete** |
| ✅ | **Phase 7** | Operations Dashboard — dashboard, analytics, reports, monitoring, notifications | **Complete** |
| ✅ | **Phase 8** | Billing / Backup / Lifecycle — subscription, license, backup/restore, import/export | **Complete** |
| ✅ | **Phase 9** | Runtime Sync — adapters, job enqueue, runtime health (default **off**) | **Complete** |
| ✅ | **Phase 10** | Production Readiness — deployment status, migration, diagnostics, production health | **Complete** |
| ✅ | **Migration Wizard** | Super-admin 6-step legacy → V3 orchestration with rollback | **Complete** |
| ✅ | **Test Lab** | Staging validation harness with run history | **Complete** |

---

## Freeze Gates

| Gate | Result |
|------|--------|
| V3 unit tests (130) | ✅ PASS |
| V3 ESLint | ✅ PASS (0 issues) |
| Prisma validate | ✅ PASS |
| Migration validate | ✅ PASS |
| TypeScript (web) | ✅ PASS |
| Working tree clean | ⚠️ **FAIL** — uncommitted test fix + submodule |
| Tag aligned to RC HEAD | ⚠️ **FAIL** — `v3.0.0-rc1` points to pre-portal commit |
| Runtime sync production canary | ⚠️ **Not validated** |
| Protected telephony files modified | ✅ None in RC1 scope |

---

## Sign-Off

| Role | RC1 Portal Config | RC1 Runtime Telephony |
|------|-------------------|----------------------|
| Engineering | ✅ GO | ⚠️ NO-GO (canary pending) |
| Operations | ✅ GO (staging) | ⚠️ NO-GO |
| Product | ✅ GO (RC1 freeze) | Deferred to post-RC1 |

# Tenant Portal V3 — Version 3.0.0

**Release type:** General Availability (post-RC1 UAT)  
**Package:** `release/v3.0.0/`  
**Branch:** `release/v3.0.0-rc1` → tag `v3.0.0` after UAT sign-off

---

## Overview

Tenant Portal V3 is the tenant-scoped administration layer for VSP Phone. Version 3.0.0 delivers configuration, health monitoring, billing, backup, migration tooling, and optional runtime telephony sync — without replacing legacy Call Control in the default deployment.

## Package Contents

| File | Purpose |
|------|---------|
| `INSTALL.md` | Fresh install and deploy |
| `UPGRADE.md` | Upgrade from legacy portal or RC1 |
| `ROLLBACK.md` | Rollback procedures |
| `FEATURES.md` | Feature matrix (Phases 1–10) |
| `KNOWN_LIMITATIONS.md` | Deferred items |
| `ENVIRONMENT_VARIABLES.md` | All V3 flags |
| `API_REFERENCE.md` | Complete `/api/v3/*` documentation |
| `CHANGELOG.md` | Version history |
| `LICENSES.md` | License and third-party notices |

## Related Documentation

| Path | Audience |
|------|----------|
| `docs/release/` | Ops handover (RC1 checklists) |
| `docs/V3/` | Feature operational guides |
| `docs/admin/` | Administrator manuals |
| `docs/developer/` | Developer manuals |
| `docs/architecture/` | ER diagrams, system architecture |

## Quick Start

```bash
git checkout release/v3.0.0-rc1   # until v3.0.0 tag published
npm run migrate:deploy
V3_PORTAL_ENABLED=true NEXT_PUBLIC_V3_PORTAL=true bash deploy/deploy-web.sh
```

See `INSTALL.md` for full procedure.

## Support

Internal runbook: `docs/release/10_OPERATIONS_RUNBOOK.md`

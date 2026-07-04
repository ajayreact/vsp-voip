# Tenant Portal V3 — Separate Repository Preparation

**Version:** v3.0.0-rc1  
**Target repository:** `vsp-phone-tenant-portal-v3`

---

## Status

**Repository creation must be done manually on GitHub.**

- `gh` CLI is **not installed** in the current environment
- No automated credentials/configuration detected for repo creation
- This document provides the **exact structure and git commands** to execute after manual repo creation

---

## Intended Repository Contents

```
vsp-phone-tenant-portal-v3/
├── lib/v3/                    # Portal backend services
├── lib/v3/runtime/            # Runtime adapters
├── routes/v3.js               # API routes (or extract mount)
├── web/src/app/(app)/v3/      # Portal UI pages
├── web/src/lib/v3-api.ts      # API client
├── web/src/lib/portal-nav.ts  # Navigation (V3 sections)
├── web/src/components/v3/     # Shared V3 components
├── prisma/migrations/         # V3 migrations only (see manifest)
├── tests/v3/                  # V3 unit tests
├── deploy/
│   ├── staging-v3-portal.sh
│   └── staging-v3-runtime-canary.sh
├── docs/V3/                   # This documentation set
├── CHANGELOG.md
├── RELEASE_NOTES.md
└── README.md                  # Portal-specific readme
```

**Exclude from split repo:**

- `lib/inboundCallControl.js`, `lib/telnyxCallControl.js` (legacy telephony)
- `lib/telephony-v3/` (separate telephony stack — link as dependency doc)
- Mobile, legacy softphone, unrelated portal pages

---

## V3 Prisma Migrations (Include)

```
20260624180500_v3_telephony_phase1
20260624181000_v3_telephony_phase1_5_hardening
20260627120000_v3_phase395_hardening
20260703120000_v3_desk_devices
20260703140000_v3_call_flows
20260703160000_v3_pbx_objects
20260703180000_v3_softphone_ux
20260703190000_v3_tenant_backup
20260703200000_v3_runtime_sync
20260703210000_v3_migration_run
20260703220000_v3_test_lab_run
```

Also include shared `schema.prisma` (or extracted V3 models) and migration lock file.

---

## Manual GitHub Steps

### 1. Create empty repository (GitHub UI or gh when available)

```bash
gh repo create vsp-phone/vsp-phone-tenant-portal-v3 \
  --private \
  --description "Tenant Portal V3 — Release Candidate" \
  --clone=false
```

If `gh` unavailable, create via GitHub web: **New repository → vsp-phone-tenant-portal-v3**

### 2. Extract from monorepo (subtree split)

From `e:/vsp-voip` on tag `v3.0.0-rc1`:

```bash
# Create split branch with portal paths only
git subtree split --prefix=lib/v3 -b split/v3-lib

# Alternative: use git filter-repo for multi-path (recommended for clean history)
# pip install git-filter-repo
git filter-repo --path lib/v3/ \
  --path routes/v3.js \
  --path web/src/app/\(app\)/v3/ \
  --path web/src/lib/v3-api.ts \
  --path web/src/lib/portal-nav.ts \
  --path web/src/components/v3/ \
  --path tests/v3/ \
  --path docs/V3/ \
  --path deploy/staging-v3-portal.sh \
  --path CHANGELOG.md \
  --path RELEASE_NOTES.md \
  --force
```

### 3. Push to new remote

```bash
git remote add portal-v3 git@github.com:vsp-phone/vsp-phone-tenant-portal-v3.git
git push portal-v3 release/v3.0.0-rc1:main
git push portal-v3 v3.0.0-rc1
```

### 4. Add README in new repo

Document dependency on main VSP API server for mounting `routes/v3.js` and shared auth/Prisma.

---

## Integration Note

Portal V3 RC1 ships **inside the monorepo**. The split repository is optional for:

- Independent documentation hosting
- Partner/contractor access without full telephony codebase
- Future npm package extraction

Production deploy continues from `vsp-voip` until explicitly decoupled.

---

## Verification After Split

```bash
npx vitest run tests/v3
npm run validate:migrations   # if schema included
```

---

## Related

- [Architecture.md](./Architecture.md)
- [Deployment.md](./Deployment.md)

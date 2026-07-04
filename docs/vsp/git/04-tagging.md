# Tagging — Semantic Versioning

VSP Phone uses **Semantic Versioning** (`MAJOR.MINOR.PATCH`) for Git tags on `main`.

Format: `vX.Y.Z`

---

## Version components

| Part | When to increment | Example |
|------|-------------------|---------|
| **MAJOR** (X) | Breaking changes, platform shifts | Flutter mobile GA, API breaking change |
| **MINOR** (Y) | New features, backward compatible | Blind transfer, warm transfer |
| **PATCH** (Z) | Bugfixes, hotfixes only | Bridge grace hotfix |

---

## Release tag map

| Tag | Milestone |
|-----|-----------|
| `v1.0.0` | Stable telephony baseline |
| `v1.1.0` | Blind transfer |
| `v1.2.0` | Multi-tenant DID management |
| `v1.3.0` | Warm transfer (planned) |
| `v1.4.0` | Conference (planned) |
| `v2.0.0` | Flutter mobile GA (planned) |

---

## Existing tags (repository)

| Tag | Notes |
|-----|-------|
| `v1.0` | Early tag — align to SemVer going forward |
| `v1.0-telephony-stable` | Telephony stable baseline reference |
| `phase2-production-ready` | Phase 2 PAT accepted — backend frozen (`1c1fb1d`) |
| `phase2-reset-pbx-stable` | Tenant PBX reset feature rollback point (`107e027`) |

Recommended: annotate stable telephony baseline:

```bash
git tag -a v1.0.0 -m "v1.0.0 Stable Telephony" <commit-sha>
git push origin v1.0.0
```

---

## Creating tags

Always **annotated tags** on `main` after release merge:

```bash
git checkout main
git pull origin main
git tag -a v1.2.0 -m "v1.2.0 Multi-Tenant DID Management"
git push origin v1.2.0
```

List tags:

```bash
git tag -l 'v*'
git show v1.2.0
```

---

## Tags and deployment

| Check | Command |
|-------|---------|
| EC2 at correct tag | `git describe --tags` |
| API build commit | `curl -s https://api.vspphone.com/ready \| jq .build.gitCommit` |
| Match | Tag commit SHA == deployed SHA |

Tags are the **rollback anchor** — see [07-rollback-strategy.md](./07-rollback-strategy.md).

---

## Pre-release tags (optional)

For release branch QA:

```bash
git tag -a v1.3.0-rc.1 -m "Release candidate 1" release/v1.3.0
```

Do **not** deploy RC tags to production EC2.

---

## Related docs

- [03-release-workflow.md](./03-release-workflow.md)
- [07-rollback-strategy.md](./07-rollback-strategy.md)

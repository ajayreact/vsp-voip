# Git Rules

Hard rules for VSP Phone Git workflow. Telephony stability takes priority over velocity.

---

## Never develop directly on

| Branch | Reason |
|--------|--------|
| **`main`** | Production-only; every commit may deploy to live calls |

Use `feature/*`, `hotfix/*`, or `release/*` instead.

---

## Never deploy from

| Branch | Reason |
|--------|--------|
| **`feature/*`** | Incomplete, unreviewed, may break telephony |
| **`development`** | Integration mix — not release-qualified |

Exception: **local/staging** environments for QA on `development` — never EC2 production.

---

## Production deployments only from

```
main
```

EC2 deploy scripts assume `main`:

- `deploy/deploy-web.sh` → `git pull origin main`
- `deploy/deploy-api.sh` → `DEPLOY_BRANCH` defaults to `main`

---

## Branch creation rules

| Action | Branch from | Merge to |
|--------|-------------|----------|
| New feature | `development` | `development` (PR) |
| Release prep | `development` | `release/vX.Y.Z` → `main` |
| Production hotfix | `main` | `main` → back-merge `development` |
| Telephony fix | `hotfix/*` from `main` | Same as hotfix |

---

## Protected telephony files

Changes to protected components require regression analysis before merge — even on feature branches.

See `.cursor/rules/protected-telephony-components.mdc`

---

## Commit hygiene

- One logical change per commit on feature branches
- No secrets, `.env`, or credentials in commits
- Include Prisma migrations in the same PR as schema changes
- Update `web/package-lock.json` when web dependencies change

---

## Compare against stable baseline

Before merging telephony changes:

```bash
git fetch --tags
git log v1.0.0-telephony-stable..HEAD --oneline   # example stable tag
git diff v1.0.0-telephony-stable..HEAD -- lib/inboundCallControl.js
```

Use the **last stable tag** for the area you touch (see [04-tagging.md](./04-tagging.md)).

---

## Related docs

- [01-branch-strategy.md](./01-branch-strategy.md)
- [05-merge-checklist.md](./05-merge-checklist.md)
- [.cursor/rules/git-workflow.mdc](../../../.cursor/rules/git-workflow.mdc)

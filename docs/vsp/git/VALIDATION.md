# Git Workflow — Validation Report

Automated checks: `npm run validate:git-docs`

---

## Branch strategy documented

| Branch | Documented in |
|--------|---------------|
| `main` — production only | [01-branch-strategy.md](./01-branch-strategy.md) |
| `development` — integration | [01-branch-strategy.md](./01-branch-strategy.md) |
| `feature/*` | [01-branch-strategy.md](./01-branch-strategy.md) |
| `hotfix/*` | [01-branch-strategy.md](./01-branch-strategy.md) |
| `release/*` | [01-branch-strategy.md](./01-branch-strategy.md) |

Git rules (never dev on main, deploy from main only): [02-git-rules.md](./02-git-rules.md)

---

## Release process documented

Flow: `feature/*` → `development` → `release/vX.Y.Z` → `main` → Production

| Step | Document |
|------|----------|
| Feature development | [03-release-workflow.md](./03-release-workflow.md) |
| Integration | [03-release-workflow.md](./03-release-workflow.md) |
| Release branch cut | [03-release-workflow.md](./03-release-workflow.md) |
| Tag and merge to main | [03-release-workflow.md](./03-release-workflow.md), [04-tagging.md](./04-tagging.md) |
| EC2 deploy | [03-release-workflow.md](./03-release-workflow.md), [../deployment/02-ec2-deployment.md](../deployment/02-ec2-deployment.md) |
| Hotfix path | [03-release-workflow.md](./03-release-workflow.md) |

SemVer examples (v1.0.0 – v2.0.0): [04-tagging.md](./04-tagging.md)

---

## Rollback documented

| Scenario | Document |
|----------|----------|
| Rollback to previous Git tag | [07-rollback-strategy.md](./07-rollback-strategy.md) |
| Frontend only | [07-rollback-strategy.md](./07-rollback-strategy.md) |
| Backend only | [07-rollback-strategy.md](./07-rollback-strategy.md) |
| Docker image | [07-rollback-strategy.md](./07-rollback-strategy.md) |
| Prisma migration | [07-rollback-strategy.md](./07-rollback-strategy.md) |
| Deployment (ops restart) | [07-rollback-strategy.md](./07-rollback-strategy.md) |

Cross-ref: [../deployment/08-rollback.md](../deployment/08-rollback.md)

---

## Merge checklist completeness

[05-merge-checklist.md](./05-merge-checklist.md) includes all required items:

| Item | Covered |
|------|---------|
| Inbound calls | ✓ |
| Outbound calls | ✓ |
| Two-way audio | ✓ |
| Recording | ✓ |
| Voicemail | ✓ |
| Blind transfer | ✓ |
| DID assignment | ✓ |
| Extension routing | ✓ |
| Tenant isolation | ✓ |
| Validation scripts | ✓ |

---

## Release checklist completeness

[06-release-checklist.md](./06-release-checklist.md) includes all required items:

| Item | Covered |
|------|---------|
| Git tag | ✓ |
| Docker image | ✓ |
| Prisma migrations | ✓ |
| API health | ✓ |
| Frontend health | ✓ |
| PM2 | ✓ |
| Nginx | ✓ |
| WebRTC | ✓ |
| ICE | ✓ |
| TURN | ✓ |
| Recording | ✓ |
| Voicemail | ✓ |
| Transfer | ✓ |
| Browser cache | ✓ |
| Deployment validation | ✓ |

---

## Cursor rule

[.cursor/rules/git-workflow.mdc](../../../.cursor/rules/git-workflow.mdc)

Enforces:

- Never modify `main` directly
- Always create a feature branch
- Compare against last stable tag
- Run validation before merging

---

## Helper scripts

| Script | Purpose |
|--------|---------|
| `scripts/git-new-feature.sh` | Create feature branch from development |
| `scripts/git-pre-merge-check.sh` | Run validators before merge |
| `scripts/validate-git-docs.js` | This validation report |

---

## Application code

**No application source code was modified.**

Created:

- `docs/vsp/git/*`
- `.cursor/rules/git-workflow.mdc`
- `scripts/git-new-feature.sh`
- `scripts/git-pre-merge-check.sh`
- `scripts/validate-git-docs.js`

Updated:

- `docs/vsp/index.md` (hub links)
- `package.json` (`validate:git-docs` script only)

---

## Maintenance

When Git workflow changes, update matching doc and re-run:

```bash
npm run validate:git-docs
```

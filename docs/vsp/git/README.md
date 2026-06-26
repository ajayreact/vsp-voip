# VSP Phone — Git Workflow

Standard branching and release strategy to protect stable telephony while developing features safely.

**Start here:** [01-branch-strategy.md](./01-branch-strategy.md)

---

## Guides

| # | Topic | Document |
|---|-------|----------|
| 01 | Branch strategy | [01-branch-strategy.md](./01-branch-strategy.md) |
| 02 | Git rules | [02-git-rules.md](./02-git-rules.md) |
| 03 | Release workflow | [03-release-workflow.md](./03-release-workflow.md) |
| 04 | Tagging (SemVer) | [04-tagging.md](./04-tagging.md) |
| 05 | Merge checklist | [05-merge-checklist.md](./05-merge-checklist.md) |
| 06 | Release checklist | [06-release-checklist.md](./06-release-checklist.md) |
| 07 | Rollback strategy | [07-rollback-strategy.md](./07-rollback-strategy.md) |

---

## Helper scripts

| Script | Purpose |
|--------|---------|
| `scripts/git-new-feature.sh` | Create `feature/*` branch from `development` |
| `scripts/git-pre-merge-check.sh` | Run validation scripts before merge |
| `scripts/validate-git-docs.js` | Verify KB completeness |

```bash
npm run validate:git-docs
```

---

## Cursor rule

[.cursor/rules/git-workflow.mdc](../../../.cursor/rules/git-workflow.mdc)

---

## Related

| Topic | Location |
|-------|----------|
| EC2 deploy | [../deployment/02-ec2-deployment.md](../deployment/02-ec2-deployment.md) |
| Deploy rollback | [../deployment/08-rollback.md](../deployment/08-rollback.md) |
| Telephony validation | [../deployment/14-telephony-validation.md](../deployment/14-telephony-validation.md) |
| PBX architecture | [../pbx/README.md](../pbx/README.md) |
| Feature status | [../features.md](../features.md) |

---

## Validation

[VALIDATION.md](./VALIDATION.md)

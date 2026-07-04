# VSP Phone — Deployment & Operations

Internal runbooks for local dev, EC2 production, rollback, and telephony validation.

**Start here:** [02-ec2-deployment.md](./02-ec2-deployment.md) for production deploys.

---

## Guides

| # | Topic | Document |
|---|-------|----------|
| 01 | Local development | [01-local-development.md](./01-local-development.md) |
| 02 | EC2 deployment | [02-ec2-deployment.md](./02-ec2-deployment.md) |
| 03 | Docker | [03-docker.md](./03-docker.md) |
| 04 | PM2 | [04-pm2.md](./04-pm2.md) |
| 05 | Nginx | [05-nginx.md](./05-nginx.md) |
| 06 | Database migrations | [06-database-migrations.md](./06-database-migrations.md) |
| 07 | Prisma | [07-prisma.md](./07-prisma.md) |
| 08 | Rollback | [08-rollback.md](./08-rollback.md) |
| 09 | Release process | [09-release-process.md](./09-release-process.md) |
| 10 | Production checklist | [10-production-checklist.md](./10-production-checklist.md) |
| 11 | Known issues | [11-known-issues.md](./11-known-issues.md) |
| 12 | Disaster recovery | [12-disaster-recovery.md](./12-disaster-recovery.md) |
| 13 | Monitoring | [13-monitoring.md](./13-monitoring.md) |
| 14 | Telephony validation | [14-telephony-validation.md](./14-telephony-validation.md) |
| 15 | QA regression gate | [15-qa-regression.md](./15-qa-regression.md) |

---

## Validation

- [VALIDATION.md](./VALIDATION.md) — KB completeness report
- `npm run validate:deployment-docs` — automated doc checks

---

## Cursor rules

- [.cursor/rules/deployment-safety.mdc](../../../.cursor/rules/deployment-safety.mdc) — verify deployment before code changes
- [.cursor/rules/vsp-phone-development.mdc](../../../.cursor/rules/vsp-phone-development.mdc) — search order and telephony safety

---

## Related (legacy)

- [deploy/PRODUCTION-CHECKLIST.md](../../../deploy/PRODUCTION-CHECKLIST.md)
- [docs/launch/production-deployment-guide.md](../../launch/production-deployment-guide.md) — future AWS architecture

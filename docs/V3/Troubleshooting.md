# Tenant Portal V3 — Troubleshooting

**Version:** v3.0.0-rc1

---

## Portal Not Visible

| Symptom | Cause | Fix |
|---------|-------|-----|
| No V3 nav items | Web built without flag | Rebuild with `NEXT_PUBLIC_V3_PORTAL=true` |
| `/v3/*` 404 on web | Same as above | `bash deploy/deploy-web.sh` with export set |
| `/api/v3/*` 404 | API flag off | Set `V3_PORTAL_ENABLED=true`, restart API |
| Hard refresh shows old UI | Browser cache | Incognito / hard refresh |

Verify: `curl -sI https://app.vspphone.com/v3/dashboard`

---

## Authentication Errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| 401 on all V3 routes | Expired JWT | Re-login |
| 403 No organization | User lacks tenantId | Link user to tenant |
| 403 on Test Lab | Not super-admin | Use SUPER_ADMIN account |

---

## Test Lab

| Error code | Meaning | Fix |
|------------|---------|-----|
| `TEST_LAB_DISABLED` | Flag off | `V3_TEST_LAB_ENABLED=true` |
| `TEST_LAB_PRODUCTION_BLOCKED` | Production guard | Staging only, or temporary allow flag |
| Runtime checks skipped | Sync disabled | Expected in RC1; enable sync for full telephony tests |

---

## Runtime Sync

| Symptom | Cause | Fix |
|---------|-------|-----|
| Jobs not enqueueing | `V3_RUNTIME_SYNC_ENABLED=false` | Enable + allowlist tenant |
| Missing runtime links | Config not synced | Run sync or validation repair |
| Worker idle | Worker flags off | See telephony-v3 worker docs |

Check: `/v3/runtime`, `/v3/runtime-validation`

---

## Migration

| Error | Fix |
|-------|-----|
| Execute failure + auto-rollback | Review wizard logs; fix validation errors; retry |
| `TENANT_MISMATCH` on import | Ensure bundle matches target tenant |
| Partial migration state | Run rollback step; restore from backup |

---

## Dashboard / Health

| Symptom | Fix |
|---------|-----|
| Empty dashboard | Tenant may have no V3 data yet; run migration |
| Softphone health gaps | Expected if profiles not created; read-only check in RC1 |
| Slow dashboard | Check DB indexes; reduce concurrent stress tests |

---

## Deploy Mismatch

| Symptom | Fix |
|---------|-----|
| API 404 new routes | API not rebuilt — `deploy/deploy-api.sh --build` |
| Old git SHA in `/ready` | Confirm deploy completed |
| Migration pending | `docker compose exec api npx prisma migrate status` |

See `docs/vsp/deployment/11-known-issues.md`

---

## Tests Failing Locally

| Suite | Common cause |
|-------|--------------|
| `tests/v3/*` | Missing env mocks; run from repo root |
| `tests/api/authentication.test.ts` | No local API or rate limit 429 |
| ESLint | Pre-existing legacy web issues — not V3-specific |

V3 gate: `npx vitest run tests/v3` → 130/130

---

## Logs

```bash
docker compose logs api --tail=100
docker compose logs telephony-v3-worker --tail=100
pm2 logs vsp-web --lines 50
```

---

## Escalation

1. Capture `/ready` JSON and git SHA
2. Export Test Lab run ID if applicable
3. Check `docs/vsp/deployment/18-v3-production-operations-runbook.md`
4. Do **not** modify protected telephony files without regression analysis

---

## Related

- [Deployment.md](./Deployment.md)
- [Environment.md](./Environment.md)
- [RuntimeSync.md](./RuntimeSync.md)

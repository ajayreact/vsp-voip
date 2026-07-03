# V3 Feature Flags

## Portal

| Flag | Layer | Default |
|------|-------|---------|
| `V3_PORTAL_ENABLED` | API | `false` |
| `NEXT_PUBLIC_V3_PORTAL` | Web build | `false` |

Implementation: `lib/v3/featureFlag.js`, `web/src/lib/v3-api.ts`

## Runtime Sync

| Flag | Default |
|------|---------|
| `V3_RUNTIME_SYNC_ENABLED` | `false` |
| `V3_RUNTIME_SYNC_TENANT_ALLOWLIST` | empty |

Implementation: `lib/v3/runtime/runtimeFeatureFlag.js`

## Test Lab

| Flag | Default |
|------|---------|
| `V3_TEST_LAB_ENABLED` | `false` |
| `V3_TEST_LAB_ALLOW_PRODUCTION` | `false` |

## Per-Tenant Telephony (Database)

`V3FeatureFlag` model — engine, desk, mobile, pstn, transfer, etc.

Managed separately from portal env flags. Used by telephony-v3 worker.

## Testing Flags Locally

```bash
V3_PORTAL_ENABLED=true npm run dev:api
NEXT_PUBLIC_V3_PORTAL=true npm run dev:web
```

## Full Reference

`release/v3.0.0/ENVIRONMENT_VARIABLES.md`

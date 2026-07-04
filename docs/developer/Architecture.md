# V3 Developer Architecture

**Version:** 3.0.0

## Layer Model

```
web/src/app/(app)/v3/     → UI pages
web/src/lib/v3-api.ts     → API client
web/src/components/v3/    → Shared components
routes/v3.js              → HTTP layer (auth, rate limits)
lib/v3/*.js               → Business logic
lib/v3/runtime/*.js       → Runtime adapters (opt-in)
prisma/schema.prisma      → V3 models
```

## Rules for Safe Extension

1. **Never modify protected telephony files** — see `REPOSITORY_INVENTORY.md`
2. **Always scope by `tenantId`** from JWT
3. **Use `auditService.log`** on mutations
4. **Gate new routes** with `requireV3Enabled` + role middleware
5. **Do not bypass Call Control** for server-side call orchestration
6. **Runtime changes** go through adapters + `runtimeEnqueue.js`

## Adding a New Portal Feature

1. Service in `lib/v3/myFeatureService.js`
2. Routes in `routes/v3.js` (correct phase section)
3. Client function in `v3-api.ts`
4. Page in `web/src/app/(app)/v3/my-feature/page.tsx`
5. Nav entry in `portal-nav.ts`
6. Tests in `tests/v3/myFeatureService.test.ts`
7. Migration if schema change (requires separate approval)

## Telephony Boundary

Portal V3 writes **configuration**. Live calls remain on legacy path unless runtime sync + worker enabled.

See `docs/architecture/system-architecture.md`

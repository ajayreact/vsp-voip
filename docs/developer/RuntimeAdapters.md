# V3 Runtime Adapters

**Version:** 3.0.0

## Purpose

Bridge portal configuration mutations to telephony-v3 worker jobs.

## Adapter List

| File | Entity |
|------|--------|
| `extensionRuntimeAdapter.js` | Extensions |
| `numberRuntimeAdapter.js` | Phone numbers |
| `ringGroupRuntimeAdapter.js` | Ring groups |
| `queueRuntimeAdapter.js` | Queues |
| `callFlowRuntimeAdapter.js` | Call flows |
| `businessHoursRuntimeAdapter.js` | Business hours |
| `holidayRuntimeAdapter.js` | Holidays |
| `voicemailRuntimeAdapter.js` | Voicemail |
| `deviceRuntimeAdapter.js` | Desk devices |
| `runtimeAdapter.js` | Base utilities |

## Enqueue Path

```
Service mutation → adapter.sync*() → runtimeEnqueue.js → Redis → worker
```

## Adding a New Adapter

1. Create `lib/v3/runtime/myEntityRuntimeAdapter.js`
2. Implement `enqueueSync(prisma, tenantId, entityId, action)`
3. Call from service on create/update/delete
4. Check `isV3RuntimeSyncEnabled(tenantId)` before enqueue
5. Add tests in `tests/v3/`
6. **Do not** call Telnyx directly from adapter

## Models

- `V3RuntimeSyncJob` — job queue
- `V3RuntimeLink` — entity mapping

## Safe Development

- Default off in all environments
- Test on single allowlisted tenant
- Never enable globally without canary sign-off

See `docs/release/03_RUNTIME_SYNC_CANARY.md`

# Tenant Portal V3 — Call Flows

**RC1:** v3.0.0-rc1

## Purpose

Phase 4 call flow builder: design, validate, and simulate routing logic. **Configuration only in RC1** — live routing requires runtime sync.

## Services

- `lib/v3/callFlowService.js`
- `lib/v3/callFlowNodeService.js`
- `lib/v3/callFlowValidationService.js`
- `lib/v3/callFlowSimulationService.js`
- `lib/v3/callFlowExecutionService.js`

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v3/callflows/node-types` | Available node types |
| POST | `/api/v3/callflows/validate` | Validate definition |
| POST | `/api/v3/callflows/simulate` | Run simulator |
| GET/POST | `/api/v3/callflows` | List/create |
| GET/PUT/DELETE | `/api/v3/callflows/:id` | CRUD |

## UI

- `/v3/callflows` — list
- `/v3/callflows/builder` — visual editor
- `/v3/callflows/simulator` — simulation

## Model

`V3CallFlow` — JSON definition with nodes and edges.

## Runtime

`callFlowRuntimeAdapter.js` enqueues sync jobs when runtime sync enabled.

## Deployment

No telephony impact until `V3_RUNTIME_SYNC_ENABLED=true`.

## Rollback

Delete or revert call flow via API. Runtime rollback via `/api/v3/runtime/repair`.

## Operations

Always validate before publish. Use simulator on staging tenant before production sync.

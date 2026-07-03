# Call Flow Guide — Administrator

**Version:** 3.0.0

![Screenshot placeholder: Call flow builder](/docs/admin/screenshots/call-flow-builder.png)

---

## Overview

Design, validate, and simulate call routing logic. **RC1/GA default:** configuration only — live routing requires runtime sync.

**Routes:** `/v3/callflows`, `/v3/callflows/builder`, `/v3/callflows/simulator`

---

## Workflow

1. Create flow at `/v3/callflows`
2. Open builder — add nodes and edges
3. **Validate** — `POST /api/v3/callflows/validate`
4. **Simulate** — `/v3/callflows/simulator`
5. Publish (status → PUBLISHED)
6. Optional: runtime sync to activate live routing

---

## Node Types

Available via `GET /api/v3/callflows/node-types`

---

## API

| Method | Path |
|--------|------|
| GET | `/callflows` |
| POST | `/callflows` |
| GET/PUT/DELETE | `/callflows/:id` |
| POST | `/callflows/validate` |
| POST | `/callflows/simulate` |

**Model:** `V3CallFlow`

---

## Best Practices

- Always validate before publish
- Simulator prediction ≠ live behavior until sync enabled
- Reference PBX objects via `/pbx/references`
- Test business hours and holiday overrides in simulator

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Validation errors | Check node connections and required fields |
| Simulator mismatch | Expected if runtime sync off |
| Flow not routing live | Enable runtime sync canary |

---

## Related

- `docs/V3/CallFlows.md`
- `docs/release/03_RUNTIME_SYNC_CANARY.md`

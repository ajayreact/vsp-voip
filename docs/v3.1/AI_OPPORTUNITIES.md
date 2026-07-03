# V3.1 AI Opportunities

**Version:** Planning document  
**Date:** 2026-07-03  
**Constraint:** Build on existing Phase 5 AI foundation (`lib/ai-*`); AI disabled by default

---

## Foundation Available

| Asset | Location | Relevance |
|-------|----------|-----------|
| AI gateway + budgets | `lib/ai-*` | Inference routing, redaction |
| Gemini integration | `@google/generative-ai` | LLM provider |
| Phase 5 docs | `docs/vsp/phase5/` | Patterns for summaries, STT |
| V3 health/repair data | `lib/v3/*Health*`, `repairService` | Rich context for AI |
| Audit logs | `auditService` | Training context (privacy-safe) |
| Test Lab reports | `testLabService` | Structured validation data |

---

## Realistic AI Features (V3.1 – V3.3)

### Tier 1 — High Value, Low Risk (V3.1)

| Feature | Description | Data Source | Effort |
|---------|-------------|-------------|--------|
| **Automatic PBX repair suggestions** | Rank repair inspect findings by severity; suggest fix order | `repairService.inspect` output | 2–3 weeks |
| **Migration assistant** | Explain preview diff in plain language; highlight risks | Migration wizard preview JSON | 2 weeks |
| **Tenant health narrative** | Generate health center summary paragraph | Health aggregate JSON | 1–2 weeks |
| **Provisioning assistant** | Step-by-step chat for first employee + extension | Portal context + docs RAG | 3 weeks |
| **Support chatbot (docs RAG)** | Answer "how do I assign a DID?" from V3 docs | `docs/V3/`, `docs/admin/` | 2–3 weeks |

### Tier 2 — Medium Value (V3.2)

| Feature | Description | Data Source | Effort |
|---------|-------------|-------------|--------|
| **Anomaly detection** | Alert when health score drops >20% in 24h | Health snapshots (new table) | 4 weeks |
| **Call quality analysis** | Summarize CallQualityMetric trends | Existing CDR/metrics | 4 weeks |
| **AI troubleshooting** | Given error code, suggest resolution steps | Logs + docs + past incidents | 3 weeks |
| **Test Lab failure explainer** | Plain-language failure analysis | TestLabRun report | 2 weeks |
| **Smart call flow suggestions** | Recommend nodes based on tenant size/industry | Call flow + tenant profile | 4 weeks |

### Tier 3 — Advanced (V3.3+)

| Feature | Description | Dependencies |
|---------|-------------|--------------|
| **AI call insights dashboard** | Post-call summaries, sentiment, action items | Transcription pipeline |
| **Predictive capacity planning** | Forecast extension/DID needs | Multi-tenant analytics |
| **Auto-provisioning from HR feed** | Natural language "add sales team of 5" | SCIM + employee service |
| **Intelligent routing optimizer** | Suggest ring group strategy from call patterns | CDR analytics |
| **Compliance narrative generator** | SOC2 evidence summaries from audit logs | Audit export |

---

## Feature Detail

### 1. Automatic PBX Repair Suggestions

**Input:** Repair inspect JSON  
**Output:** Prioritized action list with confidence scores

```
Example:
🔴 Critical (3): Unlinked extension ext-42 — run repair.apply #1
🟡 Warning (5): Missing caller ID on +12125551234 — assign in /v3/numbers
🟢 Info (2): Stale device lastSeen — verify desk phone registration
```

**Implementation:** LLM prompt with structured inspect output; no auto-apply without admin confirm.

---

### 2. Migration Assistant

**Input:** Migration wizard preview diff  
**Output:** Executive summary + technical checklist

**Safety:** Read-only; never executes migration. Human must click Run.

---

### 3. Tenant Health Predictions

**Input:** 30-day health score time series  
**Output:** "Health trending down — 3 employees missing extensions added this week"

**Requires:** V3.1 `V3HealthSnapshot` table for historical data.

---

### 4. Anomaly Detection

**Approach:** Rule-based first (threshold alerts); ML optional in V3.3

| Signal | Threshold |
|--------|-----------|
| Health score drop | >15% in 24h |
| Failed migration runs | >0 in 7 days |
| Runtime job failure rate | >10% |
| API 5xx spike | >0.1% sustained |

---

### 5. Support Chatbot

**Architecture:**
```
User question → RAG (docs/V3, docs/admin) → LLM → Answer + doc links
```

**Guardrails:**
- Tenant-scoped context only
- No telephony configuration changes via chat
- Escalate to human on low confidence
- Redact PII per Phase 5 AI hardening

---

## AI Non-Goals (V3.1)

- Autonomous migration execution without human approval
- Auto-apply repair without admin confirm
- Real-time call transcription in portal (separate telephony track)
- Customer-facing AI (tenant end-users) — admin only in V3.1
- Training custom models on tenant call recordings (privacy)

---

## Privacy & Compliance

| Requirement | Approach |
|-------------|----------|
| PII redaction | Phase 5 redaction pipeline before LLM |
| Tenant isolation | AI context scoped to JWT tenantId |
| Audit | Log all AI requests with user + tenant |
| Opt-in | `V3_AI_ENABLED` per tenant, default false |
| Data retention | No prompt storage >30 days without policy |
| HIPAA | BAA required before health-related AI features |

---

## Effort Summary

| Tier | Features | Engineer-Weeks |
|------|----------|----------------|
| Tier 1 | 5 | 10–13 |
| Tier 2 | 5 | 15–18 |
| Tier 3 | 5 | 25–35 |
| **V3.1 AI slice (Tier 1 subset)** | 2–3 | **5–7** |

**Recommended V3.1 AI scope:** Repair suggestions + migration assistant + docs chatbot

---

## Related

- `ROADMAP.md` (M12)
- `docs/vsp/phase5/README.md`
- `GAP_ANALYSIS.md`

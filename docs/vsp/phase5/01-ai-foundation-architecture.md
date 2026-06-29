# Phase 5.1 — AI Enterprise Foundation

Enterprise AI platform infrastructure for VSP Phone. **No end-user AI features in this phase.** PBX / telephony paths are unchanged.

---

## Architecture Summary

```
Client (future modules)
        │
        ▼
  routes/ai.js          ← status, settings, usage (JWT + tenant scoped)
        │
        ▼
  lib/ai/aiService.js   ← gates, redaction, retry, logging
        │
   ┌────┴────┬──────────────┬─────────────┐
   ▼         ▼              ▼             ▼
feature   promptManager  contextManager  usageLogger
Flags                      │             │
   │                         │             ▼
   ▼                         │        AiUsageLog (DB)
providers/                   │
(openai, azure,              │
 anthropic, noop, local)     │
                             ▼
                    External LLM APIs
```

### Design principles

1. **Isolated service** — `lib/ai/` is a standalone domain; no imports from Call Control, Telnyx webhooks, or SIP modules.
2. **Async-only** — AI work must run in background jobs or explicit API calls, never in telephony hot paths.
3. **Provider swappable** — `AI_PROVIDER` env + per-tenant override selects OpenAI, Azure, Anthropic, local, or noop.
4. **Tenant isolated** — settings and usage logs are scoped by `tenantId`; JWT auth on all routes.
5. **Security first** — redaction layer blocks JWTs, passwords, SIP URIs, and provisioning tokens before external calls.

---

## Service Flow

1. Future module (e.g. transcription worker) calls `runCompletion()` or `streamCompletion()`.
2. `assertAiReady()` checks platform flag, tenant opt-in, feature flag, and monthly budget.
3. Messages pass through `prepareMessages()` / redaction.
4. Provider selected via `createAiProvider()`.
5. `withAiRetry()` handles transient 429/503 errors.
6. `logAiUsage()` writes structured log + `AiUsageLog` row with token/cost metrics.

---

## Provider Abstraction

| Provider | Env | Notes |
|----------|-----|-------|
| `noop` | default | Safe when AI disabled; returns empty responses |
| `openai` | `OPENAI_API_KEY` | Chat completions + SSE streaming |
| `azure` | `AZURE_OPENAI_*` | Deployment-based Azure OpenAI |
| `anthropic` | `ANTHROPIC_API_KEY` | Messages API + streaming |
| `local` | `LOCAL_LLM_BASE_URL` | OpenAI-compatible local server (future) |

---

## Security Model

**Never sent to providers:**

- SIP credentials
- JWTs / access tokens / refresh tokens
- Passwords
- QR provisioning secrets

**Controls:**

- `piiRedactionEnabled` per tenant (default true)
- `assertSafeForProvider()` blocks requests containing detected secrets
- Logger emits metadata only — not prompt/response bodies (unless `AI_LOG_PROMPT_BODIES=true` in dev)

---

## Tenant Isolation

| Store | Scope |
|-------|-------|
| `TenantAiSettings` | One row per tenant — enable, provider override, feature flags, budget |
| `AiUsageLog` | Append-only usage per tenant |

API routes require `authMiddleware` + active tenant. Settings/usage mutations require `TENANT_ADMIN`.

---

## API Endpoints (Foundation)

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/ai/status` | Authenticated tenant user |
| GET | `/api/ai/settings` | Tenant admin |
| PATCH | `/api/ai/settings` | Tenant admin |
| GET | `/api/ai/usage` | Tenant admin |

No public completion endpoint in Phase 5.1 — modules call `aiService` directly.

---

## Environment Variables

```env
AI_ENABLED=false
AI_PROVIDER=noop
AI_DEFAULT_MODEL=gpt-4o-mini
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=
AZURE_OPENAI_API_VERSION=2024-02-15-preview
LOCAL_LLM_BASE_URL=
AI_MAX_RETRIES=2
AI_RETRY_BASE_DELAY_MS=500
AI_REQUEST_TIMEOUT_MS=60000
```

---

## Future Expansion Path

| Phase | Module | Uses |
|-------|--------|------|
| 5.2 | Voicemail transcription | `runCompletion` + `module.transcription.postprocess` prompt |
| 5.3 | Call summaries | Recording pipeline hook → `aiService` (read-only) |
| 5.4 | Message suggestions | Messaging UI → feature flag `message_suggestions` |
| 5.5 | Knowledge base / RAG | `contextManager` + vector store (new tables) |

See also: `docs/vsp/roadmap/09-ai-roadmap.md`

---

## Telephony Impact

**NONE**

- No changes to Call Control, Telnyx webhooks, SIP registration, or WebRTC.
- New routes mounted alongside existing `/api` routers.
- Schema migration adds **new tables only** — no PBX column changes.

---

## Backend Changes

**Additive only:**

- `lib/ai/*` — AI platform
- `routes/ai.js` — REST foundation
- `prisma` — `TenantAiSettings`, `AiUsageLog`
- `server.js` — mount AI routes

**Frozen (unchanged):** Call Control, Telnyx integration, SIP, auth issuance, extension routing, QR provisioning backend.

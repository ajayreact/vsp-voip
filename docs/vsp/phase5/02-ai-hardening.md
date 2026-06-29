# Phase 5.1.1 — AI Foundation Hardening & Enterprise Readiness

Hardens the Phase 5.1 AI platform for future enterprise modules. **No end-user AI features** are added. AI remains **disabled by default**.

## Architecture

```
Future AI module (async worker)
        │
        ▼
  runCompletion() / streamCompletion()   ← lib/ai/gateway.js
        │
        ├── Feature flags & tenant policies
        ├── Budget enforcement (hard stop)
        ├── Redaction & safety checks
        ├── Usage & cost logging
        └── Provider manager
                │
                ├── gemini (Google SDK)
                ├── openai / azure / anthropic / local
                └── noop (default)
```

**Rule:** Application code must never call providers directly. Always use the gateway.

## Provider manager

`lib/ai/providerManager.js` handles:

- Provider selection from `AI_PROVIDER` and tenant `allowedProvider`
- Initialization and lazy provider instances
- Health checks (`checkProviderHealth`)
- Configuration validation (`validateConfiguration`)
- Failover hooks (framework only; disabled by default)

Supported providers: `noop`, `gemini`, `openai`, `azure`, `anthropic`, `local`.

## Gemini integration

| Variable | Purpose |
|----------|---------|
| `AI_PROVIDER=gemini` | Select Gemini |
| `GEMINI_API_KEY` | API key |
| `AI_MODEL` | Model name (default from config; not hardcoded in code paths) |

Implementation: `lib/ai/providers/gemini.js` using `@google/generative-ai`.

Features: text completion, streaming, timeout, retry (completion path).

## AI gateway

`lib/ai/gateway.js` exports:

- `runCompletion(prisma, params)` — non-streaming completion
- `streamCompletion(prisma, params)` — async generator stream
- `getAiStatus()` — platform health snapshot

Gateway responsibilities:

1. Platform and tenant enablement
2. Feature flag validation
3. Daily/monthly budget validation (hard stop, no overage)
4. PII/secret redaction before external calls
5. Context preparation
6. Provider selection via provider manager
7. Retry (completion only)
8. Failover chain when `AI_FAILOVER_ENABLED=true`
9. Usage and cost logging to `AiUsageLog`

## Tenant AI policies

Extended `TenantAiSettings` fields:

| Field | Behavior |
|-------|----------|
| `dailyBudgetCents` | Hard stop when daily spend reached |
| `monthlyBudgetCents` | Hard stop when monthly spend reached |
| `allowedProvider` | Restrict provider for tenant |
| `allowedModel` | Restrict model for tenant |
| `maxTokens` | Cap completion tokens |
| `temperature` | Default sampling temperature |
| `streamingEnabled` | Allow or block streaming |
| `features` | Per-feature toggles (all off by default) |

## Prompt versioning

Versioned prompts live under `lib/ai/prompts/`:

```
call_summary_v1.md
call_summary_v2.md
message_reply_v1.md
voicemail_summary_v1.md
```

Naming: `{name}_v{version}.md` with YAML frontmatter (`name`, `version`, `author`).

`lib/ai/promptManager.js`:

- Registers all versions at startup
- Tracks name, version, checksum (SHA-256), author, last modified
- **Never overwrites** an existing version
- Use `renderPromptVersion(name, version, vars)` for explicit versions
- Use `renderPrompt(name, vars)` for latest version

## Health monitoring

`GET /api/ai/status` returns (no secrets):

- `provider`, `enabled`, `healthy`
- `selectedModel`, `responseLatencyMs`
- `lastSuccessfulRequest`, `lastFailure`
- `providerVersion`, `configurationStatus`

State is maintained in `lib/ai/healthMonitor.js` (in-memory).

## Metrics

Logged via `lib/ai/usageLogger.js` to `AiUsageLog`:

- Requests, latency, completion time
- Prompt/completion/total tokens
- Estimated cost (micros)
- Provider, tenant, module
- Stream usage, retry count (metadata)

## Security model

`lib/ai/redaction.js` detects and redacts:

- JWT, Bearer tokens, Authorization headers
- Passwords, SIP passwords, phone credentials
- QR secrets, provisioning payloads
- Access/refresh tokens, cookies

Unsafe payloads are **rejected** (`AiRedactionError`) when redaction cannot sanitize.

## Failover framework

`lib/ai/failover.js` — **disabled by default**.

```
AI_FAILOVER_ENABLED=false
AI_FAILOVER_CHAIN=gemini,openai,noop
```

When enabled, gateway tries providers in order on timeout/rate-limit errors. Not auto-enabled in production.

## Telephony isolation

AI must **never** run inside:

- Call Control, webhooks, WebRTC, SIP registration
- Incoming call routing, call state machine
- Messaging hot path

Future modules use **background workers** and call the gateway asynchronously only.

## Future RAG (placeholder)

No implementation in 5.1.1. See [03-rag-architecture-placeholder.md](./03-rag-architecture-placeholder.md).

## Migration

Apply after Phase 5.1 foundation migration:

```
prisma/migrations/20260624153000_phase511_ai_hardening/migration.sql
```

## Environment

See `.env.example` for `GEMINI_API_KEY`, `AI_MODEL`, `AI_FAILOVER_*`.

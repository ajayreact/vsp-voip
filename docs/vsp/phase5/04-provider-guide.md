# AI Provider Guide

## Selection

Platform default: `AI_PROVIDER=noop` (AI disabled).

Tenant override: `TenantAiSettings.allowedProvider`.

Provider manager resolves the effective provider and validates configuration before external calls.

## Providers

| Provider | Env vars | Notes |
|----------|----------|-------|
| `noop` | None | Default; returns empty/stub responses |
| `gemini` | `GEMINI_API_KEY`, `AI_MODEL` | Google Generative AI SDK |
| `openai` | `OPENAI_API_KEY`, `AI_MODEL` | Chat completions |
| `azure` | `AZURE_OPENAI_*` | Azure OpenAI deployment |
| `anthropic` | `ANTHROPIC_API_KEY` | Messages API |
| `local` | `LOCAL_LLM_BASE_URL` | OpenAI-compatible local server |

## Adding a new provider

1. Create `lib/ai/providers/{name}.js` extending `BaseProvider`
2. Implement `complete()` and `stream()`
3. Register in `lib/ai/providers/index.js` `createAiProvider` switch
4. Add to `SUPPORTED_PROVIDERS` in `lib/ai/config.js`
5. Add configuration validation in `validateProviderConfiguration`
6. Add pricing entry in `lib/ai/costTracker.js` (optional)
7. Do **not** expose provider to application modules — gateway only

## Failover

Configure chain (framework only):

```env
AI_FAILOVER_ENABLED=false
AI_FAILOVER_CHAIN=gemini,openai,noop
```

Gateway uses chain only when failover is enabled and error is failover-eligible (timeout, rate limit).

## Health checks

`providerManager.checkProviderHealth(name)` validates config and optionally probes noop/local.

Runtime success/failure recorded in `healthMonitor` for `/api/ai/status`.

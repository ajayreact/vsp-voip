# Phase 5.4 — AI Enterprise Assistant (Copilot)

Natural-language enterprise search and insights across calls, messages, voicemails, contacts, AI summaries, and transcripts.

## Architecture

```
User question (Mobile / Web)
        ↓
POST /api/ai/assistant/query | /stream
        ↓
Intent classification (rule-based)
        ↓
executeSearchPlan() — Prisma read-only, tenant-scoped
        ↓
buildAssistantContext() — redacted JSON context
        ↓
runCompletion() / streamCompletion() — AI Gateway
        ↓
Structured JSON response + search results
        ↓
In-memory query cache (60s TTL)
```

**No database changes.** Conversation history is client-side only.

## Intent flow

| Intent | Trigger examples | Data sources |
|--------|------------------|--------------|
| `search_calls` | missed calls, today's calls | `CallLog` |
| `search_messages` | unread SMS | `Message` |
| `search_voicemails` | find voicemail | `Voicemail` |
| `search_contacts` | find John, extensions | `Extension` |
| `daily_summary` | summarize today | calls + VM + messages + summaries |
| `customer_summary` | summarize customer | multi-source |
| `follow_up_detection` | need follow-up | `AiSummary` |
| `callback_recommendations` | callbacks today | summaries + voicemails |
| `priority_detection` | high priority VM | `AiSummary` priority |
| `conversation_search` | pricing conversations | messages + transcripts + summaries |
| `general_search` | fallback broad search | all sources |

Structured filters run **before** LLM invocation to minimize tokens and hallucination.

## Search strategy

- Tenant isolation: all queries include `tenantId`
- No data duplication — reads existing tables + `AiSummary` / `AiTranscript`
- Result cap per source (8–30 items)
- Context JSON capped and redacted via `lib/ai/redaction.js`

## AI prompt design

System prompt instructs Gemini to:
- Use **only** provided context JSON
- Return **JSON only** (summary, insights, suggestedActions, followUps)
- Never invent records or expose secrets

Feature flag: `ai_assistant` (disabled by default).

## Security

- AI Gateway: budgets, tenant policies, usage logging
- Redaction on all context strings
- No JWT/passwords/SIP/QR data in LLM context
- `assertTenantActive` on all routes

## Performance

- **Streaming:** `POST /api/ai/assistant/stream` (SSE) when tenant `streamingEnabled`
- **Cache:** in-memory 60s TTL per tenant+question hash
- **Cancel:** client `AbortController` aborts stale stream requests
- **Non-blocking:** async search + stream; telephony untouched

## API endpoints

| Method | Path |
|--------|------|
| GET | `/api/ai/assistant/suggestions` |
| POST | `/api/ai/assistant/query` |
| POST | `/api/ai/assistant/stream` |

## Mobile

New **AI** tab → `AssistantScreen` with search bar, suggested prompts, conversation history, result cards, copy/share.

## Web

`/assistant` — Enterprise Assistant page in portal nav (AI section).

## Future enhancements

- RAG / knowledge base integration (`knowledge_base` feature)
- Persistent conversation sessions (optional DB)
- Deep links from result cards to detail screens
- Tool-calling for actions (call back, mark read)
- Semantic vector search over transcripts

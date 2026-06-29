# Phase 5.2 — AI Voicemail Summary

## Architecture

```
Voicemail available (async trigger)
        ↓
Build transcript (STT or metadata fallback)
        ↓
summaryQueue → summaryWorker
        ↓
runCompletion() via AI Gateway
        ↓
Parse & validate JSON
        ↓
AiSummary table (entityType=voicemail)
        ↓
GET /api/ai/summaries/voicemail/:id
        ↓
Mobile / Web AiSummaryCard
```

AI never runs inside voicemail save, webhooks, or push handlers.

## Data flow

1. Client calls `POST /api/ai/summaries/voicemail/:id/generate` (202 Accepted)
2. Job enqueued via `lib/ai/modules/summaryQueue.js`
3. `voicemailSummary.js` loads voicemail, builds transcript, calls gateway
4. Structured JSON stored in `AiSummary.result`
5. Client polls `GET` until `status=completed`

## JSON schema

```json
{
  "summary": "string",
  "keyPoints": ["string"],
  "actionItems": ["string"],
  "priority": "Low|Medium|High",
  "sentiment": "string",
  "confidence": 0.95,
  "callbackRecommendation": "Recommended|Not Recommended|Unknown",
  "generatedAt": "ISO-8601",
  "provider": "gemini",
  "model": "gemini-2.5-flash"
}
```

## Failure handling

| Status | Meaning |
|--------|---------|
| `unavailable` | Platform/tenant/feature disabled |
| `not_generated` | No summary yet |
| `pending` / `processing` | Job queued or running |
| `failed` | Provider/parse error — retry via POST generate |

## Retry strategy

- Gateway retry policy applies to `runCompletion`
- Client retry via Refresh / Generate button
- Failed jobs store `errorCode` and `errorMessage`

## Security

- AI Gateway only (never direct provider calls)
- Feature flag: `voicemail_summary`
- Tenant budgets enforced before external calls
- Redaction applied to transcript content

## Future enhancements

- Speech-to-text integration for real transcripts
- Auto-enqueue on voicemail create (background worker)
- Push notification when summary ready

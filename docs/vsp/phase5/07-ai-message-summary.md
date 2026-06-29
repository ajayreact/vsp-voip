# Phase 5.2 — AI Message Summary

## Architecture

```
Conversation exceeds threshold (default 10 messages)
        ↓
Async generate request
        ↓
Build transcript from Message rows
        ↓
runCompletion() — feature: message_summary
        ↓
AiSummary (entityType=conversation)
        ↓
Mobile ConversationThread / Web SMS inbox
```

## Data flow

1. `GET /api/ai/summaries/conversation/:id` — current status
2. `POST /api/ai/summaries/conversation/:id/generate` — enqueue if threshold met
3. Messages loaded from `Message` table (not messaging hot path)
4. Prompt: `message_summary_v1.md`

## Threshold

`AI_MESSAGE_SUMMARY_MIN_MESSAGES=10` (env). Override with `force: true` in POST body (admin/testing).

## JSON schema

```json
{
  "summary": "string",
  "conversationSummary": "string",
  "keyPoints": ["string"],
  "outstandingQuestions": ["string"],
  "actionItems": ["string"],
  "unreadRequests": ["string"],
  "customerIntent": "string",
  "latestDecision": "string",
  "priority": "Low|Medium|High",
  "sentiment": "string",
  "confidence": 0.0,
  "generatedAt": "ISO-8601",
  "provider": "string",
  "model": "string"
}
```

## Failure handling

- `MESSAGE_THRESHOLD_NOT_MET` (409) below minimum message count
- `EMPTY_CONVERSATION` when no text bodies
- Standard gateway failures → `failed` status

## Retry strategy

Client polling every 3s while `pending`/`processing`. Manual retry on failure.

## Security

Message bodies redacted before provider. Secrets in SMS blocked via redaction layer.

## Future enhancements

- Per-tenant threshold in `TenantAiSettings`
- Incremental summary updates on new messages
- Suggested reply module (separate feature flag)

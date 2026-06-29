# Phase 5.2 — AI Call Summary

## Architecture

```
Call completed (async trigger only — never during live call)
        ↓
Transcript (future STT or metadata fallback)
        ↓
summaryQueue → AI Worker
        ↓
runCompletion() — feature: call_summary
        ↓
AiSummary (entityType=call)
        ↓
Mobile CallDetails / Web Call History
```

## Data flow

- Trigger: `POST /api/ai/summaries/call/:id/generate`
- Validates call exists and is completed (`endedAt` or `status=completed`)
- Prompt: `call_summary_v1.md` (JSON output)
- Retrieve: `GET /api/ai/summaries/call/:id`

## JSON schema

```json
{
  "summary": "string",
  "executiveSummary": "string",
  "keyPoints": ["string"],
  "discussionTopics": ["string"],
  "customerIntent": "string",
  "actionItems": ["string"],
  "followUpTasks": ["string"],
  "sentiment": "string",
  "salesOpportunity": "string",
  "priority": "Low|Medium|High",
  "confidence": 0.0,
  "generatedAt": "ISO-8601",
  "provider": "string",
  "model": "string"
}
```

## Failure handling

- `CALL_NOT_COMPLETED` (409) if summary requested before call ends
- Malformed JSON → `failed` status with `AI_MALFORMED_RESPONSE`
- Budget exceeded → 429, no overage

## Retry strategy

Gateway retries on provider timeout/rate limit. Client retries via UI.

## Security

Same as Phase 5.1.1 gateway: flags, budgets, redaction, usage logging.

## Future enhancements

- Hook from softphone call-log POST (enqueue only, no sync AI)
- Recording transcription pipeline
- CRM export of action items

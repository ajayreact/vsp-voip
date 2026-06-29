# Phase 5.3 — Enterprise Speech-to-Text Foundation

Production-ready transcription platform isolated from telephony. Powers AI Call Summary, Voicemail Summary, future search and analytics.

## Architecture

```
POST /api/ai/transcripts/*/generate
        ↓
transcriptionQueue (async)
        ↓
fetchEntityAudio() — read-only via recordingSync
        ↓
runTranscription() — STT Gateway
        ↓
Provider (OpenAI Whisper / noop / future)
        ↓
AiTranscript table
        ↓
automatic_summary → AI Summary (if enabled, no duplicates)
```

**Never runs in:** webhooks, call control, voicemail save, messaging hot paths.

## Provider abstraction

`lib/ai/transcription/providers/` — same pattern as AI LLM providers.

| Provider | Env | Status |
|----------|-----|--------|
| `noop` | None | Default |
| `openai` | `OPENAI_API_KEY`, `STT_MODEL` | Whisper API implemented |
| `google` | `GOOGLE_SPEECH_API_KEY` | Stub (falls back to noop) |
| `azure` | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Stub |
| `deepgram` | `DEEPGRAM_API_KEY` | Stub |
| `assemblyai` | `ASSEMBLYAI_API_KEY` | Stub |
| `local` | `LOCAL_WHISPER_BASE_URL` | OpenAI-compatible local endpoint |

Configure via `STT_PROVIDER=openai`.

## Transcription Gateway

`runTranscription(prisma, params)` in `lib/ai/transcription/gateway.js`:

- Feature flag validation (master + entity-specific)
- Tenant budget enforcement (shared AI budgets)
- Provider selection via `transcriptionProviderManager`
- Retry with exponential backoff
- Timeout (`STT_REQUEST_TIMEOUT_MS`)
- Usage logging to `AiUsageLog` (operation: `transcription`)
- Cost tracking via duration (`calculateSttCostMicros`)
- Language detection when `language_detection` feature enabled

**Security:** Only audio buffers sent to external providers. No JWT, passwords, SIP credentials, or headers.

## Transcript storage

**Model:** `AiTranscript` (Prisma)

| Field | Purpose |
|-------|---------|
| `entityType` | `voicemail`, `call`, `meeting` (future) |
| `entityId` | Source record ID |
| `transcript` | Full text |
| `confidence` | 0–1 score |
| `detectedLanguage` | ISO language code |
| `provider`, `model` | STT provider metadata |
| `durationSeconds` | Audio duration |
| `processingTimeMs` | Wall-clock processing time |
| `status` | `pending`, `processing`, `completed`, `failed` |

Unique on `(tenantId, entityType, entityId)` — prevents duplicate transcripts.

## Queue

`lib/ai/transcription/transcriptionQueue.js` — in-process async queue using `setImmediate`. Replaceable with Bull/SQS without API changes.

## AI integration

After successful transcription:

1. If `automatic_summary` + entity summary feature enabled
2. And no existing summary in `processing` or `completed` state
3. Enqueue `enqueueSummaryGeneration()` with real transcript

Summary modules (`voicemailSummary.js`, `callSummary.js`) read stored transcripts via `getStoredTranscriptText()` before falling back to metadata stubs.

## Feature flags

All disabled by default in `TenantAiSettings.features`:

| Flag | Purpose |
|------|---------|
| `transcription` | Master STT toggle |
| `call_transcription` | Call recordings |
| `voicemail_transcription` | Voicemail recordings |
| `language_detection` | Auto-detect language via provider |
| `automatic_summary` | Auto-trigger AI summary after STT |

## API endpoints

| Method | Path |
|--------|------|
| GET | `/api/ai/transcripts/voicemail/:id` |
| POST | `/api/ai/transcripts/voicemail/:id/generate` |
| GET | `/api/ai/transcripts/call/:id` |
| POST | `/api/ai/transcripts/call/:id/generate` |

## Retry and failure

- Gateway retries provider errors 429/502/503/504
- Failed jobs store `errorCode` / `errorMessage` on `AiTranscript`
- Client retry via Generate / Refresh buttons
- Duplicate generate requests return existing completed transcript

## Cost

Whisper-1 priced at ~$0.006/minute (stored as microdollars in `costTracker.js`). Logged to `AiUsageLog` with `operation=transcription`.

## Future AI integration

- AI Search over `AiTranscript.transcript`
- Meeting transcription (`entityType=meeting`)
- Real-time streaming STT (separate phase)
- Auto-enqueue on recording availability (background worker)

## Migration

```
prisma/migrations/20260624180000_phase53_ai_transcripts/migration.sql
```

Apply after Phase 5.2 AI summaries migration.

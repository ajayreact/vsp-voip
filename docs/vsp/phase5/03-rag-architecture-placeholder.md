# Future RAG Architecture (Placeholder)

Phase 5.1.1 prepares the AI gateway and provider layer only. **No RAG implementation**, vector database, or embeddings dependencies are included.

## Planned components (future phases)

| Component | Responsibility |
|-----------|----------------|
| **Embeddings** | Convert documents/chunks to vectors via provider or dedicated embedding model |
| **Vector Store** | Persist and query embeddings (TBD: pgvector, managed service, etc.) |
| **Knowledge Base** | Tenant-scoped document collections, access control, sync |
| **Retrieval** | Similarity search, reranking, context assembly for prompts |
| **Document Index** | Ingestion pipeline, chunking, metadata, checksums |

## Integration point

Future RAG modules will:

1. Run asynchronously (never on telephony hot paths)
2. Call `runCompletion()` / `streamCompletion()` through `lib/ai/gateway.js`
3. Inject retrieved context via `lib/ai/contextManager.js`
4. Respect tenant policies, budgets, and redaction

## Out of scope for 5.1.1

- No vector database
- No embedding API calls
- No document upload or indexing APIs
- No new npm dependencies for RAG

This document is architecture-only until a dedicated RAG phase is scheduled.

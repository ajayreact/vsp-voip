# Phase 4.4 — Enterprise Messaging Architecture

Rules for the React Native Messages module. **Backend is frozen** — all behavior below is implemented client-side on top of existing APIs.

---

## UX principles

| Rule | Implementation |
|------|----------------|
| Never wait on the server for UI | Optimistic inserts + React Query cache patches |
| No manual refresh | Background sync merges deltas only |
| No full thread rebuild on send/receive | `messagingQueryCache.ts` upserts single messages |
| Instant send feedback | `Sending…` → `Sent` → `Delivered` via status reconciliation |
| Failed sends stay visible | Status `failed` + long-press **Retry send** |
| Scroll preserved when reading history | FlashList `maintainVisibleContentPosition` |
| New messages while scrolled up | `NewMessagesBanner` + `messagingUiStore` |

---

## State architecture

```
React Query (source of truth cache)
├── ['messaging', 'conversations']   → infinite conversation list
└── ['messaging', 'thread', id]      → infinite message pages

messagingQueryCache.ts               → incremental cache mutations (no invalidate)
messagingUiStore.ts                  → scroll-at-bottom + new-message indicator
conversationPreferencesStore.ts      → pin / archive / hide (local)
messagePreferencesStore.ts           → local message hide
outboxStore.ts                       → offline send queue
```

List and thread screens read the **same** React Query keys. Mutations from send, sync, or outbox flush update both layers through shared cache helpers.

---

## Optimistic send flow

1. User taps **Send**
2. `buildOptimisticMessage` → status `sending`, `_optimistic: true`
3. `upsertThreadMessage` + `upsertConversationSummary` (instant UI)
4. `sendPlatformMessage` API call in background
5. **Success:** `reconcileOptimisticThreadMessage` replaces temp id with server message
6. **Failure:** `patchThreadMessage` → `failed`; message remains; outbox enqueued for retry

---

## Real-time / background sync

| Component | Interval | Behavior |
|-----------|----------|----------|
| `MessagingSyncProvider` | 10s | Fetches conversations → `mergeConversationListFromServer` |
| `useThreadBackgroundSync` | 8s | Fetches recent messages → `mergeInboundThreadMessages` |
| `syncThreadOnOpen` | On thread mount | Loads missing messages only (push / resume) |
| `outboxFlush` | 15s + reconnect | Sends queued messages; reconciles cache |

**Never** calls `queryClient.invalidateQueries(['messaging'])`.

---

## Performance

- **FlashList** for conversation list and thread
- **Memoized** row components (`VspConversationRow`, `VspMessageBlock`)
- **Pagination** via infinite queries (50 messages per page)
- **staleTime** 30s on thread queries to avoid redundant refetches
- **Incremental updates** only — changed messages and conversations

---

## Offline

- Recent conversations cached via existing `conversationCache.ts`
- Outgoing messages queued in `outboxStore`
- `flushMessagingOutbox` retries when connectivity returns
- UI never blocked; failed items show **Failed** with retry

---

## Push notifications

`PushNotificationProvider` → `navigateToConversation` → thread mounts → `syncThreadOnOpen` loads only missing messages into cache. No module reload.

---

## Backend boundary

**Do not modify:** APIs, schema, auth, SMS backend, Telnyx integration, or API contracts.

Missing APIs (pin/archive/delete conversation) remain **client-only** — report to backend team if cross-device sync is required.

---

## Tests

```bash
npm run test:mobile
```

- `tests/mobile/messaging-query-cache.test.ts` — cache merge / reconcile
- `tests/mobile/messaging-phase44.test.ts` — preferences / display

---

## Related

- [PHASE4-4-MESSAGING.md](./PHASE4-4-MESSAGING.md) — feature checklist
- [Phase 4 mobile rules](../../docs/vsp/phase4/03-mobile-development-rules.md)

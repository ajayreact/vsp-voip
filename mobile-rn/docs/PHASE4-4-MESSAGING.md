# Phase 4.4 — Business Messaging Module

Premium enterprise SMS client for `mobile-rn/`. **No backend changes** — reuses existing `/api/conversations`, `/api/messages/send`, and push infrastructure.

---

## Features

| Screen | Status | Notes |
|--------|--------|-------|
| Conversations | Done | FlashList, search, pull refresh, infinite scroll, swipe pin/archive/delete |
| Conversation thread | Done | Header, date separators, delivery status, long-press actions |
| Compose | Done | Contact search, manual number, business DID, SMS preview |
| Global search | Done | Contact, number, preview, cached message bodies |
| Offline outbox | Existing | `outboxStore` + `outboxFlush` — unchanged |
| Push deep link | Existing | `PushNotificationProvider` → conversation thread |

---

## Client-only actions (no backend API)

Pin, archive, and delete conversation are stored in `conversationPreferencesStore` (AsyncStorage). Delete message uses `messagePreferencesStore`. Server records are unchanged.

**Report to backend team** if server-side pin/archive/delete APIs are required for cross-device sync.

---

## Architecture

See **[PHASE4-4-MESSAGING-ARCHITECTURE.md](./PHASE4-4-MESSAGING-ARCHITECTURE.md)** for enterprise rules (optimistic UI, incremental sync, shared cache).

```
messagingService.ts     → existing REST APIs
messagingQueryCache.ts  → incremental React Query updates (no invalidate)
messagingUiStore.ts     → scroll / new-messages indicator
useConversations.ts     → React Query + offline cache
conversationPreferencesStore.ts  → pin / archive / hide
messagePreferencesStore.ts       → local message hide
messageSearch.ts        → global search (device cache)
ConversationListScreen  → inbox / archived segments
```

Future-ready types: `FutureMessageCapabilities` in `messaging/types.ts` (MMS, AI — not implemented).

---

## Tests

```bash
npm run test:mobile
```

- `tests/mobile/messaging-phase44.test.ts`
- `tests/mobile/messaging-query-cache.test.ts`
- `tests/mobile/message-search.test.ts`

---

## Related docs

- [Phase 4 development rules](../../docs/vsp/phase4/03-mobile-development-rules.md)
- [DESIGN.md](./DESIGN.md)

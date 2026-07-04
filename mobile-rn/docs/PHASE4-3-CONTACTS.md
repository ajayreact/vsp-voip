# Phase 4.3 — Enterprise Contacts & Company Directory

Premium contacts hub for `mobile-rn/`. **No backend changes** — company directory uses existing `/api/tenant/extensions`.

---

## Screens

| Screen | File | Status |
|--------|------|--------|
| Contacts hub | `ContactsListScreen.tsx` | Company / Customers / Favorites / Recent segments |
| Company detail | `ContactDetailScreen.tsx` | Presence, call/message/favorite/share, future placeholders |
| Customer detail | `CustomerContactDetailScreen.tsx` | Client-only customer records |
| Customer form | `CustomerContactFormScreen.tsx` | Add / edit local customer contacts |

---

## Architecture

```
useContactsDirectory()     → shared React Query key ['contacts','directory']
useMessagingContacts()     → same key (no duplicate fetch)
contactCache.ts            → offline AsyncStorage for company directory
customerContactsStore.ts   → offline AsyncStorage for customer contacts
contactSearch.ts           → instant local search (no search button)
recentContacts.ts          → derived from calls + messages
contactActions.ts          → call / message / navigation helpers
```

---

## Categories

| Category | Source |
|----------|--------|
| Company directory | `GET /api/tenant/extensions` (ACTIVE) |
| Customer contacts | **Device-local only** — see missing API below |
| Favorites | `favoritesStore` (`customer:{id}` or extension id) |
| Recent | Calls + message conversations |

---

## Presence (existing backend data)

| State | Signal |
|-------|--------|
| Online | `registration.isLive` |
| Offline | not live |
| Do not disturb | `features.doNotDisturb` |
| On call | active/incoming call peer match |
| Unknown | customer / unresolved |

Background refresh: `refetchInterval: 30s` on directory query.

---

## Missing backend API (report only)

**Customer / CRM contacts** — no tenant customer contact API exists. Customer contacts are stored locally on device (`customerContactsStore`). For cross-device sync, backend team should add e.g. `GET/POST /api/tenant/customer-contacts`.

---

## Tests

```bash
npm run test:mobile
```

- `tests/mobile/contact-directory.test.ts`

---

## Related

- [Phase 4 sequence](../../docs/vsp/phase4/04-development-sequence.md)

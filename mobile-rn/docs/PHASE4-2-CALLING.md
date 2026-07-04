# Phase 4.2 — Premium Calling Experience

Enterprise calling UI for `mobile-rn/`. **No backend or telephony stack changes** — reuses `TelnyxCallingProvider`, `callingController`, and existing softphone APIs.

---

## Screens

| Screen | File | Status |
|--------|------|--------|
| Home | `screens/dashboard/DashboardScreen.tsx` | Profile, registration, quick-action cards, favorites, recent calls |
| Dial Pad | `screens/calls/DialPadScreen.tsx` | Square keys, haptics, paste, suggestions, animated call button |
| Incoming | `screens/calls/IncomingCallScreen.tsx` | Caller card, HD badge, ripple + slide-in, locked identity after answer |
| Outgoing / In-call | `screens/calls/ActiveCallScreen.tsx` | State-only updates (Calling → Connected), controls, audio route |
| Call overlay | `calling/CallOverlay.tsx` | Slide modal presentation |

---

## Navigation

- **Home** tab added as first tab (`initialRouteName="Home"`)
- Quick cards: Dial Pad, Contacts, Messages, Voicemail, Call History

---

## Components

```
components/calls/
├── CallCallerCard.tsx      — Large caller card + audio route chip
├── CallControlButton.tsx   — Animated enterprise call controls
├── AnimatedCallButton.tsx  — Dial + delete animations
└── DialPadSuggestions.tsx  — Contact + recent number chips
```

---

## Call UX rules

| Rule | Implementation |
|------|----------------|
| Never reload call screen | Same modal + memoized screens; patch Zustand snapshot only |
| Caller info frozen after answer | `identityLocked` on `CallSessionSnapshot` |
| Audio route visible | `useAudioRoute` + `AudioRouteChip` |
| 60 FPS target | Reanimated springs, memoized rows, FlashList on recents (unchanged) |

---

## Telephony boundary

**Unchanged:** SIP registration, WebRTC, Call Control, push, `callingController` dial/answer/hangup flow.

**Minimal mobile-only UX fix:** Removed post-answer caller identity patch (UI stays stable; CDR still tracks PSTN via `updateTrackedRemoteNumber`).

---

## Tests

```bash
npm run test:mobile
```

- `tests/mobile/call-display.test.ts`

---

## Related

- [DESIGN.md](./DESIGN.md)
- [Phase 4 sequence](../../docs/vsp/phase4/04-development-sequence.md)

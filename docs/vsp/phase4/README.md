# VSP Phone — Phase 4

**React Native mobile application only.**

Phase 2 PAT is complete and the backend is **feature-frozen**. All new product work in Phase 4 happens in `mobile-rn/` unless a production bug requires a minimal backend fix.

| Item | Detail |
|------|--------|
| **Status** | Active — 4.1 complete, **4.2 Calling UI next** |
| **Codebase** | `mobile-rn/` |
| **Backend baseline tag** | `phase2-production-ready` (`1c1fb1d`) |
| **Backend changes** | Bug fixes discovered during mobile development only |

---

## Scope (in scope)

| Feature | Document |
|---------|----------|
| Feature matrix & current status | [01-mobile-feature-matrix.md](./01-mobile-feature-matrix.md) |
| **Phase 4.1 — Authentication** | [../../../mobile-rn/docs/PHASE4-1-AUTH.md](../../../mobile-rn/docs/PHASE4-1-AUTH.md) |
| Backend freeze rules | [02-backend-freeze-rules.md](./02-backend-freeze-rules.md) |
| **Mobile development rules** | [03-mobile-development-rules.md](./03-mobile-development-rules.md) |
| **Development sequence (4.2–4.5)** | [04-development-sequence.md](./04-development-sequence.md) |
| Mobile design system | [../../../mobile-rn/docs/DESIGN.md](../../../mobile-rn/docs/DESIGN.md) |
| Firebase / push setup | [../../../mobile-rn/docs/ANDROID-FIREBASE-SETUP.md](../../../mobile-rn/docs/ANDROID-FIREBASE-SETUP.md) |

### Phase 4 build order

See [04-development-sequence.md](./04-development-sequence.md).

| Phase | Features |
|-------|----------|
| **4.1** ✅ | QR Login, Remember Me, Biometric, Auto-login, Session management |
| **4.2** | Home, Dial Pad, Incoming, Outgoing, In-Call Screen |
| **4.3** | Contacts, Favorites, Recents, Call History, Voicemail |
| **4.4** | SIP Configuration, Desk Phone QR, Audio, Notifications, Profile |
| **4.5** | Animations, skeletons, FlashList, memory, native transitions |

---

## Out of scope

Do **not** implement in Phase 4:

| Area | Reason |
|------|--------|
| New PBX features (IVR builder, new routing rules, etc.) | Backend frozen |
| Browser WebRTC / softphone re-enablement | Phase 2 admin-only browser policy |
| Database schema changes | Frozen unless bug fix requires it |
| Call Control / Telnyx handler refactors | Frozen |
| Flutter `mobile/` | Removed in Phase 2.8 |
| Tenant portal feature work | Phase 2 complete; bug fixes only |

---

## Development rules (mandatory)

**[03-mobile-development-rules.md](./03-mobile-development-rules.md)** — mandatory for all Phase 4 work.

| Principle | Rule |
|-----------|------|
| Scope | `mobile-rn/` only |
| Backend | Frozen — stop and report bugs; no mobile workarounds |
| APIs | Existing backend is source of truth |
| Telephony | Reuse production flows; verify Telnyx docs before changes |
| UI/UX | Premium enterprise modernization; preserve functionality |
| Performance | 60 FPS, FlashList, memoization, lazy loading |
| Features | Complete one fully before starting the next |
| Handoff | Use mandatory reporting format in § Reporting |

---

## Commit pattern

```bash
# Mobile-only change
npm run test:mobile

# Mobile + backend bug fix
npm run test:mobile
npm run test:telephony
```

Prefix commits: `feat(mobile):`, `fix(mobile):`, or `fix(api):` (bug fix only).

---

## Related docs

- [Phase 2 completion & PAT](../phase2/10-production-acceptance.md)
- [Backend freeze](../phase2/06-backend-telephony-freeze.md)
- [Mobile roadmap (product)](../roadmap/08-mobile-roadmap.md)
- [PBX mobile reference](../pbx/19-mobile-app.md) — update to React Native in Phase 4

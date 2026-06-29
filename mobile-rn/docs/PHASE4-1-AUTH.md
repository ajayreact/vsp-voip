# Phase 4.1 — Authentication & Device Provisioning

Production-ready authentication for `mobile-rn/`. Backend APIs are **frozen** — all work is client-side.

---

## Features

| Feature | Status | Implementation |
|---------|--------|----------------|
| Remember Me | Done | `LoginScreen` toggle → `authPreferences.ts` |
| Auto login | Done | `sessionRestore.ts` + `authStore.bootstrap()` |
| Biometric login | Done | `biometricAuth.ts`, `BiometricUnlockScreen` |
| Biometric opt-in | Done | `BiometricOptInModal` after first login |
| QR login polish | Done | `QrLoginScreen`, `provisionErrors.ts` |
| Session management | Done | `authStore.logout()`, `markSessionExpired()` |
| Secure storage | Done | `expo-secure-store` for tokens + preferences |

---

## Auth flow

```
App launch
    ↓
SplashScreenView (bootstrap)
    ↓
Remember me + stored token?
    ├─ No  → Login / QR Login
    └─ Yes → Biometric enabled?
              ├─ Yes → BiometricUnlockScreen → restore session → Home
              └─ No  → restore session (+ refresh token) → Home

First successful login (remember me)
    ↓
Biometric opt-in modal (if hardware available)
```

**Password fallback:** If biometrics fail or are cancelled, stored tokens are cleared and the login screen is shown with the last username pre-filled.

**Logout:** Clears tokens, auth preferences, push registration, and messaging outbox. Returns to login.

**Session expired:** Clears in-memory session; shows `SessionExpiredScreen`. Username preference is retained for faster re-login.

---

## Key modules

| Module | Purpose |
|--------|---------|
| `src/auth/authPreferences.ts` | Remember me, biometric flags, last username |
| `src/auth/biometricAuth.ts` | Face ID / fingerprint via `expo-local-authentication` |
| `src/auth/sessionRestore.ts` | Auto-login planning |
| `src/auth/provisionErrors.ts` | QR error mapping |
| `src/store/authStore.ts` | Auth state machine |
| `src/navigation/RootNavigator.tsx` | Splash → biometric → home routing |

---

## Tests

```bash
npm run test:mobile
```

Phase 4.1 tests:

- `tests/mobile/auth-preferences.test.ts`
- `tests/mobile/biometric-auth.test.ts`
- `tests/mobile/provision-errors.test.ts`
- `tests/mobile/session-restore.test.ts`

---

## Related docs

- [Phase 4 overview](../../docs/vsp/phase4/README.md)
- [Phase 4 feature matrix](../../docs/vsp/phase4/01-mobile-feature-matrix.md)
- [PHASE4.md](./PHASE4.md)

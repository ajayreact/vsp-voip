# Security Audit — Phase 3.1

**Scope:** Authentication, authorization, JWT, QR/SIP provisioning, API permissions, tenant isolation, Super Admin privileges.  
**Mode:** Read-only findings. No remediation in this increment.

---

## Findings

### SEC-001 — 7-day JWT access token without revocation

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Root cause** | `lib/auth.js` `signToken()` sets `exp: now + 7 days`. Logout revokes refresh tokens only (`routes/portal.js`); access JWT remains valid until expiry. |
| **Recommendation** | Short-lived access tokens (15–60 min) with refresh rotation; or maintain a revocation blocklist keyed by `jti`/`sub`. |
| **Proposed fix** | Phase 3.4: Split access/refresh TTL; on logout/password reset invalidate all sessions for user. |

---

### SEC-002 — Custom JWT without standard claims

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | Manual HS256 in `lib/auth.js`; no `iss`, `aud`, or `jti` claims. |
| **Recommendation** | Document threat model; consider `jsonwebtoken` with explicit algorithm allowlist. |
| **Proposed fix** | Add `jti` for revocation; validate `iss`/`aud` if multi-service deployment. |

---

### SEC-003 — Refresh token reuse not detected

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Root cause** | `lib/refreshTokens.js` `rotateRefreshToken()` revokes old token on rotation but does not detect concurrent reuse of stolen token. |
| **Recommendation** | On reuse of revoked refresh token, invalidate all user refresh tokens (OAuth best practice). |
| **Proposed fix** | Store `familyId`; flag reuse → revoke family. |

---

### SEC-004 — QR provisioning redeem race (single-use token)

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | `lib/extensionProvisioning.js` `redeemProvisioningToken()` reads `usedAt` then updates — not atomic conditional update. |
| **Recommendation** | Single-use tokens must use `updateMany({ where: { usedAt: null }})` or transaction with row lock. |
| **Proposed fix** | Match Stripe `claimStripeEvent` pattern: atomic claim before side effects. |

---

### SEC-005 — Provisioning redeem issues long-lived JWT

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | Successful redeem calls `signToken()` with full user payload immediately (`extensionProvisioning.js`). |
| **Recommendation** | Audit-log every redeem; consider device-bound session separate from portal JWT. |
| **Proposed fix** | Issue mobile-scoped token with shorter TTL; require password for portal access. |

---

### SEC-006 — Admin SIP credentials expose secrets

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | `GET /api/tenant/extensions/:id/sip` returns full SIP password (`includeSecrets: true`) to `TENANT_ADMIN`. |
| **Recommendation** | Audit-log every fetch; time-boxed reveal UI; never log secrets. |
| **Proposed fix** | Optional: one-time reveal token; rotate on each QR generation (already partially implemented). |

---

### SEC-007 — Public provisioning endpoint

| Field | Detail |
|-------|--------|
| **Severity** | Low (mitigated) |
| **Root cause** | `POST /api/mobile/provision` unauthenticated; rate-limited by `loginLimiter` only. |
| **Mitigation** | Opaque token, SHA-256 at rest, 15-min TTL, tenant suspension check, no password in QR payload. |
| **Recommendation** | Monitor failed redeem attempts; optional CAPTCHA after N failures. |
| **Proposed fix** | Dedicated rate limiter per token prefix. |

---

### SEC-008 — SUPER_ADMIN cross-tenant overrides

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | Messaging and some admin paths accept `?tenantId=` for `SUPER_ADMIN` (`routes/messaging.js`). |
| **Recommendation** | Mandatory audit log for cross-tenant reads/writes; optional MFA for Super Admin. |
| **Proposed fix** | Central `auditSuperAdminAccess()` middleware. |

---

### SEC-009 — Unauthenticated static upload paths

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | `server.js` serves `/uploads/greetings` and payment proof paths via `express.static`. |
| **Recommendation** | Verify filenames are unguessable UUIDs; prefer authenticated streaming routes. |
| **Proposed fix** | Move to signed URL or auth middleware on `/uploads/*`. |

---

### SEC-010 — CORS allows private LAN origins

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Root cause** | `server.js` `isAllowedWebOrigin()` allows `192.168.*:3001` regex. |
| **Recommendation** | Disable LAN bypass in production unless `WEB_ORIGIN_LAN` explicitly set. |
| **Proposed fix** | Gate LAN regex on `NODE_ENV !== 'production'`. |

---

### SEC-011 — API authorization positive controls

| Field | Detail |
|-------|--------|
| **Severity** | N/A (positive) |
| **Root cause** | — |
| **Recommendation** | Maintain patterns: `authMiddleware`, `requireRole()`, `requireTenant()`, `assertTenantActive()`. |
| **Proposed fix** | — |

**Verified:**

- Admin router: `requireRole('SUPER_ADMIN')` blanket (`routes/admin.js`)
- Extension/ring-group mutations: tenant-scoped + admin role
- Voicemail/recording streams: `tenantId` match before serve
- Softphone record-start: `assertCallControlOwnership()` + caller ID tenant check
- Production boot fails without strong `JWT_SECRET`, `TELNYX_PUBLIC_KEY` (`lib/env.js`)
- Telnyx webhook signature verification (`lib/telnyxVerify.js`)
- bcrypt cost 10 for passwords

---

### SEC-012 — Tenant isolation in authenticated APIs

| Field | Detail |
|-------|--------|
| **Severity** | N/A (positive) |
| **Root cause** | — |
| **Recommendation** | Continue scoping all tenant data queries with `req.user.tenantId`. |
| **Proposed fix** | — |

**Verified:** `GET /api/calls`, extension CRUD, ring groups, voicemails, recordings — all filter by tenant.

---

## Summary

| Severity | Open findings |
|----------|---------------|
| Critical | 0 |
| High | 1 |
| Medium | 6 |
| Low | 2 |

**Top priority for Phase 3.4:** SEC-001 (JWT lifecycle), SEC-004 (provisioning race), SEC-008 (Super Admin audit trail).

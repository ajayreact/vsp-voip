# Security

Security layers for VSP Phone PBX — auth, tenant isolation, webhook verification, and telephony credentials.

---

## Authentication layers

| Layer | Mechanism | Location |
|-------|-----------|----------|
| Portal users | JWT Bearer | `web/src/lib/api.ts`, auth middleware |
| Telnyx REST | API key (server only) | `.env` `TELNYX_API_KEY` |
| WebRTC login | Telephony credential JWT | `POST /api/softphone/token` |
| Telnyx webhooks | Ed25519 signature | Webhook middleware, `TELNYX_PUBLIC_KEY` |
| Stripe webhooks | Signing secret | `STRIPE_WEBHOOK_SECRET` |

---

## Tenant isolation

- JWT embeds `tenantId` — all tenant API queries scoped
- Inbound calls resolve tenant from DID — never trust CLI alone
- Admin routes require `SUPER_ADMIN` role
- Cross-tenant DID assignment audited in `DidAssignmentHistory`

See [07-multitenancy.md](./07-multitenancy.md)

---

## Extension security

`ExtensionSecurity` model:

- Caller ID whitelist / blacklist
- Anonymous call block
- Time restrictions
- Recording policy

Enforced on **inbound** via `resolveExtensionInboundPolicy`.

**Gap:** Outbound calling permissions stored but not fully enforced at dial time.

---

## Webhook hardening

```env
WEBHOOK_STRICT=true   # production default
```

Invalid Telnyx signatures rejected. Webhook URL must be HTTPS (`api.vspphone.com`).

Nginx passes `Authorization` header for JWT — required for mobile auth.

---

## Secrets management

| Secret | Impact if rotated |
|--------|-------------------|
| `JWT_SECRET` | All users logged out |
| `TELNYX_API_KEY` | API calls fail |
| `SETTINGS_ENCRYPTION_KEY` | Encrypted settings unreadable |

Do not rotate during routine deploys.

---

## WebRTC token scope

Login tokens are short-lived Telnyx telephony credentials — scoped to user's SIP connection, not full API access.

---

## Recording & voicemail access

Stream endpoints require JWT + tenant ownership check before redirecting to Telnyx/recording URL.

---

## Related docs

- [07-multitenancy.md](./07-multitenancy.md)
- [20-api-reference.md](./20-api-reference.md)
- [../deployment/11-known-issues.md](../deployment/11-known-issues.md)

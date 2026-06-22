# Launch Checklist

Complete **all sections** before onboarding paying customer #1.  
Gate: `npm run validate:p0` passes against **production** URL.

---

## Technical checklist

### Infrastructure

- [ ] AWS (or equivalent) production environment provisioned
- [ ] RDS PostgreSQL 16 running with backups enabled
- [ ] ElastiCache Redis 7 running with AUTH/TLS
- [ ] ECS Fargate API deployed (or equivalent)
- [ ] Next.js web deployed with HTTPS
- [ ] ACM TLS certificates active on all public domains
- [ ] Secrets in AWS Secrets Manager (not in git)
- [ ] `npx prisma migrate deploy` run on production DB
- [ ] Super admin seeded (one time)

### Environment variables (production)

- [ ] `DATABASE_URL`
- [ ] `REDIS_URL`
- [ ] `JWT_SECRET` (strong, non-default)
- [ ] `SETTINGS_ENCRYPTION_KEY`
- [ ] `TELNYX_API_KEY`
- [ ] `TELNYX_PUBLIC_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `SMTP_HOST` + `SMTP_FROM`
- [ ] `API_PUBLIC_URL` (HTTPS)
- [ ] `WEB_ORIGIN` (HTTPS)
- [ ] `NODE_ENV=production`

### Health & validation

- [ ] `GET /health` → 200
- [ ] `GET /ready` → 200, `ready: true`
- [ ] `npm run validate:phase2a` — 0 failures
- [ ] `npm run validate:p0` — 0 failures
- [ ] CloudWatch / log aggregation configured
- [ ] Uptime monitor on `/ready`

### Security (Phase 2A)

- [ ] Public number search returns 401 unauthenticated
- [ ] Admin routes return 401 unauthenticated
- [ ] Rate limiting active (Redis connected)
- [ ] Telnyx webhook verification enabled
- [ ] Stripe webhook signature verification enabled

---

## Billing checklist

- [ ] Stripe account in **live mode**
- [ ] Live secret key in platform settings
- [ ] Webhook endpoint: `https://api.DOMAIN/api/billing/webhook`
- [ ] Events subscribed: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
- [ ] `STRIPE_WEBHOOK_SECRET` in production secrets
- [ ] Test live checkout → number fulfilled
- [ ] Duplicate webhook replay tested (no double purchase)
- [ ] Payment receipt email received
- [ ] Manual bank transfer path tested (if offered)
- [ ] Stripe Customer Portal enabled
- [ ] `/ready` → `stripe.webhookConfigured: true`

---

## Telephony checklist

- [ ] Telnyx account funded
- [ ] TeXML webhook → `/webhook`
- [ ] Call progress → `/webhook/status`
- [ ] Call Control → `/webhook/call-control`
- [ ] Voice/outbound → `/webhook/voice`
- [ ] SMS → `/webhook/sms`
- [ ] Inbound test call passed
- [ ] Outbound test call passed
- [ ] Mobile app / softphone registration visible
- [ ] SMS send/receive (if customer needs SMS)
- [ ] Suspended tenant blocked on voice + SMS
- [ ] Number purchase end-to-end passed

---

## Support checklist

- [ ] `support@yourdomain.com` inbox monitored
- [ ] `SUPPORT_EMAIL` set in production
- [ ] Customer Onboarding SOP printed/shared with team
- [ ] Internal escalation contact defined
- [ ] 4-hour business-day response SLA documented
- [ ] Basic customer FAQ (login, reset password, buy numbers) — 1-page doc
- [ ] Super Admin audit log access verified
- [ ] Pilot customer identified for first go-live

---

## Email checklist

- [ ] SMTP provider domain verified (SPF/DKIM)
- [ ] Welcome email tested (tenant creation)
- [ ] Password reset flow tested (`/forgot-password`)
- [ ] Invoice email tested (manual order)
- [ ] Payment receipt tested (Stripe checkout)
- [ ] `/ready` → `smtp.connected: true`

---

## Final sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| CTO / Engineering | | | |
| Operations | | | |
| Customer Success | | | |
| CEO | | | |

**Phase 2B start authorized:** ☐ Yes ☐ No — only after all boxes checked.

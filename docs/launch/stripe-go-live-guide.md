# Stripe Go-Live Guide

Prepare Stripe for **live-mode** billing before the first paying customer.

---

## Prerequisites

- Stripe account verified (business details, bank account)
- Production API deployed with HTTPS
- Super Admin access to VSP-VOIP platform settings

---

## 1. Live mode checklist

| Step | Action | Done |
|------|--------|------|
| 1 | Switch Stripe Dashboard to **Live mode** | ☐ |
| 2 | Copy **Publishable key** and **Secret key** (live) | ☐ |
| 3 | In VSP-VOIP Admin → Settings → Billing, enter live secret key | ☐ |
| 4 | Enable Stripe billing in platform settings | ☐ |
| 5 | Create webhook endpoint (below) | ☐ |
| 6 | Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET` | ☐ |
| 7 | Restart API | ☐ |
| 8 | Run test checkout with real card (small amount) | ☐ |
| 9 | Verify number fulfillment + receipt email | ☐ |

---

## 2. Webhook endpoint

**URL:** `https://api.YOUR_DOMAIN.com/api/billing/webhook`

Create in Stripe Dashboard → Developers → Webhooks → Add endpoint.

### Required events

| Event | Handler | Purpose |
|-------|---------|---------|
| `checkout.session.completed` | ✅ | Fulfill number order after card checkout |
| `invoice.paid` | ✅ | Audit log + recurring payment receipt email |
| `invoice.payment_failed` | ✅ | Grace period + audit log |
| `customer.subscription.deleted` | ✅ | Cancel grace + audit log |

### Signing secret

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx
```

Also configurable in platform settings (`stripeWebhookSecret`). Env var takes precedence at runtime if platform empty.

---

## 3. Validation tests

### Local (Stripe CLI)

```bash
stripe login
stripe listen --forward-to localhost:3000/api/billing/webhook
# Copy whsec_... to .env

stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

### Automated

```bash
STRIPE_WEBHOOK_SECRET=whsec_... npm run validate:phase2a
```

### Production smoke test

1. Create test tenant with 1 number in cart
2. Complete Stripe Checkout with real card
3. Confirm:
   - Order status → `FULFILLED`
   - Numbers appear in tenant portal
   - Payment receipt email received
   - `ProcessedStripeEvent` row created (no duplicate on replay)

---

## 4. Idempotency & security

| Control | Implementation |
|---------|----------------|
| Signature verification | `stripe.webhooks.constructEvent()` |
| Duplicate events | `ProcessedStripeEvent` table (PK = event id) |
| Double fulfillment | `FulfillmentLock` + atomic order status |
| Unsigned requests | Rejected (503 if secret missing + signature present) |

---

## 5. Billing portal

Customers with Stripe subscriptions can manage cards via:

- Portal: Settings → Subscription → Manage billing
- API: `createBillingPortalSession`

Ensure **Customer Portal** is enabled in Stripe Dashboard → Settings → Billing → Customer portal.

---

## 6. Manual bank transfer (optional)

If offering manual payment:

1. Configure bank details in Admin → Settings → Bank payment
2. Customer places manual order
3. Admin sends invoice email via order → Mark invoice sent
4. Admin confirms payment → Fulfill order

Stripe webhooks not required for manual path; SMTP required for invoice email.

---

## 7. Go-live sign-off

| Check | Pass |
|-------|------|
| `/ready` → `stripe.webhookConfigured: true` | ☐ |
| Test `checkout.session.completed` in live mode | ☐ |
| Duplicate webhook replay does not double-purchase | ☐ |
| `invoice.payment_failed` sets tenant to GRACE | ☐ |
| Receipt email delivered | ☐ |

**Signed off by:** _______________ **Date:** _______________

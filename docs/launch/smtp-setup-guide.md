# SMTP Setup Guide

Production requires SMTP for customer onboarding and billing communications.

---

## Required environment variables

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com   # example: AWS SES
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@yourdomain.com
SUPPORT_EMAIL=support@yourdomain.com
WEB_ORIGIN=https://app.yourdomain.com
```

Production startup validates `SMTP_HOST` and `SMTP_FROM` (`lib/env.js`).  
`/ready` includes SMTP connectivity check.

---

## Recommended providers (first 10 customers)

| Provider | Notes |
|----------|-------|
| **AWS SES** | Best fit if on AWS; verify domain + DKIM |
| **SendGrid** | Simple API, good deliverability |
| **Mailgun** | Developer-friendly |
| **Postmark** | Excellent transactional deliverability |

---

## DNS records (required for deliverability)

For sending domain `yourdomain.com`:

| Record | Purpose |
|--------|---------|
| SPF | `v=spf1 include:amazonses.com ~all` (adjust for provider) |
| DKIM | Provider-supplied CNAME records |
| DMARC | `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com` |

---

## Transactional emails implemented

| Email | Trigger | Template |
|-------|---------|------------|
| **Welcome** | Super Admin creates tenant + admin user | `lib/emailTemplates.js` → `welcomeEmail` |
| **Password reset** | `POST /api/auth/forgot-password` | Reset link → `/reset-password?token=` |
| **Invoice (manual order)** | Admin → Mark invoice sent (with sendEmail) | Bank transfer invoice body |
| **Payment receipt** | Stripe `checkout.session.completed` + fulfillment | Order total + numbers |
| **Recurring receipt** | Stripe `invoice.paid` (renewals) | Subscription payment confirmation |

---

## API endpoints

```http
POST /api/auth/forgot-password
{ "email": "user@company.com" }

POST /api/auth/reset-password
{ "token": "...", "password": "newpassword" }
```

Portal pages: `/forgot-password`, `/reset-password`

Password reset tokens expire in **1 hour**, stored in Redis (`pwdreset:*`).

---

## Verification steps

### 1. SMTP connection

```bash
npm run validate:p0
```

Or check production: `GET /ready` → `"smtp": { "connected": true }`

### 2. Manual send test

Create a tenant with admin email in staging — welcome email should send automatically.

### 3. Password reset test

1. Go to `/forgot-password`
2. Enter tenant admin email
3. Click reset link in email
4. Set new password on `/reset-password`

### 4. Invoice email test

1. Place manual bank order for test tenant
2. Admin → Order → Mark invoice sent (sendEmail: true)
3. Confirm invoice received

### 5. Stripe receipt test

Complete live Stripe checkout → confirm payment receipt email.

---

## Production checklist

| Step | Done |
|------|------|
| Domain verified with provider | ☐ |
| SPF + DKIM + DMARC configured | ☐ |
| `SMTP_*` in Secrets Manager | ☐ |
| `/ready` smtp.connected = true | ☐ |
| Welcome email test | ☐ |
| Password reset email test | ☐ |
| Invoice email test | ☐ |
| Payment receipt test | ☐ |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Email not sent, `{ sent: false }` | Check SMTP_HOST, SMTP_FROM, credentials |
| Emails in spam | Fix SPF/DKIM; use dedicated sending domain |
| Reset link broken | Verify `WEB_ORIGIN` matches portal URL |
| Token expired | Redis must be running in production |

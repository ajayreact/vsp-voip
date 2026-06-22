# Customer Onboarding SOP (Concierge)

**Audience:** Super Admin, Customer Success  
**Mode:** White-glove onboarding for first 10 paying customers  
**Duration:** 1–2 business days per customer

---

## Flow overview

```text
Customer Signs Agreement
        ↓
Create Tenant
        ↓
Create Admin User
        ↓
Configure Quotas
        ↓
Purchase Numbers
        ↓
Configure Routing
        ↓
Inbound Call Test
        ↓
Outbound Call Test
        ↓
Go Live
```

---

## Step 1: Customer signs agreement

**Owner:** Sales / CEO

- [ ] Signed service agreement or order form on file
- [ ] Plan tier documented (Starter / Professional / Business)
- [ ] Billing method confirmed (Stripe card or manual bank transfer)
- [ ] Primary contact email and phone recorded
- [ ] Support tier agreed (email, response SLA)

**Output:** Customer record in CRM/spreadsheet with plan limits.

---

## Step 2: Create tenant

**Owner:** Super Admin  
**Portal:** Admin → Tenants → Create

- [ ] Log in as Super Admin (`/admin`)
- [ ] Create tenant with legal business name
- [ ] Set platform fees if different from defaults:
  - Setup fee per number
  - Monthly platform fee per number
- [ ] Include tenant admin name, email, temporary password
- [ ] Confirm welcome email sent (check SMTP logs)

**API:** `POST /api/admin/tenants`

**Verify:** Tenant appears in tenant list; welcome email received.

---

## Step 3: Create admin user

*Included in Step 2 if admin details provided at creation.*

If adding separately:

- [ ] Admin → Tenant detail → Add user
- [ ] Role: `TENANT_ADMIN`
- [ ] Communicate credentials securely (password manager, not plain email if policy requires change-on-first-login)

**Verify:** User can log in at `/login`.

---

## Step 4: Configure quotas

**Owner:** Super Admin  
**Portal:** Admin → Tenants → [Tenant] → Quotas (or tenant edit)

Set limits per agreed plan:

| Plan | Users | Numbers | Concurrent calls |
|------|-------|---------|------------------|
| Starter | 3 | 2 | 3 |
| Professional | 10 | 5 | 8 |
| Business | 25 | 15 | 15 |

- [ ] Set `maxUsers`, `maxPhoneNumbers`, `maxConcurrentCalls`
- [ ] Confirm `isActive: true`, `billingStatus: ACTIVE`

**Verify:** Quotas match contract.

---

## Step 5: Purchase numbers

**Option A — Customer self-serve (Stripe):**

- [ ] Customer logs in → Numbers → Search → Add to cart → Checkout
- [ ] Confirm Stripe payment + fulfillment
- [ ] Confirm receipt email

**Option B — Manual bank transfer:**

- [ ] Customer creates manual order OR admin creates order
- [ ] Admin sends invoice email
- [ ] Confirm payment received
- [ ] Admin fulfills order

**Option C — Admin direct purchase:**

- [ ] Admin → Numbers → Purchase → select tenant → buy

- [ ] Numbers appear under tenant → My Numbers
- [ ] Telnyx connection + messaging profile assigned

**Verify:** Each number shows in portal with correct tenant.

---

## Step 6: Configure routing

**Owner:** Tenant Admin (with CS assistance)

- [ ] Greeting message configured (`/greeting`)
- [ ] Ring group members added (mobile app users)
- [ ] Business hours set if needed
- [ ] Voicemail enabled/tested
- [ ] Call recording preference set
- [ ] Per-number routing if multiple numbers

**Verify:** Greeting preview; ring group lists correct users.

---

## Step 7: Inbound call test

- [ ] At least one user logged into softphone or mobile app
- [ ] Call each purchased number from external phone
- [ ] Confirm: greeting → ring → answer OR voicemail
- [ ] Check Admin → Monitoring for registration status
- [ ] Confirm `CallLog` entry in portal

**Pass criteria:** Call answered or voicemail captured within 30 seconds.

---

## Step 8: Outbound call test

- [ ] User selects owned number as caller ID
- [ ] Place call to external mobile
- [ ] Two-way audio confirmed
- [ ] Call appears in call history
- [ ] Recording saved (if enabled)

**Pass criteria:** Successful outbound call with correct caller ID.

---

## Step 9: Go live

- [ ] All above steps signed off
- [ ] Customer contact informed of support email
- [ ] Internal audit log reviewed (no errors)
- [ ] Mark customer **LIVE** in CRM
- [ ] Schedule 7-day check-in call

**Support handoff:**

- Email: `support@yourdomain.com`
- Escalation: Super Admin on-call contact
- Portal: `/settings` for self-management

---

## Rollback

If go-live fails:

1. Set tenant `isActive: false` (Admin → Suspend)
2. Document issue in audit log notes
3. Do not release numbers until resolved
4. Re-run failed test step after fix

---

## Sign-off template

| Field | Value |
|-------|-------|
| Customer | |
| Tenant ID | |
| Plan | |
| Numbers | |
| Go-live date | |
| CS owner | |
| Technical sign-off | |

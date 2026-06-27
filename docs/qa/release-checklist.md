# Production Release Checklist

Run the automated checklist before every production deployment:

```bash
npm run release:checklist
```

Against staging or production API:

```bash
API_BASE=https://api.staging.example.com npm run release:checklist
```

Optional flags:

- `--skip-load` — skip k6 messaging smoke
- `--skip-browser` — skip Playwright (browser tests off unless `QA_BROWSER_TESTS=true`)

---

## Automated gates (must pass)

| Step | Command | Purpose |
|------|---------|---------|
| Framework validation | `npm run validate:tests-framework` | Test assets present and complete |
| Vitest suite | `npm test` | Unit, API, telephony, mobile component tests |
| Deploy smoke | `npm run smoke:deploy` | `/health`, `/ready`, auth, critical REST routes |
| Release docs | file check | Checklist + monitoring docs exist |

## Manual gates (operator sign-off)

### Code & branch

- [ ] Release branch merged to `main` with approved PR
- [ ] No uncommitted hotfixes on deploy target
- [ ] Database migrations reviewed (`prisma migrate deploy` plan documented)
- [ ] **Calling / Messaging / WebRTC modules unchanged** unless explicitly approved

### Environment & secrets

- [ ] `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SETTINGS_ENCRYPTION_KEY` set on production
- [ ] `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`, webhook URLs configured
- [ ] `API_PUBLIC_URL`, `WEB_ORIGIN`, `ADMIN_ORIGIN` match deployed domains
- [ ] Stripe/Razorpay webhook secrets configured
- [ ] SMTP credentials verified (password reset, notifications)

### Mobile (if releasing app)

- [ ] EAS secrets: `EXPO_PUBLIC_API_BASE_URL`, `GOOGLE_SERVICES_JSON`, APNs credentials
- [ ] Preview build smoke-tested on physical Android + iOS devices
- [ ] Store metadata and version numbers incremented

### Web

- [ ] `NEXT_PUBLIC_API_URL` points to production API
- [ ] `npm run build --prefix web` succeeds in CI
- [ ] CDN/cache invalidation planned if applicable

### Post-deploy verification

- [ ] `API_BASE=https://api.production.example.com npm run smoke:deploy`
- [ ] `SMOKE_CHECK_WEB=true WEB_BASE=https://app.example.com npm run smoke:deploy`
- [ ] Login, dashboard, softphone config, messaging list manually spot-checked
- [ ] Monitor `/ready` and error rates for 30 minutes post-deploy

### Rollback plan

- [ ] Previous container/image tag documented
- [ ] Database migration rollback path understood (or forward-fix plan)
- [ ] On-call contact notified of deploy window

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Engineering | | | ☐ |
| QA | | | ☐ |
| Operations | | | ☐ |

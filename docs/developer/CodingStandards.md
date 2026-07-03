# V3 Coding Standards

**Version:** 3.0.0

## JavaScript (Backend)

- CommonJS in `lib/v3/` — `require` / `module.exports`
- Tenant scope every query: `where: { tenantId }`
- Throw errors with `{ status, code }` for HTTP mapping
- Use existing services — do not duplicate logic
- Audit mutations via `auditService.log(prisma, req, {...})`

## TypeScript (Frontend)

- App Router pages in `web/src/app/(app)/v3/`
- API calls via `v3-api.ts` only — no raw fetch scattered in pages
- Role checks on page mount for admin routes
- Super-admin: use `runV3SuperAdminGuard(router)`

## Routes

- Mount under `/api/v3` in `routes/v3.js`
- Use `adminOnly` or `superAdminOnly` explicitly
- Call `requireTenant(req, res)` before tenant mutations
- Apply rate limiters for repair/heavy ops

## Tests

- Vitest in `tests/v3/`
- Mock Prisma; test tenant isolation
- Run: `npx vitest run tests/v3`

## Do Not

- Modify `lib/inboundCallControl.js`, `lib/telnyxCallControl.js`, etc.
- Add parallel inbound handlers
- Bypass Redis session store for call state
- Enable runtime sync by default in code

## ESLint

V3 paths must remain clean. Legacy ESLint debt is out of scope for V3.0.0.

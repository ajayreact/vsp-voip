# V3.0.0 — Known Limitations

See also `docs/release/09_KNOWN_LIMITATIONS.md`

## Runtime & Telephony

- **Runtime sync disabled by default** — enable per-tenant after canary
- **Telephony bridge** — not production-validated in RC1
- **Call flow builder** — config + simulator; live routing requires runtime sync
- **telephony-v3-worker** — not required for portal-only deployment
- **Legacy Call Control** — remains production telephony path

## Quality & Testing

- Legacy ESLint: 66 issues (0 in V3 paths)
- Full test suite: 2 API auth failures (environmental)
- `npm run qa:full` — required before telephony enablement, not portal-only GA

## Release Engineering

- Tag `v3.0.0-rc1` may need retag to match release HEAD
- `deploy/staging-v3-portal.sh` default branch may differ from release branch
- Separate repo `vsp-phone-tenant-portal-v3` not created

## Deferred to V3.1+

- Multi-tenant runtime sync rollout
- Production Test Lab
- Legacy ESLint cleanup
- Migration Wizard dedicated post-validate HTTP route
- Warm transfer, conference on V3 path
- CRM / AI portal integrations
- Automated schema downgrade (never planned)

## Operational

- Prisma migrations forward-only
- Portal disable does not delete V3 data
- Super-admin required for marketplace, migration wizard, test lab

# V3.0.0 — Licenses

## Application License

VSP Phone / Tenant Portal V3 — proprietary software.  
Copyright © VSP Phone. All rights reserved.

Contact your organization for licensing terms. This repository is not distributed under an open-source license unless explicitly stated in a separate `LICENSE` file at repository root.

## Third-Party Dependencies (Key)

Backend (`package.json`):

| Package | License | Use |
|---------|---------|-----|
| `@prisma/client` | Apache-2.0 | Database ORM |
| `express` | MIT | HTTP API |
| `jsonwebtoken` | MIT | Authentication |
| `ioredis` | MIT | Redis client |
| `telnyx` | MIT | Telnyx API |

Frontend (`web/package.json`):

| Package | License | Use |
|---------|---------|-----|
| `next` | MIT | Web framework |
| `react` | MIT | UI |
| `@telnyx/webrtc` | MIT | WebRTC (softphone — separate from V3 portal) |

## Telnyx

Telephony services provided by [Telnyx](https://telnyx.com). Subject to Telnyx terms of service.

## Prisma

Database toolkit — [Prisma License](https://github.com/prisma/prisma/blob/main/LICENSE).

## Compliance Notes

- Do not commit `.env`, API keys, or credentials
- JWT secrets must be rotated per organizational policy
- Call recordings and CDR may be subject to data retention regulations
- Tenant data isolation enforced via JWT scoping

## Full Dependency Audit

Run locally (informational):

```bash
npm ls --depth=0
cd web && npm ls --depth=0
```

For SBOM generation, use organizational tooling — not included in V3.0.0 GA package.

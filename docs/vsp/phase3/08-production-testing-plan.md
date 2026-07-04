# Production Testing Plan — Phase 3.7

**Prerequisite:** Staging environment mirroring production (Nginx, SSL, Redis required, Telnyx test numbers).  
**Mode:** Manual + automated validation before go-live.  
**Do not execute fixes during test failures** — log as Phase 3.2+ findings.

---

## Automated baseline (run before manual matrix)

```bash
cd web && npm run build
npm run test:telephony    # expect 135+ passed
npm run test:mobile       # expect 15 passed
node scripts/smoke-deploy.js
node scripts/validate-phase3b.js
node scripts/validate-pbx-production.ts
```

| Script | Validates |
|--------|-----------|
| `test:telephony` | Call Control, routing, provisioning unit/integration |
| `test:mobile` | QR, SIP identity, mobile components |
| `smoke-deploy.js` | Health, auth, core tenant routes |
| `validate-phase3b.js` | Inbound calling package |
| `validate-pbx-production.ts` | Ring target wiring (DB) |

---

## Manual test matrix

### PSTN & Call Control

| ID | Test | Steps | Pass criteria |
|----|------|-------|---------------|
| P-01 | PSTN inbound | Call tenant DID from external mobile | Greeting/IVR/ring per routing config |
| P-02 | PSTN inbound → extension | DID routed to extension | Correct employee device rings |
| P-03 | PSTN inbound → ring group | DID routed to ring group | All members ring per strategy |
| P-04 | PSTN inbound no answer | Do not answer | Voicemail or forward per config |
| P-05 | PSTN outbound (mobile) | Mobile app dials external number | Two-way audio, caller ID correct |
| P-06 | PSTN outbound (desk) | SIP desk dials external | Two-way audio |
| P-07 | Call recording | Answer recorded call | Recording in portal within sync window |
| P-08 | Voicemail | Leave VM | Appears in portal; playable |
| P-09 | Blind transfer | Transfer active call | Completes per policy |
| P-10 | Concurrent inbound | Two simultaneous inbound | No cross-call session bleed |

---

### Extension routing

| ID | Test | Steps | Pass criteria |
|----|------|-------|---------------|
| E-01 | Extension inbound | Call DID assigned to ext 101 | Only that extension rings |
| E-02 | Extension outbound internal | Ext 101 dials 102 same tenant | Reaches 102, not other tenant |
| E-03 | DND / forward | Enable DND on extension | Policy applied on inbound |
| E-04 | Multi-device | Mobile + desk same extension | Both ring or policy honored |

---

### Ring groups

| ID | Test | Steps | Pass criteria |
|----|------|-------|---------------|
| R-01 | Simultaneous | Inbound to ring group | All members ring; first answer wins |
| R-02 | Sequential | Strategy sequential | Members ring in priority order |
| R-03 | Round robin | Multiple consecutive calls | Rotation observed |
| R-04 | Member add/remove | Admin changes members | Next call reflects membership |
| R-05 | Member reorder | Reorder in portal | Sequential order matches |

---

### Provisioning

| ID | Test | Steps | Pass criteria |
|----|------|-------|---------------|
| Q-01 | QR mobile | Generate QR, scan on fresh device | Registers, inbound/outbound work |
| Q-02 | QR desk | Desk QR provision | SIP registers on desk phone |
| Q-03 | QR single-use | Scan same QR twice | Second scan rejected |
| Q-04 | Reset SIP | Admin reset SIP password | Old creds fail; new QR works |
| Q-05 | Revoke device | Force logout | Registration cleared |

---

### Multi-tenant (Phase 3.3)

| ID | Test | Steps | Pass criteria |
|----|------|-------|---------------|
| M-01 | Three tenants ext 101 | Create A/B/C each with ext 101 | No conflict; isolated lists |
| M-02 | Cross-tenant API | Tenant A JWT on Tenant B resource | 403/404 |
| M-03 | Wrong tenant QR | Redeem token on wrong tenant app | Fails |
| M-04 | Admin super | Super admin cross-tenant view | Works with audit (document) |

---

### Portal (administration only)

| ID | Test | Steps | Pass criteria |
|----|------|-------|---------------|
| W-01 | Phone numbers | Assign/unassign DID | Reflects in extension |
| W-02 | Devices | View mobile/desk status | Matches registration |
| W-03 | Ring groups | CRUD via portal | Matches backend |
| W-04 | Call history | View calls | Tenant-scoped only |
| W-05 | Recordings / VM | Play, download, delete | Permission enforced |
| W-06 | Reports | Load reports | Stats load < 10s |
| W-07 | Billing | View plan, orders | Read-only, no payment on page |
| W-08 | No browser calling | Navigate portal | No Telnyx SDK init, no softphone register |

---

### Billing

| ID | Test | Steps | Pass criteria |
|----|------|-------|---------------|
| B-01 | Stripe checkout | Buy number (test mode) | Order created, webhook idempotent |
| B-02 | Manual bank | Bank transfer flow | Order status transitions |
| B-03 | Subscription view | Tenant admin billing page | Correct numbers/charges |

---

### Deployment & ops

| ID | Test | Steps | Pass criteria |
|----|------|-------|---------------|
| O-01 | `/health` | GET | 200 uptime |
| O-02 | `/ready` | GET | 200 all checks |
| O-03 | Deploy rollback | Roll back to previous image | Service restores |
| O-04 | Backup restore | Restore pg_dump to staging | Data intact |

---

## Failure logging template

```
ID: P-01
Severity: High | Medium | Low
Observed:
Expected:
Root cause (if known):
Linked audit finding:
Proposed fix increment: 3.2 | 3.3 | 3.4 | 3.5 | 3.6
```

---

## Exit criteria (Phase 3.7 complete)

- [ ] All automated baselines green
- [ ] All P-01 through P-10 pass on staging
- [ ] All M-01 through M-04 pass
- [ ] All W-01 through W-08 pass
- [ ] Critical/High audit findings either mitigated or accepted with sign-off
- [ ] Deployment checklist ([06-deployment-checklist.md](./06-deployment-checklist.md)) signed

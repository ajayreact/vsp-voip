# Phase 5A — Production Impact Report

**Date:** 2026-06-21  
**Change type:** Feature addition (Ring Groups)  
**Risk level:** Medium

---

## Summary

Phase 5A introduces first-class ring groups without removing legacy greeting-based ring groups. Existing tenants continue to work; new groups use dedicated tables and Call Control routing.

---

## Database impact

| Change | Downtime | Rollback |
|--------|----------|----------|
| New tables `RingGroup`, `RingGroupMember` | None (additive) | Drop tables if needed |
| Nullable FKs on `PhoneNumber`, `Voicemail`, `CallLog` | None | Columns nullable — safe |
| Enum `RingStrategy` | None | N/A |

**Migration command:** `npx prisma migrate deploy`  
**Required:** `npx prisma generate` before API restart

---

## API / backend impact

| Component | Impact |
|-----------|--------|
| `inboundRouting.js` | Checks `PhoneNumber.ringGroupId` before legacy greeting JSON |
| `inboundCallControl.js` | Analytics + VM/recording hooks when `session.ringGroupId` set |
| `extensionFeatures.js` | Forward-to-ring-group uses entity |
| `routes/portal.js` | Number update accepts `ringGroupId` |
| New routes | `/api/tenant/ring-groups/*` |

**No changes to:** billing, Razorpay, Stripe, revenue protection, Phase 2B.

---

## Call flow impact

```
Inbound DID
  → PhoneNumber.ringGroupId? → RingGroup members → Phase 3B ring engine
  → Else legacy Greeting.ringGroupMembers (unchanged)
  → Else tenant default greeting
```

- **Simultaneous / sequential:** Unchanged behavior for legacy configs
- **Round robin / longest idle:** New ordering before sequential engine
- **No answer:** Group VM if enabled; increments `callsMissed`
- **Answer:** Updates member `lastAnsweredAt`, increments `callsAnswered`, optional recording

---

## Telnyx / Call Control

- Same Call Control application and credential connection
- Same WebRTC dial format (`formatWebRtcDialTo`)
- No new Telnyx webhook types
- Recording start unchanged except group-level disable

---

## Frontend impact

- New pages under `/phone-system/ring-groups`
- Phone System nav adds **Ring groups** link
- No breaking changes to existing extension or security pages

---

## Deployment checklist

1. Run migration on production DB
2. `npx prisma generate`
3. Restart API (`npm run dev:api` / production process)
4. Rebuild web app if deployed separately
5. Run `npm run validate:phase5a` against staging
6. Optional: `POST /api/tenant/ring-groups/migrate-legacy` per tenant using old greeting ring group

---

## Monitoring recommendations

- Watch inbound Call Control logs for `Call Control simultaneous ring` / `dialNextTarget`
- Track `RingGroup.callsOffered` vs `callsAnswered` for misconfiguration
- Alert if ring groups have zero members with SIP credentials

---

## Risk mitigations

| Risk | Mitigation |
|------|------------|
| Empty ring group (no targets) | Routes to group VM or hangup with log |
| Legacy + new config conflict | Entity takes precedence when `ringGroupId` set on number |
| Analytics drift | Counters on `RingGroup`; idempotent call log updates |
| API not hot-reloading | Document restart requirement (known ops issue) |

---

## Estimated production readiness: **78/100**

Safe to deploy to staging immediately. Production rollout recommended after one inbound call test per strategy (simultaneous, sequential, round robin, longest idle) with WebRTC member.

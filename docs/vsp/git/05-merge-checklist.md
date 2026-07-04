# Merge Checklist

Complete this checklist **before merging any feature** into `development` (or before merging `release/*` into `main`).

Telephony regressions are costly — treat unchecked items as merge blockers.

---

## Code & process

- [ ] PR reviewed by at least one other developer
- [ ] Feature branch is up to date with target branch (`development` or `release/*`)
- [ ] No secrets or `.env` files in diff
- [ ] Protected telephony files: regression analysis documented (if touched)
- [ ] Compared against last stable tag for telephony changes
- [ ] Prisma migrations included if schema changed
- [ ] `web/package-lock.json` updated if web deps changed

---

## Telephony functional verification

- [ ] **Inbound calls** — DID rings, answers, completes
- [ ] **Outbound calls** — dial-out connects, remote party rings
- [ ] **Two-way audio** — both directions heard (home + office if media touched)
- [ ] **Recording** — inbound auto / outbound manual start, playback in portal
- [ ] **Voicemail** — no-answer path, message in portal, audio plays
- [ ] **Blind transfer** — completes to extension or PSTN
- [ ] **DID assignment** — sync and routing correct (`diagnose-did-sync.js`)
- [ ] **Extension routing** — extension dial-in and policies work
- [ ] **Tenant isolation** — no cross-tenant data leakage in API tests

Detail: [../deployment/14-telephony-validation.md](../deployment/14-telephony-validation.md)

---

## Validation scripts

Run applicable scripts — minimum for any telephony merge:

```bash
npm run validate:p0
```

Feature-specific:

```bash
npm run validate:blind-transfer          # transfer changes
npm run validate:call-transfer-session
npm run validate:rapid-accept-stress     # bridge grace / inbound accept
npm run validate:extension-did           # DID / extension routing
npm run validate:inbound-media-phase1    # WebRTC inbound media
npm run validate:exclusive-voicemail-audio
npm run validate:recording-stream
npm run validate:pbx-production          # full PBX smoke (if available)
```

Automated helper:

```bash
bash scripts/git-pre-merge-check.sh
```

- [ ] **Validation scripts** — all applicable checks pass

---

## Documentation

- [ ] `docs/vsp/` updated if architecture or deploy process changed
- [ ] `docs/vsp/features.md` status updated if feature shipped
- [ ] ADR added in `docs/vsp/architecture-decisions/` if significant design change

---

## Sign-off

| Field | Value |
|-------|-------|
| Feature branch | |
| Target branch | `development` / `release/vX.Y.Z` |
| Stable tag compared | e.g. `v1.0.0` |
| Validator output | attached / pasted in PR |
| Reviewer | |

---

## Related docs

- [03-release-workflow.md](./03-release-workflow.md)
- [06-release-checklist.md](./06-release-checklist.md)
- [../pbx/14-telephony-validation.md](../pbx/14-telephony-validation.md)

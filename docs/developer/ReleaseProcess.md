# V3 Release Process

## Version Flow

```
feature/v3.* → release/v3.0.0-rc1 → UAT → tag v3.0.0 → main → production
Post-GA: feature/v3.1 → development → release/v3.1.0
```

## RC1 → GA Checklist

- [ ] UAT complete (`docs/release/02_UAT_CHECKLIST.md`)
- [ ] All blockers resolved or documented
- [ ] Tag `v3.0.0` on release commit
- [ ] Merge to `main` per git workflow
- [ ] Deploy API + web to production
- [ ] Post-deploy validation
- [ ] Phased tenant rollout

## Creating GA Tag

```bash
git checkout release/v3.0.0-rc1
git tag -a v3.0.0 -m "Tenant Portal V3 General Availability"
git push origin v3.0.0
```

## Release Artifacts

| Path | Content |
|------|---------|
| `release/v3.0.0/` | GA package |
| `CHANGELOG_RC1.md` | RC1 history |
| `V3_FINAL_RELEASE_REPORT.md` | GA assessment |

## Post-GA Development

**Do not continue feature work on RC1 branch.**

Create `feature/v3.1` for:
- Runtime sync production rollout
- Legacy ESLint cleanup
- V3.1 enhancements

## Merge Checklist

See `docs/vsp/git/05-merge-checklist.md`

## Rollback

`release/v3.0.0/ROLLBACK.md`

# VSP Phone — Product Roadmap

Planning hub for VSP Phone product direction, priorities, dependencies, and release sequencing.

**Start here:** [01-current-state.md](./01-current-state.md) → [02-priority-roadmap.md](./02-priority-roadmap.md)

---

## Documents

| # | Topic | Document |
|---|-------|----------|
| 01 | Current state | [01-current-state.md](./01-current-state.md) |
| 02 | Priority roadmap (P0–P4) | [02-priority-roadmap.md](./02-priority-roadmap.md) |
| 03 | Feature dependencies | [03-feature-dependencies.md](./03-feature-dependencies.md) |
| 04 | Release plan | [04-release-plan.md](./04-release-plan.md) |
| 05 | Testing strategy | [05-testing-strategy.md](./05-testing-strategy.md) |
| 06 | Performance plan | [06-performance-plan.md](./06-performance-plan.md) |
| 07 | Security plan | [07-security-plan.md](./07-security-plan.md) |
| 08 | Mobile roadmap | [08-mobile-roadmap.md](./08-mobile-roadmap.md) |
| — | **Phase 4 mobile (active)** | [../phase4/README.md](../phase4/README.md) |
| 09 | AI roadmap | [09-ai-roadmap.md](./09-ai-roadmap.md) |
| 10 | Enterprise roadmap | [10-enterprise-roadmap.md](./10-enterprise-roadmap.md) |

---

## Related internal docs

| Topic | Location |
|-------|----------|
| Feature status matrix | [../features.md](../features.md) |
| PBX architecture | [../pbx/README.md](../pbx/README.md) |
| Git workflow | [../git/README.md](../git/README.md) |
| Deployment | [../deployment/README.md](../deployment/README.md) |
| Architecture decisions | [../architecture-decisions/README.md](../architecture-decisions/README.md) |
| Application audit | [../../COMPLETE-APPLICATION-AUDIT.md](../../COMPLETE-APPLICATION-AUDIT.md) |
| Call transfer plan | [../../call-transfer-implementation-plan.html](../../call-transfer-implementation-plan.html) |

---

## Validation

- [VALIDATION.md](./VALIDATION.md)
- `npm run validate:roadmap-docs`

---

## Planning principles

1. **Protect stable telephony** — P0 before new features
2. **Respect dependencies** — see [03-feature-dependencies.md](./03-feature-dependencies.md)
3. **Extend existing architecture** — no duplicate call flows ([pbx-architecture.mdc](../../../.cursor/rules/pbx-architecture.mdc))
4. **Release from `main` only** — [../git/03-release-workflow.md](../git/03-release-workflow.md)

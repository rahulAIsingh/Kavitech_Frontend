---
trigger: before_commit, before_merge
---

# 14 - Commit, PR, and Definition of Done Checklists

> AI ASSISTANT: Load this file before committing code or raising a PR.
> Run `15-ai-self-check.md` FIRST. Only proceed to this checklist if all self-check items are YES.

---

## Commit Checklist (Before Every Commit)

- [ ] No hardcoded tenant behavior (no `if tenant.Name == ...`)
- [ ] No secret or credential added to any source-controlled file
- [ ] No unused code, imports, or styles left in the files changed
- [ ] If new business variability introduced: config key added to `cfg.ConfigKey`
- [ ] If new screen or action added: permission key defined and enforced
- [ ] If mutation operation added: audit event written
- [ ] If DB schema changed: EF migration included with Down() implemented
- [ ] Tests updated or added for the change

---

## Pull Request Template

Every PR MUST include this description. AI must generate this when raising a PR:

```markdown
## Summary
[What changed and why — 2-3 sentences]

## Task / Issue Reference
[Link or ID]

## Cross-Cutting Impact

| Area | Impact | Detail |
|---|---|---|
| DB Migration | YES / NO | [table/column changed] |
| New Config Keys | YES / NO | [list keys] |
| New Permission Keys | YES / NO | [list keys in module.entity.action format] |
| New Audit Events | YES / NO | [list event types] |
| Security Change | YES / NO | [describe] |
| Performance Impact | YES / NO | [describe] |
| Tenant Safety | VERIFIED | [how verified — EF filter? test?] |

## Migration / Rollback
[Can the migration be rolled back? Steps? Estimated duration on prod-size data?]

## Test Evidence
[Screenshot of passing tests, or list of manually verified scenarios]
```

---

## Definition of Done — Feature Level

A feature is **not done** unless ALL of these are YES:

| Item | Verified |
|---|---|
| Functional requirement works as described | YES / NO |
| Permission enforcement exists (all 3 layers: UI, API, Service) | YES / NO |
| Tenant isolation is ensured (EF filter or explicit verified) | YES / NO |
| No hardcoded business rule or tenant condition | YES / NO |
| No secret in any source file | YES / NO |
| Config is externalized where variability exists | YES / NO |
| Audit event written for every mutation | YES / NO |
| Structured logging with correlation ID | YES / NO |
| User-safe error messages (no stack traces) | YES / NO |
| Tests pass (unit + integration minimum) | YES / NO |
| Migration included and reversible (if DB changed) | YES / NO |
| Release notes entry added | YES / NO |
| `15-ai-self-check.md` all applicable items are YES | YES / NO |

---

## Definition of Done — New Module Level

A new module is **not done** unless it also has:

| Item | Verified |
|---|---|
| Module contract filled (from Rule 12 template) | YES / NO |
| All entities with mandatory columns (Rule 05) | YES / NO |
| EF global query filter for TenantId + IsDeleted | YES / NO |
| All API endpoints versioned + authorized + paginated | YES / NO |
| Permission keys defined in all three enforcement layers | YES / NO |
| Config keys registered in cfg.ConfigKey | YES / NO |
| All audit events implemented and tested | YES / NO |
| Feature flag: MODULE_ENABLED = OFF (default) | YES / NO |
| Seed / lookup data migration present | YES / NO |
| Unit tests for all business rules | YES / NO |
| Integration test: tenant isolation verified | YES / NO |
| Integration test: permission denied verified | YES / NO |
| Release notes entry added | YES / NO |

---

## AI Assistant — Quick Reminder

Before declaring any task complete:
1. Run `15-ai-self-check.md` — all NO items must be resolved
2. Run this checklist
3. State: ✅ Self-check complete. Task is done.

Do not say "done" or "here is the final implementation" without completing steps 1 and 2.

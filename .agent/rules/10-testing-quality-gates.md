---
trigger: before_merge, new_module
---

# 10 - Testing and Quality Gates

> AI ASSISTANT: Load this file when creating a new module or when a task is about to be merged/committed.
> Run `15-ai-self-check.md` Section 8 (DoD) before marking any task complete.

---

## Mandatory Test Layers (What to Write for Every Module)

### Unit Tests (`/tests/UnitTests`)
Write for:
- Domain rules and business logic in services
- Permission evaluation helpers
- Config resolution logic
- Data transformation and mapping
- Validation rules

**Minimum**: 1 unit test per business rule method.

### Integration Tests (`/tests/IntegrationTests`)
Write for:
- API endpoints (real DB, real EF, no mocks)
- Tenant filter enforcement (verify cross-tenant data isolation)
- Audit event writes (verify audit records are created)
- Background job execution
- Config resolution with real config tables

**Minimum**: 1 happy-path + 1 failure-path test per API endpoint.

### Security Tests
Write for:
- Auth denied (403) on protected endpoints when called without valid token
- Tenant isolation (tenant A cannot read tenant B data — verify with test)
- Permission denied (403) when user lacks specific permission
- Session expiry enforcement
- Upload restriction violations

**These are NOT optional. RBAC and tenant isolation must be tested, not just assumed.**

---

## Mandatory Scenario Coverage (All Projects)

| Scenario | Test type |
|---|---|
| Auth mode works correctly (LOCAL/OIDC) | Integration |
| Tenant A cannot access Tenant B data | Integration (security) |
| Permission denied returns 403 | Integration (security) |
| Permission allowed processes correctly | Integration |
| Timestamps stored as UTC | Unit |
| Master CRUD creates/reads/updates/deletes | Integration |
| Soft delete hides from normal list | Integration |
| Import validation catches bad rows | Unit + Integration |
| Audit event written on every mutation | Integration |
| Config change takes effect without restart | Integration |
| Archive keeps record, hides from active | Integration |
| Job retries on failure | Integration |
| Unbounded query is prevented (pagination) | Integration |

---

## Minimum Quality Gates — Before Merge

- [ ] Build passes with zero errors and zero suppressed warnings
- [ ] All tests pass (no skipped tests without documented reason)
- [ ] Lint/format passes
- [ ] Static analysis shows no new critical or high severity issues
- [ ] No hardcoded secret, tenant condition, or magic constant in diff
- [ ] Migration is included and Down() is implemented
- [ ] Permission impact is reviewed (new keys defined if new screen/action added)
- [ ] Audit impact is reviewed (new events defined if new mutations added)
- [ ] `15-ai-self-check.md` all applicable items are YES

---

## Minimum Quality Gates — Before UAT

- [ ] Smoke tests passed on UAT environment
- [ ] Core auth / RBAC scenarios passed manually
- [ ] Integration paths tested end-to-end
- [ ] Logging and monitoring verified (correlation IDs appear in logs)
- [ ] Rollback steps drafted and reviewed
- [ ] Environment config and secrets verified (no dev secrets in UAT)
- [ ] Seed / lookup data validated

---

## Minimum Quality Gates — Before Production

- [ ] Final tagged build artifact used
- [ ] Smoke tests passed on production after deploy
- [ ] All security controls enabled (HTTPS, secure headers, rate limiting)
- [ ] Secrets confirmed in secret store (not in appsettings)
- [ ] Monitoring endpoints responding
- [ ] Backup / restore verified for this environment
- [ ] Rollback plan verified with steps and owner name
- [ ] Resource usage reviewed (memory, CPU, DB connections)
- [ ] Retention / archive settings reviewed
- [ ] Feature flags reviewed (correct on/off state for production)

---

## Security Testing Frequency (VAPT)

| Activity | Required Frequency |
|---|---|
| SAST (Static Analysis) | Every build |
| Secret scan | Every commit / every build |
| Dependency / SCA scan | Every build / daily |
| DAST / API security scan | Every release candidate |
| Internal VAPT | Monthly or at every major release |
| External VAPT | Before first production go-live, then annually |

---

## Hard Release Blockers

**Production release MUST be blocked if any of the following are unresolved:**

| Blocker | Why |
|---|---|
| Critical vulnerability (any) | Immediate risk to system or data |
| High vulnerability without approved exception | Unacceptable residual risk |
| Authentication bypass | Anyone can authenticate without credentials |
| Authorization bypass / privilege escalation | Users can access data or actions beyond their role |
| Tenant data leakage between tenants | Core multi-tenancy isolation is broken |
| SQL injection | Direct DB compromise possible |
| Exposed secrets in source code or build artifacts | Credentials visible to anyone with repo access |
| Plaintext sensitive data appearing in any log | PII / credentials logged, violates Rule 08 |
| Unrestricted file upload | Malicious files can be uploaded and executed |
| Broken MFA or broken password reset flow | Auth security feature is non-functional |
| Sensitive data returned in API response body | Data exposure to unauthorized parties |
| No CSRF protection where cookie auth is in use | Cross-site request forgery attacks possible |

> Any blocker requires either a fix or a formally documented exception with compensating controls and sign-off from the technical lead before release proceeds.

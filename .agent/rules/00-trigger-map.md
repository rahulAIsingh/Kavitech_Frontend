---
trigger: always_on
priority: 1
---

# 00 — AI Trigger Map

## INSTRUCTION FOR AI ASSISTANT — READ THIS FILE FIRST

This is the **first file you must read** before doing any work in this repository.
It tells you which other rule files to load based on what you are doing.

### MANDATORY PRE-CHANGE COMPLIANCE AUDIT (FOR EVERY CONVERSATION)

Before you write, edit, or propose any code changes, business logic changes, or new modules:
1. You MUST audit the current codebase to verify if the organization's baseline modules are complete and compliant.
2. You MUST write this audit report into a new markdown artifact named `compliance_audit_report.md` containing a checklist table of required modules:
   *   **Authentication & Client** (AuthContext, Axios Client, Login/Register pages)
   *   **Security & Guards** (PrivateRoute, HasPermission check)
   *   **UI Foundation** (variables.css layout, components.css, reset.css)
   *   **Shared Components** (paginated DataGrid, ConfirmDialog, Toast, ErrorBoundary)
3. If any file or module is missing or non-compliant, you MUST use the `ask_question` tool to trigger an interactive pop-up modal to ask the developer how to proceed (e.g., whether to auto-scaffold the missing baseline modules first, or proceed). Do not bypass this step.

**Do NOT load all rules simultaneously.**
Load only what the trigger map below instructs for your current task.
This prevents context overload and rule hallucination across large development sessions.

---

## HOW TO USE THIS MAP

1. Identify your current task type from the trigger categories below.
2. Load ONLY the rule files listed for that task type.
3. Always-on files (marked with ✅) are loaded for every task automatically.
4. Run the AI Self-Check from `15-ai-self-check.md` before saying any task is complete.

---

## ALWAYS LOADED — Every Task, No Exception

These files are active for every single piece of work:

| File | What it governs |
|---|---|
| `01-global-engineering-rules.md` | Core principles: no hardcoding, UTC, auditability, safe defaults |
| `03-auth-rbac-multitenancy.md` | Auth, permissions, tenant isolation |
| `05-database-conventions.md` | DB naming, column standards, soft delete, encryption |
| `06-backend-api-ef-rules.md` | API design, EF patterns, pagination, transactions |
| `08-security-privacy-encryption.md` | Secrets, passwords, logging privacy, GDPR |
| `99-anti-patterns.md` | Patterns that must NEVER be generated |
| `15-ai-self-check.md` | Binary self-check before marking any task complete |

> **Note on `INotificationService`**: This interface exists as a cross-cutting service in Rule 06, but it is an abstraction for publishing domain events ONLY. It must NEVER be used for direct email/SMS/push/webhook delivery from business services. See `18-notification-alert-rules.md` and the NOTIFICATION ANTI-PATTERNS section in `99-anti-patterns.md`.

---

## TASK-SPECIFIC TRIGGERS

### TRIGGER: Starting a brand-new project or repository

**Load additionally**: `00-repo-bootstrap.md`, `02-solution-architecture.md`

**Before writing any code, confirm:**
- [ ] Architecture decision (modular monolith vs service) documented
- [ ] Tenant isolation pattern decided (shared DB + TenantId is default)
- [ ] Auth mode decided (Local / OIDC / Hybrid)
- [ ] Repo folder structure matches `00-repo-bootstrap.md` minimum structure
- [ ] Tier A modules are planned (Auth, RBAC, Tenancy, Error Handling, Logging)

---

### TRIGGER: Creating a new module (any domain or generic module)

**Load additionally**: `12-module-checklist-catalog.md`, `09-audit-logging-monitoring-dr.md`, `13-db-configuration-catalog-template.md`

**Before writing any code, fill in this module contract:**
```
Module Name:
Purpose:
Entities:
Permission Keys:     (format: module.entity.action)
Config Keys:         (format: MODULE_SETTING_NAME)
API Endpoints:
UI Screens:
Audit Events:
Background Jobs:
Tests Required:
```
**Do not generate any module code until this contract is filled and confirmed.**

---

### TRIGGER: Creating or modifying a database table or EF entity

**Load additionally**: `05-database-conventions.md` (already always-on — verify the column checklist)

**Check before writing any migration or entity class:**
- [ ] Does this table hold tenant-owned data? → `TenantId` column is mandatory
- [ ] Is this a business record (not a lookup)? → `IsDeleted`, `CreatedAtUtc`, `CreatedBy`, `UpdatedAtUtc`, `UpdatedBy`, `RowVersion` required
- [ ] Are all DateTime fields named with `Utc` suffix?
- [ ] Is `decimal(p,s)` used for money/quantity columns?
- [ ] Is `nvarchar` with explicit length used (not `nvarchar(max)` without justification)?
- [ ] Are FK columns indexed?
- [ ] Does the composite index `TenantId + IsDeleted + Status` exist if this is a frequently queried table?

---

### TRIGGER: Creating or modifying an API endpoint

**Load additionally**: `06-backend-api-ef-rules.md` (already always-on — verify the endpoint checklist)

**Check before writing any controller action:**
- [ ] Is `[Authorize]` applied? → Non-anonymous endpoints MUST have it
- [ ] Is the route versioned? → `api/v{version:apiVersion}/...` pattern required
- [ ] Is the response wrapped in `ApiResponse<T>`?
- [ ] Is the error shape using the standard `ApiError` contract?
- [ ] For list endpoints: is `.Skip().Take()` pagination applied with a hard cap?
- [ ] Is an audit event written for Create, Update, Delete, and sensitive Read operations?
- [ ] Is input validated before business execution?
- [ ] Is TenantId resolved from JWT claims, NOT from request body?

---

### TRIGGER: Creating or modifying a UI screen or component

**Load additionally**: `07-frontend-ui-ux-rules.md`
**If screen displays any date/time value**: also load `16-timezone-display-rules.md`

**Check before writing any screen or component:**
- [ ] Does every action button check its permission before rendering?
- [ ] Is there a loading state on every async operation?
- [ ] Is there an error state that shows user-safe message + correlation ID?
- [ ] Is there an empty state?
- [ ] Are form validations present client-side?
- [ ] Are server validation errors mapped to field-level messages?
- [ ] Is the layout responsive (desktop + tablet + mobile)?
- [ ] Are destructive actions guarded with a confirmation dialog?
- [ ] If displaying date/time: is `formatDateTime()` used with resolved timezone (not browser local)?

---

### TRIGGER: Building any feature that stores, displays, or schedules date/time values

**Load additionally**: `16-timezone-display-rules.md`

**Check before writing any date/time handling code:**
- [ ] Is datetime stored as UTC in backend?
- [ ] Is IANA timezone ID used (not Windows name, not fixed offset like `+05:30`)?
- [ ] Is `TIMEZONE_DISPLAY_MODE` read from `cfg.ConfigValue` — not hardcoded?
- [ ] Is the 6-level resolution hierarchy implemented (not just user → UTC)?
- [ ] Does fallback to UTC log a WARNING?
- [ ] For critical transactions: does audit record include DisplayedLocalTime, DisplayTimezoneId, DisplayMode?

---

### TRIGGER: Adding a new configuration value or feature flag

**Load additionally**: `04-configuration-feature-management.md`, `13-db-configuration-catalog-template.md`

**Decision tree for new config:**
```
Is this value different per tenant?
  YES → goes into cfg.ConfigValue (db-driven, tenant scope)
  NO  → Is this a secret (key, password, token)?
          YES → goes into secure secret store ONLY, referenced by name
          NO  → Is this environment-level (dev vs prod behavior)?
                  YES → goes into appsettings.json environment override
                  NO  → goes into cfg.ConfigValue at GLOBAL scope
```

---

### TRIGGER: Writing or modifying authentication code

**Load additionally**: `03-auth-rbac-multitenancy.md` (already always-on — verify bootstrap sequence), `17-role-user-management-spec.md`

**Hard blockers — AI must refuse to generate code that violates these:**
- NEVER store JWT secret or OIDC client secret in `appsettings.json`
- NEVER log passwords, tokens, or OTPs
- NEVER trust TenantId from request body — always from JWT claims
- NEVER use `[AllowAnonymous]` on a mutation endpoint without documented justification
- NEVER write `if (role == "Admin")` inline checks — use permission evaluator

**Required tenant resolution sequence:** (follow exactly, do not improvise)
1. Extract hostname from `HttpContext.Request.Host`
2. Look up `auth.TenantDomain` table (in-memory cache, 5 min TTL)
3. If not found → return 404 (do not reveal tenant existence)
4. Set `TenantId` in `HttpContext.Items["TenantId"]`
5. Read auth mode from cached `cfg.ConfigValue` for this TenantId
6. Route to correct auth handler
7. After auth: validate JWT `TenantId` claim matches resolved `TenantId`

---

### TRIGGER: Writing or modifying audit or logging code

**Load additionally**: `09-audit-logging-monitoring-dr.md`

**Every audit event MUST include:**
```csharp
new AuditEvent {
    TenantId    = tenantId,           // from resolved tenant context
    EventType   = "ENTITY.ACTION",    // e.g. "USER.LOGIN_SUCCESS"
    EntityType  = "EntityName",
    EntityId    = entityId.ToString(),
    Action      = "ACTION",
    BeforeValue = JsonSerializer.Serialize(before), // for updates
    AfterValue  = JsonSerializer.Serialize(after),  // for updates
    PerformedBy = userId.ToString(),
    PerformedAtUtc = DateTime.UtcNow,
    Channel     = "WEB" | "API" | "JOB" | "IMPORT",
    CorrelationId = correlationId,
    Outcome     = "SUCCESS" | "FAILURE",
    SourceIp    = context.Connection.RemoteIpAddress?.ToString()
}
```

---

### TRIGGER: Creating a background job

**Load additionally**: `06-backend-api-ef-rules.md` (jobs section)

**Every job MUST capture in `job.ExecutionLog`:**
- TenantId, InitiatedBy, CorrelationId
- StartedAtUtc, CompletedAtUtc
- Status: Queued → Running → Completed | Failed | PartialSuccess
- RetryCount, MaxRetries
- FailureReason (user-safe message), FailureDetail (technical, internal only)
- AuditEventId (link to audit record)

**Compensating actions must be defined before job is written:**
- What happens if the job permanently fails? (alert ops? mark records as error?)
- Is the job idempotent? (safe to retry?)
- Does partial completion leave inconsistent data?

---

### TRIGGER: Building role management, user access, permission overrides, password lifecycle, account protection, or session management

**Load additionally**: `17-role-user-management-spec.md`

**Before writing any code, confirm:**
- [ ] Role hierarchy model understood (DAG, cycle prevention, depth limit)
- [ ] Effective permission resolution order implemented (6-layer: account → system → user deny → user allow → role allow → default deny)
- [ ] Redundant user override rejection is enforced
- [ ] Password lifecycle uses Argon2id (preferred) with per-password algorithm tracking
- [ ] All auth thresholds (lockout, token TTL, history depth) read from `cfg.ConfigValue` — not hardcoded
- [ ] Session revocation triggers defined for all privilege-changing mutations
- [ ] Remember-me tokens use server-backed opaque design with rotation

---

### TRIGGER: Before committing or creating a PR

**Load additionally**: `14-commit-pr-dod-checklists.md`, `10-testing-quality-gates.md`

Do not commit or raise a PR until all items in `15-ai-self-check.md` are verified YES.

---

### TRIGGER: Building notification or alert functionality

**Load additionally**: `18-notification-alert-rules.md` + all files under `notifications-alerts/` subfolder

**Before writing any notification code, confirm all of the following:**
- [ ] Architecture pattern: business modules publish domain events ONLY — no direct sending
- [ ] Event payload includes: `EventCode`, `TenantId`, `CorrelationId`, `DedupKey`, `EventTimestampUtc`, `ReferenceEntity`, `ReferenceId`
- [ ] Notification rule engine, recipient resolver, template resolver, and dedup service are DB-driven
- [ ] `IN_APP` channel is mandatory for all notifications
- [ ] All delivery channels use independent async workers (EmailWorker, SmsWorker, PushWorker, InAppWorker, WebhookWorker)
- [ ] Retry logic with exponential backoff and DLQ routing after max retries
- [ ] User preferences are checked (but `CRITICAL` / `ACTION_REQUIRED` cannot be suppressed without policy)
- [ ] Acknowledgement tracking is implemented for `ACTION_REQUIRED` notifications
- [ ] Escalation engine is configured for `CRITICAL` and `ACTION_REQUIRED` alerts
- [ ] SignalR hub is authenticated and groups are scoped to tenant/role/station/user
- [ ] All 15 lifecycle audit events are written via `IAuditWriter`
- [ ] All 20 notification config keys are defined in `cfg.ConfigValue`
- [ ] Retention periods are configurable per tenant and notification category
- [ ] PII is masked in notification content before template rendering
- [ ] Notification links contain no security tokens in the URL
- [ ] All `notification.*` tables use the `notification` schema and PascalCase column names (Rule 05)

**Run Section 10 of `15-ai-self-check.md` before marking any notification feature complete.**

---

### TRIGGER: Before deployment to any environment

**Load additionally**: `11-devops-branching-release-rules.md`

Hard blockers for deployment:
- [ ] No secrets in any committed file
- [ ] All migrations are reviewed and reversible
- [ ] Monitoring endpoints confirmed healthy
- [ ] Rollback steps documented

---

### TRIGGER: Writing any encryption, decryption, key management, webhook signing, or JWT signing code

**Load additionally**: `19-cryptography-standards.md`

**Before writing any cryptographic code, confirm:**
- [ ] AES-256-GCM used for reversible field/file encryption (not AES-ECB, not DES, not custom)
- [ ] Fresh random nonce/IV generated per encryption operation (never reused)
- [ ] Authentication tag stored alongside ciphertext and validated on decryption
- [ ] Key version stored with every encrypted record
- [ ] All keys stored in approved secret manager — not in DB value fields or source
- [ ] Key rotation plan documented before go-live
- [ ] HMAC-SHA256 with constant-time comparison used for webhook/API signing
- [ ] JWT signing uses RS256, PS256, or ES256 — never `alg=none`
- [ ] Prohibited algorithms not used: MD5, SHA-1, DES, 3DES, RC4, AES-ECB, static IV

**Run Section 11 of `15-ai-self-check.md` before marking any crypto task complete.**

---

### TRIGGER: Exposing an API to an external client, building a partner integration, or configuring webhook endpoints

**Load additionally**: `20-api-client-registry.md`, `19-cryptography-standards.md`

**Before building any external-facing API or integration, confirm:**
- [ ] API client is registered in `auth.ApiClient` with tenant mapping, auth type, scopes, rate limit policy
- [ ] Scopes defined in `auth.ApiClientScope` with permission level
- [ ] Rate limit policy created in `cfg.ApiRateLimitPolicy` — not hardcoded in code
- [ ] Secret value is in secret manager — only `SecretReferenceKey` name stored in DB
- [ ] Credential expiry date is set
- [ ] Allowed IP ranges configured (if required)
- [ ] Webhook signature uses HMAC-SHA256 with constant-time verification (see Rule 19)
- [ ] Rate limit response uses standard 429 shape with `retryAfterSeconds` and `correlationId`
- [ ] Client handover documentation prepared via approved channel only

**Run Section 12 of `15-ai-self-check.md` before marking any client API task complete.**

---

### TRIGGER: Before production go-live (first deployment or major release)

**Load additionally**: `22-security-acceptance-checklist.md`, `11-devops-branching-release-rules.md`, `10-testing-quality-gates.md`

**All 13 sections of `22-security-acceptance-checklist.md` must be verified before go-live sign-off.**

- [ ] Threat model completed
- [ ] All sections 1–13 of `22-security-acceptance-checklist.md` reviewed
- [ ] External VAPT completed and findings resolved
- [ ] Final sign-off statement signed by technical lead

---

## CONFLICT RESOLUTION

If two rules appear to contradict each other:
1. Security rules (08, 19) always win over convenience.
2. Tenant isolation rules (03) always win over simplicity.
3. Audit rules (09) always win over performance (optimize the audit write, never skip it).
4. Cryptography rules (19) always win over implementation speed — never skip key versioning or nonce generation.
5. If still unclear, STOP and ask the developer for clarification. Do not guess.

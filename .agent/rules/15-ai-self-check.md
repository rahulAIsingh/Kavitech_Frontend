---
trigger: always_on
priority: 3
---

# 15 — AI Self-Check (Run Before Marking Any Task Complete)

## INSTRUCTION FOR AI ASSISTANT

**Before you say "done", "complete", "finished", or "here is the implementation" on any task,
you MUST run through the applicable sections of this checklist.**

Answer YES or NO to each applicable question.
If ANY answer is NO → fix the gap first. Do not declare done with open NO items.

---

## SECTION 1 — Security (Run for every task)

| # | Check | Answer |
|---|---|---|
| S1 | I have NOT added any secret, token, password, or key to appsettings.json or any source file | YES / NO |
| S2 | I have NOT logged any password, token, OTP, or full sensitive identifier | YES / NO |
| S3 | I have NOT returned a stack trace, SQL text, or connection string to the client | YES / NO |
| S4 | I have NOT hardcoded a tenant-specific condition (if tenantId == ... or if tenant.Name == ...) | YES / NO |
| S5 | I have NOT used an inline role string check (if role == "Admin") instead of permission evaluator | YES / NO |

---

## SECTION 2 — API Endpoints (Run when creating or modifying any API endpoint)

| # | Check | Answer |
|---|---|---|
| A1 | Every new controller action has [Authorize] or has a written justification for [AllowAnonymous] | YES / NO |
| A2 | Every controller uses versioned route: `api/v{version:apiVersion}/[controller]` | YES / NO |
| A3 | Every list endpoint has .Skip().Take() pagination with a hard max cap | YES / NO |
| A4 | All responses use ApiResponse<T> wrapper | YES / NO |
| A5 | All errors use ApiError with CorrelationId (no raw exception messages) | YES / NO |
| A6 | Input is validated before any business execution | YES / NO |
| A7 | TenantId is read from `_tenantContext`, NOT from request body | YES / NO |
| A8 | UserId is read from `_currentUser` (JWT claims), NOT from request body | YES / NO |

---

## SECTION 3 — Database / Entities (Run when creating or modifying any EF entity or migration)

| # | Check | Answer |
|---|---|---|
| D1 | Tenant-owned tables have `TenantId` column | YES / NO |
| D2 | Business record tables have: `IsDeleted`, `CreatedAtUtc`, `CreatedBy`, `UpdatedAtUtc`, `UpdatedBy`, `RowVersion` | YES / NO |
| D3 | All DateTime columns end with `Utc` suffix | YES / NO |
| D4 | Money/quantity columns use `decimal(p,s)`, NOT `float` or `double` | YES / NO |
| D5 | No `.ToLower()` or `.ToUpper()` in LINQ queries | YES / NO |
| D6 | FK columns are indexed | YES / NO |
| D7 | `nvarchar(max)` is not used without a justification comment | YES / NO |

---

## SECTION 4 — Audit Events (Run when creating or modifying any mutation operation)

| # | Check | Answer |
|---|---|---|
| AU1 | Every Create operation writes an audit event | YES / NO |
| AU2 | Every Update operation writes an audit event with BeforeValue and AfterValue | YES / NO |
| AU3 | Every Delete/Archive operation writes an audit event | YES / NO |
| AU4 | Login success writes an audit event | YES / NO |
| AU5 | Login failure writes an audit event | YES / NO |
| AU6 | Every audit event includes: TenantId, PerformedBy, PerformedAtUtc, CorrelationId, Channel | YES / NO |

---

## SECTION 5 — Correlation / Observability (Run for every task)

| # | Check | Answer |
|---|---|---|
| O1 | Correlation ID is propagated through all log statements | YES / NO |
| O2 | Errors are logged with CorrelationId at the right log level (Warning/Error) | YES / NO |
| O3 | No sensitive data appears in any log statement | YES / NO |

---

## SECTION 6 — Frontend / UI (Run when creating or modifying any UI screen or component)

| # | Check | Answer |
|---|---|---|
| UI1 | Every action button is guarded by a permission check before rendering | YES / NO |
| UI2 | Every async operation has a loading state | YES / NO |
| UI3 | Every async operation has an error state showing user-safe message | YES / NO |
| UI4 | No sensitive data is stored in localStorage | YES / NO |
| UI5 | Raw API error messages are never displayed directly to users | YES / NO |
| UI6 | Destructive actions (delete, archive) have a confirmation dialog | YES / NO |

---

## SECTION 7 — New Module (Run only when creating a new module)

| # | Check | Answer |
|---|---|---|
| M1 | Module contract is filled in (purpose, entities, permission keys, config keys, audit events) | YES / NO |
| M2 | Permission keys are defined in format: `module.entity.action` | YES / NO |
| M3 | Config keys are defined in format: `MODULE_SETTING_NAME` | YES / NO |
| M4 | At least one unit test exists for the core business logic | YES / NO |
| M5 | Module starts disabled (feature flag = off) until permissions and configs are verified | YES / NO |

---

## SECTION 8 — Definition of Done (Run for every task before marking complete)

| # | Check | Answer |
|---|---|---|
| DOD1 | The functional requirement works as described | YES / NO |
| DOD2 | No new hardcoded business rule or tenant condition was added | YES / NO |
| DOD3 | No new secret or credential was added to source files | YES / NO |
| DOD4 | If DB changed: migration is included and is reversible | YES / NO |
| DOD5 | Error messages shown to users are safe and correlation-referenced | YES / NO |
| DOD6 | All new config variability has a config key defined | YES / NO |

---

## SECTION 9 — Auth Lifecycle (Run when building auth/RBAC features per Rule 17)

| # | Check | Answer |
|---|---|---|
| AL1 | Role hierarchy is validated for cycles at write time (no self-parenting, no circular chains) | YES / NO |
| AL2 | Effective permission resolution follows the 6-layer order (account → system → user deny → user allow → role allow → default deny) | YES / NO |
| AL3 | Redundant user permission overrides are rejected (not silently stored) | YES / NO |
| AL4 | Passwords are hashed with Argon2id (preferred) or BCrypt (fallback) — with per-password algo/params stored | YES / NO |
| AL5 | All auth thresholds (lockout attempts, token TTL, history depth) are read from `cfg.ConfigValue`, not hardcoded | YES / NO |
| AL6 | Password reset and password change both revoke all active sessions and remember-me tokens | YES / NO |
| AL7 | Remember-me tokens use server-backed opaque design with rotation (not localStorage) | YES / NO |
| AL8 | Privilege-changing mutations (role change, permission change, suspension) trigger session revocation | YES / NO |

---

## SECTION 10 — Notification & Alert (Run when building any notification or alert feature, per Rule 18)

| # | Check | Answer |
|---|---|---|
| N1 | Business service publishes a domain event — it does NOT directly send email/SMS/push/webhook | YES / NO |
| N2 | Every event payload includes: `TenantId`, `CorrelationId`, `DedupKey`, `EventTimestampUtc` | YES / NO |
| N3 | Notification rules, templates, channels, and recipient rules are loaded from DB — not hardcoded | YES / NO |
| N4 | Deduplication is checked before a new notification record is created | YES / NO |
| N5 | All channel delivery is queue-based and does not block the business transaction | YES / NO |
| N6 | IN_APP notification is always created (mandatory for every notification) | YES / NO |
| N7 | Retry logic is implemented for each delivery channel worker | YES / NO |
| N8 | After max retries, delivery is moved to Dead Letter Queue (DLQ) | YES / NO |
| N9 | User preference is checked before queuing delivery (suppression only for non-CRITICAL/non-ACTION_REQUIRED) | YES / NO |
| N10 | CRITICAL and ACTION_REQUIRED alerts are NOT suppressible unless `notification.critical_override_preferences.enabled` is true | YES / NO |
| N11 | Acknowledgement is required and tracked for ACTION_REQUIRED notifications | YES / NO |
| N12 | Escalation rule is configured for ACTION_REQUIRED and CRITICAL alerts | YES / NO |
| N13 | All 15 notification lifecycle audit events are written via `IAuditWriter` (see Rule 09 Notification Events) | YES / NO |
| N14 | No PII or sensitive data is included in notification content — masking applied where needed | YES / NO |
| N15 | Notification links do not contain security tokens in the URL | YES / NO |
| N16 | SignalR connection is authenticated and group membership is scoped to tenant/role/station/user | YES / NO |
| N17 | All retention periods are configurable per tenant and notification category (not hardcoded) | YES / NO |
| N18 | All 20 notification config keys are defined in `cfg.ConfigValue` (not hardcoded) | YES / NO |

---

## FAST TRACK (Minimum checks for small fixes and UI tweaks)

For small tasks (typo fix, style change, label update), run only S1, S2, S5, O3, DOD3.

---

## SECTION 11 — Cryptography (Run when writing any encryption, signing, hashing, or key management code, per Rule 19)

| # | Check | Answer |
|---|---|---|
| CR1 | AES-256-GCM is used for reversible sensitive field or file encryption — NOT AES-ECB, DES, 3DES, RC4, or custom | YES / NO |
| CR2 | A fresh random nonce/IV is generated for every single encryption operation — never static, never reused | YES / NO |
| CR3 | The GCM authentication tag is stored alongside the ciphertext | YES / NO |
| CR4 | The authentication tag is validated before trusting any decrypted data | YES / NO |
| CR5 | The key version and algorithm name are stored with every encrypted record | YES / NO |
| CR6 | Encryption keys are stored only in approved secret manager — NOT in DB value fields or source code | YES / NO |
| CR7 | Key rotation plan is documented before go-live | YES / NO |
| CR8 | HMAC-SHA256 is used for webhook and partner API request signing (not MD5 or SHA1) | YES / NO |
| CR9 | Signature verification uses constant-time comparison — NOT string equality | YES / NO |
| CR10 | JWT signing algorithm is RS256, PS256, or ES256 — `alg=none` is rejected | YES / NO |
| CR11 | SHA-256 or SHA-512 used only for checksums, file integrity, duplicate detection, or audit hash chaining — NOT for passwords | YES / NO |
| CR12 | No prohibited algorithm found: MD5, SHA-1, DES, 3DES, RC4, AES-ECB, static IV, custom crypto | YES / NO |

---

## SECTION 12 — API Client Registry (Run when building external APIs, partner integrations, or webhook endpoints, per Rule 20)

| # | Check | Answer |
|---|---|---|
| AC1 | API client is registered in `auth.ApiClient` with tenant mapping, environment, auth type, and owner | YES / NO |
| AC2 | Scopes are defined in `auth.ApiClientScope` — no undocumented access | YES / NO |
| AC3 | Rate limit policy is created in `cfg.ApiRateLimitPolicy` — NOT hardcoded PermitLimit values in code | YES / NO |
| AC4 | Only the `SecretReferenceKey` (vault key name) is stored in DB — actual secret is in secret manager | YES / NO |
| AC5 | Credential expiry date is set — no indefinite / non-expiring credentials | YES / NO |
| AC6 | Rate limit rejection returns 429 status with `retryAfterSeconds` and `correlationId` | YES / NO |
| AC7 | Client credentials are delivered via approved secure channel only (not plain email / Teams / document) | YES / NO |
| AC8 | Audit events are written for client creation, scope change, revocation, and secret rotation | YES / NO |

---

## HOW TO REPORT RESULTS

After running this checklist, state:
> ✅ Self-check complete. All applicable items are YES. Task is done.

Or:
> ⚠️ Self-check found open items: [list the NO items and what was fixed]

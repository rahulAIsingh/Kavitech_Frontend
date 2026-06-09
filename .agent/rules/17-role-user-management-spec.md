---
trigger: task_specific
priority: 17
loaded_when: "Building role management, user access, permission overrides, password lifecycle, account protection, or session management"
---

# 17 — Role & User Management Specification

> AI ASSISTANT: This file is loaded via trigger only — see `00-trigger-map.md`.
> It supplements the always-active Rule 03 (auth/RBAC/tenancy) and Rule 08 (security/privacy).
> If any instruction here conflicts with Rule 03 or Rule 08, those always-active rules win.
> For cross-cutting concerns (API contracts, DB naming, audit format, timezone), defer to the always-active rules — this file does NOT redefine them.

---

## 1. Role Hierarchy

### 1.1 Structure

- Roles form a **directed acyclic graph (DAG)** — parent/child inheritance.
- A child role inherits all permissions from its parent chain.
- Hierarchy resolution uses recursive CTE for MVP; closure/materialized table for scale.

### 1.2 Hierarchy Rules

| Rule | Detail |
|---|---|
| No cycles | Prevent self-parenting and cycles at write time (validate before insert) |
| Depth limit | Warn at depth > 4, hard-block at depth > 5 — read limit from `cfg.ConfigValue` key: `RBAC_MAX_HIERARCHY_DEPTH` |
| Privileged separation | Security/admin roles must NOT be in the general business hierarchy branch |
| Cross-tenant prohibition | No role may grant cross-tenant power unless explicitly marked as a global platform role |
| MFA for privileged | Privileged roles (`IsPrivileged = true`) must require MFA |

### 1.3 Example Hierarchy

```
Viewer
  └─ Operator (inherits Viewer)
       └─ Manager (inherits Operator)
            └─ Admin (inherits Manager)

SecurityAdmin  ← separate privileged branch, NOT under Admin
SuperAdmin     ← break-glass only, dual-controlled
```

### 1.4 Hierarchy Mutation Rules

- Role renamed → child relationships stay intact; audit records old and new name.
- Role permission changed → effective permission caches must invalidate; privileged permission changes must revoke active sessions immediately.
- Role soft-deleted → all active user-role assignments must be ended; historical audit remains linked by immutable ID.

---

## 2. User-Specific Permission Overrides

### 2.1 Purpose

Overrides are **exception records only** — not a parallel permission system.

### 2.2 Override Rules

| Rule | Detail |
|---|---|
| Redundancy rejection | If the user already gets the permission from role inheritance, do NOT store a duplicate user allow — reject it as redundant or auto-clean it |
| Deny overrides allow | An explicit user DENY always overrides any inherited role ALLOW |
| Default expiry | Direct user grants should expire by default — `EffectiveToUtc` is recommended on every override |
| Approval required | Overrides should capture `ApprovedBy` and `Reason` |
| Scope-aware | Overrides can be scoped by `ScopeType` + `ScopeId` (e.g., location, branch, department) |

### 2.3 Effective Permission Resolution Order

Evaluate in this order — **first match wins**:

```
1. Account / tenant constraints
   → user must be active, tenant must be active, session must be valid,
     account must not be suspended, legal/compliance boundary must not deny

2. System boundaries
   → environment, tenant boundary, page sensitivity, SoD restrictions, location scope

3. User-specific DENY overrides (strongest operational deny)

4. User-specific ALLOW overrides (exception grant, only if not blocked by system boundary)

5. Role-derived ALLOWs (inherited from assigned roles + role hierarchy)

6. Default DENY (if no allow remains → deny)
```

### 2.4 Access Must Be Explainable

Every authorization decision must be reproducible:
- source role(s) that granted/denied
- user override (if any)
- scope/tenant
- time window (`EffectiveFromUtc` / `EffectiveToUtc`)
- policy reason for deny

---

## 3. Page and API Authorization

- Every page and API route must map to one or more permissions in `module.entity.action` format.
- Navigation visibility (frontend) and backend authorization must use the **same** effective permission set.
- Frontend visibility is **advisory only** — server-side enforcement is authoritative.
- Sensitive pages may require **both**: permission allow AND additional policy gates (tenant, region, branch, location, risk score).

---

## 4. Password Policy (When Using Local Auth)

### 4.1 Policy Rules

All thresholds below must come from `cfg.PasswordPolicy` per tenant — never hardcode.

| Setting | Config Key | Recommended Default |
|---|---|---|
| Min length (password-only login) | `PASSWORD_MIN_LENGTH_NO_MFA` | 15 |
| Min length (with MFA) | `PASSWORD_MIN_LENGTH_WITH_MFA` | 12 |
| Max length | `PASSWORD_MAX_LENGTH` | 128 |
| History depth (reuse prevention) | `PASSWORD_HISTORY_DEPTH` | 5 |
| Forced rotation | `PASSWORD_FORCE_ROTATION` | `false` — only on suspected compromise |

**Policy principles:**
- Allow spaces and Unicode.
- Do NOT require arbitrary composition rules (upper/lower/number/special).
- Do NOT require periodic forced rotation.
- Block: breached passwords, commonly used passwords, dictionary words, context-specific passwords (username, email local-part, tenant name, product name).
- Allow paste and password manager autofill.
- Do NOT use security questions as a primary reset or recovery mechanism.

### 4.2 Password Storage

**Preferred algorithm: Argon2id**

```csharp
// PREFERRED — Argon2id:
var hash = Argon2id.HashPassword(plainPassword, new Argon2idOptions {
    MemorySize = 65536,     // 64 MB
    Iterations = 3,
    DegreeOfParallelism = 4
});

// ACCEPTABLE FALLBACK — BCrypt (if Argon2id library unavailable):
var hash = BCrypt.Net.BCrypt.HashPassword(plainPassword, workFactor: 12);

// FIPS FALLBACK — PBKDF2-HMAC-SHA-256:
var hash = Rfc2898DeriveBytes.Pbkdf2(plainPassword, salt, 600000, HashAlgorithmName.SHA256, 32);
```

Store per-password:
- `PasswordHash`
- `PasswordSalt`
- `PasswordAlgo` (e.g., `"argon2id"`, `"bcrypt"`, `"pbkdf2-sha256"`)
- `PasswordParamsJson` (algorithm parameters / work factor)
- `PasswordVersion` (integer, incremented on each change)

**Legacy hash upgrade:** On successful login with old algorithm, re-hash with current preferred algorithm and update stored hash.

### 4.3 Password History

Maintain a `auth.PasswordHistory` table:

```csharp
public class PasswordHistory
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    public string PasswordSalt { get; set; } = string.Empty;
    public string PasswordAlgo { get; set; } = string.Empty;
    public string? PasswordParamsJson { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
```

- On password change/reset: insert previous hash into history, set new current hash, increment `PasswordVersion`.
- Compare candidate password against current + last N historical hashes (N from `PASSWORD_HISTORY_DEPTH` config key).

---

## 5. Forgot Password Flow

### 5.1 Request Phase

- User submits email/username.
- **Always return the same generic response** regardless of account existence (prevent enumeration).
- Response timing should be uniform to reduce timing side-channels.
- Rate-limit by: account, IP/subnet, device fingerprint, tenant — read limits from `cfg.ConfigValue`.
- Do NOT lock the account because forgot-password was requested.
- Do NOT change the password or session state until a valid reset proof is presented.

### 5.2 Reset Token Rules

Use **opaque random tokens**, not reusable links.

| Property | Rule |
|---|---|
| Entropy | At least 128 bits |
| Usage | Single-use |
| Storage | Hashed at rest (never store plaintext token in DB) |
| Binding | Bound to specific user |
| Expiry (privileged users) | Config key: `PASSWORD_RESET_TOKEN_TTL_PRIVILEGED` — default 15 minutes |
| Expiry (standard users) | Config key: `PASSWORD_RESET_TOKEN_TTL_STANDARD` — default 30 minutes |
| Channel | Send via verified email (primary) or verified SMS (enterprise option) |

- Never place token values in logs.
- Reset links must use trusted hostnames only.
- Reset pages must send `Referrer-Policy: no-referrer`.

### 5.3 Reset Completion

When user presents a valid token:

1. Validate new password against current password policy.
2. Mark the token as used (`UsedAtUtc = DateTime.UtcNow`).
3. Revoke all active sessions for this user.
4. Revoke all remember-me tokens for this user.
5. Revoke refresh tokens / API sessions tied to the user.
6. For privileged users: require step-up verification or MFA recovery proof.
7. Send notification that password was reset.
8. Write audit events: `USER.PASSWORD_RESET_COMPLETED`, `SESSION.ALL_REVOKED`.

---

## 6. Change Password Flow

Authenticated password change requires:

- Current password verification
- Valid session
- MFA step-up for privileged roles or suspicious context — read requirement from `cfg.MfaPolicy`
- CSRF protection for browser flows

On success:

1. Validate new password against policy (same rules as registration/reset).
2. Reject reuse of current or previous N passwords (N from config).
3. Rotate the session ID.
4. Revoke all other sessions by default.
5. Revoke remember-me tokens by default.
6. Optionally keep current session only after successful re-auth + MFA.
7. Notify user of password change.
8. Write audit event: `USER.PASSWORD_CHANGED`.

---

## 7. Account Status Model

### 7.1 Canonical Status List

```csharp
public enum AccountStatus
{
    Active,          // Normal operational state
    Pending,         // Created but not yet verified (email confirmation pending)
    TempLocked,      // Security throttle due to repeated failures — auto-unlocks after duration
    Suspended,       // Manual admin/compliance action — requires admin unlock
    Disabled,        // Deprovisioned or inactive identity — no login permitted
    SoftDeleted      // Logically deleted, retained for audit/legal — subject to GDPR three-state model
}
```

**These are NOT equivalent:**

| Status | Meaning | Unlockable By |
|---|---|---|
| `TempLocked` | Automated security throttle | Auto-expire, self-service password reset, admin unlock |
| `Suspended` | Deliberate admin/compliance action | Admin unlock only (with reason + audit) |
| `Disabled` | Identity no longer active | Admin reactivation only |
| `SoftDeleted` | Deletion in progress, retained for audit | Not unlockable — subject to anonymization/purge |

### 7.2 Failed Login Throttling

All thresholds from `cfg.PasswordPolicy` — never hardcode.

| Config Key | Recommended Default | Purpose |
|---|---|---|
| `AUTH_MAX_FAILED_ATTEMPTS` | 5 | Failures before first lock |
| `AUTH_FAILED_WINDOW_MINUTES` | 15 | Window for counting failures |
| `AUTH_LOCKOUT_DURATION_MINUTES` | 15 | Initial lock duration |
| `AUTH_LOCKOUT_ESCALATION_MINUTES` | 30, 60 | Escalating lock durations on repeated lockouts within 24h |
| `AUTH_LOCKOUT_REQUIRE_CAPTCHA_AFTER` | 2 | Lock cycles before requiring CAPTCHA |

**Rules:**
- Count failures primarily by account, with supporting IP/device telemetry.
- Do NOT rely on IP alone.
- Failed-attempt counters reset on successful authentication.
- Forgot-password requests must NOT trigger lockout.

### 7.3 Unlock Paths

| Path | Requirements |
|---|---|
| Auto-unlock | Temporary lock duration expires |
| Self-service | Successful password reset |
| Admin unlock | Identity verification + reason code + ticket reference + actor identity + audit event |

- Admin unlock of privileged users should require second approval (from `cfg.ConfigValue` key: `RBAC_REQUIRE_DUAL_APPROVAL_PRIVILEGED`).
- Unlock must NOT restore revoked remember-me tokens or prior trusted sessions.

---

## 8. Remember Me (Persistent Login)

### 8.1 Policy

| Rule | Detail |
|---|---|
| Default for privileged roles | Disabled unless explicitly approved per tenant (config key: `SESSION_REMEMBER_ME_PRIVILEGED_ALLOWED`) |
| Standard users | Opt-in only, show clear device/session list for revocation |
| Storage | Server-backed opaque tokens — NEVER localStorage/sessionStorage |
| Cookie settings | `HttpOnly`, `Secure`, `SameSite=Lax` or stricter |

### 8.2 Token Design

Server-backed opaque persistent tokens:

```csharp
public class RememberMeToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TenantId { get; set; }
    public string Selector { get; set; } = string.Empty;       // lookup key (not secret)
    public string VerifierHash { get; set; } = string.Empty;   // hashed secret
    public string? DeviceId { get; set; }
    public string? DeviceLabel { get; set; }
    public DateTime IssuedAtUtc { get; set; }
    public DateTime? LastUsedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public Guid? ReplacedByTokenId { get; set; }
    public DateTime? RevokedAtUtc { get; set; }
    public string? RevokeReason { get; set; }
}
```

### 8.3 Token Lifecycle

- **Rotate** the persistent token on every successful use (old token → `ReplacedByTokenId`).
- **Expiry** — read from config, never hardcode:
  - Standard users: `SESSION_REMEMBER_ME_TTL_DAYS` — recommended default 30
  - Elevated roles (if allowed): `SESSION_REMEMBER_ME_TTL_PRIVILEGED_DAYS` — recommended default 7
- **Revoke all** on: password reset, password change, suspicious takeover signal, manual logout-all, admin security action, user transfer across restricted business locations.

---

## 9. Location and Device Risk Handling

### 9.1 Network/Geographic Context Change

Evaluate risk using these signals:

| Signal | Risk Indicator |
|---|---|
| New device vs known device | Medium |
| ASN/network change | Low–Medium |
| Country change | Medium–High |
| Impossible travel | High |
| TOR/VPN/proxy reputation | Medium–High |
| Time-of-day anomaly | Low |
| Privileged role | Amplifies any risk |
| Tenant geo-restriction | Hard deny if violated |

Decision outcomes:
- **Low risk**: Allow and audit.
- **Medium risk**: Require MFA step-up / re-authentication.
- **High risk**: Revoke session, block action, notify user/security team.

### 9.2 Triggers for Forced Re-authentication

Force re-auth when:
- Password reset completed
- Email changed
- Role/permission changed
- New device enrollment
- Impossible travel detected
- Location restricted by policy
- High-risk admin action attempted

### 9.3 Business Location Transfer

When a user is reassigned from Location A to Location B:

1. End-date the old `auth.UserLocationScope` assignment (`EffectiveToUtc = DateTime.UtcNow`).
2. Create new scoped assignment for Location B.
3. Recompute effective permissions.
4. Revoke sessions that depended on Location A scope.
5. Revoke remember-me tokens if location policy requires branch-bound trust.
6. Keep audit history tied to historical scope — do NOT rewrite historical audit records.
7. Ensure open workflow ownership is reassigned explicitly or frozen for review.

### 9.4 Data Access After Transfer

- Access to Location A data ends immediately unless new role explicitly requires cross-location visibility.
- Historical transactions created by the user remain visible in audit/reporting per role, retention, and GDPR purpose limitation.
- Data ownership changes must be explicit — never silently migrate record ownership.

---

## 10. Cascade Rules for Authorization Entities

### 10.1 Principle

Authorization entities are **security records** — use soft delete for all, hard delete only for transient secrets after retention expiry.

### 10.2 Update Cascades — Session Revocation Triggers

| Change | Cascade Action |
|---|---|
| Role permission changed (privileged) | Revoke all active sessions of affected users immediately |
| Role permission changed (non-privileged) | Invalidate permission cache; sessions may continue |
| User location scope changed | Invalidate auth cache, recompute effective access, revoke scoped sessions |
| Tenant disabled | Revoke ALL tenant sessions and persistent tokens immediately |
| User suspended / disabled | Revoke all sessions and remember-me tokens immediately |
| Password changed / reset | Revoke all sessions and remember-me tokens (see Sections 5, 6) |

### 10.3 Delete Cascades

| Entity Deleted | Rule |
|---|---|
| Role | Soft delete only; end all active user-role assignments; historical audit stays linked |
| User | Soft delete → disabled state; retain audit/security events; anonymize PII per GDPR three-state (Rule 03) |
| Permission | Disallow if still assigned; require prior detachment or replacement |
| Location | Disallow if active users/records depend on it; require migration/end-dating first |
| Password reset tokens | May hard delete after expiry + retention window; audit record must remain |
| Session tokens | May hard delete after expiry + retention window; audit record must remain |

---

## 11. Suggested Data Model (Adapted to Project Conventions)

> Column naming follows Rule 05 (PascalCase, `Utc` suffix, `TenantId` pattern).
> All tenant-owned tables include mandatory columns from Rule 05.
> Schema assignment follows Rule 05: `auth.*` for authentication entities.

### 11.1 Core Authorization Tables

```csharp
// auth.Role
public class Role
{
    public int Id { get; set; }
    public Guid? TenantId { get; set; }             // nullable for global platform roles
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsPrivileged { get; set; } = false;
    public bool IsSystem { get; set; } = false;
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; } = false;
    public DateTime CreatedAtUtc { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime? UpdatedAtUtc { get; set; }
    public string? UpdatedBy { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}

// auth.RoleHierarchy
public class RoleHierarchy
{
    public int ParentRoleId { get; set; }
    public int ChildRoleId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    // Unique constraint: (ParentRoleId, ChildRoleId)
}

// auth.Permission
public class Permission
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;          // format: module.entity.action
    public string ResourceType { get; set; } = string.Empty;  // e.g. "page", "api", "report"
    public string Action { get; set; } = string.Empty;        // e.g. "view", "edit", "delete"
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; } = false;
    public DateTime CreatedAtUtc { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
}

// auth.RolePermission
public class RolePermission
{
    public int RoleId { get; set; }
    public int PermissionId { get; set; }
    public string Effect { get; set; } = "ALLOW";    // ALLOW only for MVP
    public DateTime CreatedAtUtc { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public bool IsDeleted { get; set; } = false;
}

// auth.UserRole
public class UserRole
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    public int RoleId { get; set; }
    public string? ScopeType { get; set; }             // e.g. "Location", "Branch", "Department"
    public string? ScopeId { get; set; }
    public DateTime? EffectiveFromUtc { get; set; }
    public DateTime? EffectiveToUtc { get; set; }
    public string AssignedBy { get; set; } = string.Empty;
    public bool IsDeleted { get; set; } = false;
    public DateTime CreatedAtUtc { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
}

// auth.UserPermissionOverride
public class UserPermissionOverride
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    public int PermissionId { get; set; }
    public string Effect { get; set; } = string.Empty;  // "ALLOW" | "DENY"
    public string? ScopeType { get; set; }
    public string? ScopeId { get; set; }
    public DateTime? EffectiveFromUtc { get; set; }
    public DateTime? EffectiveToUtc { get; set; }
    public string? Reason { get; set; }
    public string? ApprovedBy { get; set; }
    public bool IsDeleted { get; set; } = false;
    public DateTime CreatedAtUtc { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
}
```

### 11.2 Authentication Lifecycle Tables

```csharp
// auth.PasswordHistory (see Section 4.3)

// auth.PasswordResetToken
public class PasswordResetToken
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;     // hashed at rest
    public string Channel { get; set; } = string.Empty;       // "EMAIL" | "SMS"
    public DateTime IssuedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? UsedAtUtc { get; set; }
    public string? RequestIp { get; set; }
    public string? RequestUserAgent { get; set; }
    public bool IsDeleted { get; set; } = false;
}

// auth.Session
public class Session
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TenantId { get; set; }
    public string SessionType { get; set; } = string.Empty;    // "WEB" | "API"
    public string SessionSecretHash { get; set; } = string.Empty;
    public string? DeviceId { get; set; }
    public string? DeviceLabel { get; set; }
    public string? IpFirst { get; set; }
    public string? IpLast { get; set; }
    public string? CountryFirst { get; set; }
    public string? CountryLast { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? LastSeenAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? RevokedAtUtc { get; set; }
    public string? RevokeReason { get; set; }
}

// auth.RememberMeToken (see Section 8.2)

// auth.UserLocationScope
public class UserLocationScope
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TenantId { get; set; }
    public int LocationId { get; set; }
    public int? RoleId { get; set; }
    public DateTime? EffectiveFromUtc { get; set; }
    public DateTime? EffectiveToUtc { get; set; }
    public string AssignedBy { get; set; } = string.Empty;
    public bool IsDeleted { get; set; } = false;
    public DateTime CreatedAtUtc { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
}
```

### 11.3 Extended User Fields (Add to Existing auth.User Entity)

```csharp
// These fields extend the user entity from Rule 03:
public string? PasswordSalt { get; set; }
public string PasswordAlgo { get; set; } = "argon2id";
public string? PasswordParamsJson { get; set; }
public int PasswordVersion { get; set; } = 1;
public DateTime? LastPasswordChangeAtUtc { get; set; }
public int FailedLoginCount { get; set; } = 0;
public DateTime? LastFailedLoginAtUtc { get; set; }
public DateTime? TempLockedUntilUtc { get; set; }
public DateTime? SuspendedAtUtc { get; set; }
```

---

## 12. Required Config Keys

All config keys below go into `cfg.ConfigValue`. Scope: `TENANT` unless marked `GLOBAL`.

| Key | Type | Default | Scope | Purpose |
|---|---|---|---|---|
| `PASSWORD_MIN_LENGTH_NO_MFA` | int | 15 | TENANT | Min password length without MFA |
| `PASSWORD_MIN_LENGTH_WITH_MFA` | int | 12 | TENANT | Min password length with MFA |
| `PASSWORD_MAX_LENGTH` | int | 128 | TENANT | Max password length |
| `PASSWORD_HISTORY_DEPTH` | int | 5 | TENANT | Number of previous passwords to check |
| `PASSWORD_FORCE_ROTATION` | bool | false | TENANT | Only enable on suspected compromise |
| `PASSWORD_RESET_TOKEN_TTL_PRIVILEGED` | int | 15 | TENANT | Reset token TTL (minutes) for privileged users |
| `PASSWORD_RESET_TOKEN_TTL_STANDARD` | int | 30 | TENANT | Reset token TTL (minutes) for standard users |
| `AUTH_MAX_FAILED_ATTEMPTS` | int | 5 | TENANT | Failed attempts before lockout |
| `AUTH_FAILED_WINDOW_MINUTES` | int | 15 | TENANT | Window for counting failures |
| `AUTH_LOCKOUT_DURATION_MINUTES` | int | 15 | TENANT | Initial lockout duration |
| `AUTH_LOCKOUT_ESCALATION_MINUTES` | string | "30,60" | TENANT | CSV of escalating durations |
| `AUTH_LOCKOUT_REQUIRE_CAPTCHA_AFTER` | int | 2 | TENANT | Lock cycles before CAPTCHA |
| `RBAC_MAX_HIERARCHY_DEPTH` | int | 5 | GLOBAL | Max role hierarchy depth |
| `RBAC_REQUIRE_DUAL_APPROVAL_PRIVILEGED` | bool | false | TENANT | Dual approval for privileged grants |
| `SESSION_REMEMBER_ME_PRIVILEGED_ALLOWED` | bool | false | TENANT | Allow remember-me for privileged roles |
| `SESSION_REMEMBER_ME_TTL_DAYS` | int | 30 | TENANT | Remember-me TTL for standard users |
| `SESSION_REMEMBER_ME_TTL_PRIVILEGED_DAYS` | int | 7 | TENANT | Remember-me TTL for privileged roles |

---

## 13. Required Audit Events (Supplement to Rule 03)

These events supplement the audit events already defined in Rule 03:

| Event | When |
|---|---|
| `USER.PASSWORD_CHANGED` | Authenticated password change completed |
| `USER.TEMP_LOCKED` | Account temporarily locked due to failed attempts |
| `USER.TEMP_UNLOCKED` | Temporary lock expired (auto-unlock) |
| `USER.ADMIN_UNLOCKED` | Admin manually unlocked an account |
| `USER.SUSPENDED` | Account suspended by admin/compliance action |
| `USER.LOCATION_TRANSFERRED` | User reassigned from one business location to another |
| `SESSION.ALL_REVOKED` | All sessions revoked for a user (password reset, security action) |
| `SESSION.DEVICE_REVOKED` | Specific device session revoked |
| `SESSION.RISK_STEP_UP` | Risk-based re-authentication triggered |
| `SESSION.IMPOSSIBLE_TRAVEL` | Impossible travel detected |
| `REMEMBER_ME.ISSUED` | Persistent login token issued |
| `REMEMBER_ME.ROTATED` | Persistent login token rotated on use |
| `REMEMBER_ME.REVOKED` | Persistent login token revoked |
| `RBAC.HIERARCHY_CHANGED` | Role parent/child relationship modified |
| `RBAC.USER_OVERRIDE_GRANTED` | User-specific permission override granted |
| `RBAC.USER_OVERRIDE_REVOKED` | User-specific permission override revoked |
| `RBAC.OVERRIDE_REJECTED_REDUNDANT` | Override rejected because it duplicates role-derived permission |

---

## 14. Implementation Phases

### Phase 1: Data Model and Core Authorization
- Create core RBAC tables (hierarchy, permissions, overrides) with indexes
- Build recursive role hierarchy resolution (CTE)
- Build authorization service: `AssignRole`, `RevokeRole`, `GrantRolePermission`, `RevokeRolePermission`, `GrantUserOverride`, `RevokeUserOverride`, `CanAccess`
- Enforce redundant-override rejection
- Add audit writer for all RBAC mutations

### Phase 2: Authentication Lifecycle
- Implement password policy validator (length, Unicode, blocklist, history)
- Implement Argon2id password storage with version tracking
- Build forgot-password flow with opaque hashed tokens
- Build change-password flow with re-auth + session rotation
- Add session rotation + revoke-all capability

### Phase 3: Account Protection and Risk Controls
- Implement failed-login counters, throttling, temporary lockout
- Implement admin unlock workflow (reason + approval + audit)
- Build risk engine inputs (device familiarity, IP/ASN/country, impossible travel)
- Implement adaptive re-auth / MFA step-up
- Add remember-me token family with rotation

### Phase 4: Admin UI
- Roles list/detail with hierarchy graph
- Permission catalog with search/filter
- User access screen (inherited + effective permissions + overrides + why-access)
- Session/device management screen (active sessions, remembered devices, revoke)
- Access review and approval screens

### Phase 5: Privacy and Compliance
- DSR workflow for export/anonymize/delete
- Retention policy job by data class
- Audit export to SIEM/WORM target
- Cross-location transfer workflow

---

## 15. Success Criteria and KPIs

### The system is considered successful when:
- All page/API access checks are centrally enforced
- Role hierarchy resolves correctly with zero cycles
- User overrides are used only as exceptions
- Redundant overrides trend toward zero
- Password resets and changes revoke old sessions correctly
- Lockout rules reduce brute-force without excessive user lockouts
- Remember-me tokens are revocable per device
- Location/device changes trigger expected adaptive controls
- Auditors can reconstruct: who, why, when, what changed, from where, with what outcome

### Suggested KPIs
- % of permissions granted via roles vs direct overrides
- Count of active privileged users
- Count of expired but unreconciled grants
- Number of denied access attempts on sensitive pages
- Mean time to revoke access after password reset
- Mean time to unlock legitimate users
- Number of remembered devices per active user
- Rate of high-risk login challenges
- Mean time to produce audit evidence for an access change

---

## References

1. NIST SP 800-63B / SP 800-63-4 — password guidance
2. OWASP Authentication Cheat Sheet
3. OWASP Forgot Password Cheat Sheet
4. OWASP Session Management Cheat Sheet
5. OWASP Password Storage Cheat Sheet
6. GDPR Articles 5, 25, 32, 33

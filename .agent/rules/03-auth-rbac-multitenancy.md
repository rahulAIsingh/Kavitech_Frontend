---
trigger: always_on
priority: 5
---

# 03 - Authentication, RBAC, and Multi-Tenancy Rules

> AI ASSISTANT: These rules are always active. Violations here are hard blockers.
> For auth-specific tasks, also check `00-trigger-map.md` → TRIGGER: Writing auth code.
> For detailed role hierarchy, permission overrides, password lifecycle, lockout, remember-me, and session management, load `17-role-user-management-spec.md`.

---

## Pre-Authentication Tenant Resolution (CRITICAL — follow exactly)

This resolves the bootstrap dependency loop. Follow this sequence every time a request arrives, before the auth pipeline runs:

```
Request arrives
    ↓
1. Extract hostname from HttpContext.Request.Host (NOT from body or query string)
    ↓
2. Look up hostname in auth.TenantDomain table
   (cache in IMemoryCache with 5-minute TTL, invalidate on tenant config change)
    ↓
3a. Not found → return 404 (do NOT reveal that tenant does not exist)
3b. Found     → set HttpContext.Items["TenantId"] = resolvedTenantId
    ↓
4. Read auth mode from cached cfg.ConfigValue for this TenantId
   Key: AUTH_MODE   Values: LOCAL | OIDC | LDAP | HYBRID
    ↓
5. Route to correct auth handler based on auth mode
    ↓
6. After auth completes: validate JWT TenantId claim == resolved TenantId
   If mismatch → reject with 403 (possible token reuse across tenants)
```

❌ NEVER read TenantId from request body, query string, or client-provided header.
❌ NEVER skip step 6 (JWT TenantId claim validation post-auth).

---

## Authentication Modes

The solution must support configurable authentication modes per tenant (read from `cfg.ConfigValue`, key: `AUTH_MODE`):

| Mode | Description |
|---|---|
| `LOCAL` | Username + password stored in `auth.UserCredential` with hashed password |
| `OIDC` | OpenID Connect code flow with PKCE via configured external provider |
| `LDAP` | Active Directory / LDAP bind |
| `HYBRID` | LOCAL + OIDC both allowed, tenant decides which users use which |

---

## Authentication Rules

### Local DB Login

✅ DO (PREFERRED — Argon2id):
```csharp
// Password hashing on create/change (preferred):
var hash = Argon2id.HashPassword(newPassword, new Argon2idOptions {
    MemorySize = 65536, Iterations = 3, DegreeOfParallelism = 4
});

// Password verification:
var isValid = Argon2id.VerifyHash(inputPassword, storedHash);
```

✅ DO (ACCEPTABLE FALLBACK — BCrypt):
```csharp
// If Argon2id library is unavailable:
var hash = BCrypt.Net.BCrypt.HashPassword(newPassword, workFactor: 12);
var isValid = BCrypt.Net.BCrypt.Verify(inputPassword, storedHash);
```

❌ DON'T:
```csharp
var hash = MD5.HashData(Encoding.UTF8.GetBytes(password));        // VIOLATION
var hash = Convert.ToBase64String(Encoding.UTF8.GetBytes(password)); // VIOLATION
```

> For detailed password policy, history, forgot-password, and change-password flows, see `17-role-user-management-spec.md` Sections 4–6.

Required lifecycle support:
- Password policy (min length, blocklist, history) — from `cfg.PasswordPolicy` per tenant
- Account lockout after N failed attempts — N from `cfg.ConfigValue` key: `AUTH_MAX_FAILED_ATTEMPTS`
- Force reset on first login — from `cfg.PasswordPolicy.ForceResetOnFirstLogin`
- Account statuses: `Active`, `Pending`, `TempLocked`, `Suspended`, `Disabled`, `SoftDeleted`

> `TempLocked` = automated security throttle (auto-unlocks). `Suspended` = manual admin action. These are NOT equivalent — see `17-role-user-management-spec.md` Section 7.

### SSO / OIDC

- Use confidential client code flow with PKCE
- Per-provider settings come from `cfg.AuthProvider` table (never hardcoded)
- Claims mapping must come from `cfg.ClaimsMappingProfile` (never hardcoded)
- JIT (Just-In-Time) user provisioning must be:
  - Controlled by config: `AUTH_JIT_PROVISIONING_ENABLED`
  - Explicitly audited with event `USER.JIT_PROVISIONED`

### MFA

- MFA requirement comes from `cfg.MfaPolicy` (never hardcoded per role or user)
- Supported factors driven by `cfg.MfaPolicy.AllowedFactorsJson`
- Emergency bypass requires: approval record + audit event `MFA.BYPASS_USED`

---

## Bootstrap Admin Rule

❌ NEVER use a permanent fixed default super-admin credential in source or docs.

✅ DO — three-step bootstrap:
1. Seed a single bootstrap admin record in controlled deployment setup
2. Set initial password via environment variable at deploy time only (not in source)
3. Force first-login password reset immediately
4. Disable the bootstrap seeder route after first successful login by admin

---

## Authorization Model

Permission keys follow this format: `module.entity.action`

Examples:
```
users.profile.view
users.profile.edit
orders.invoice.delete
finance.report.export
admin.tenant.configure
```

Permission evaluation must happen in ALL of these layers:
1. **UI rendering** — hide/show buttons and screens
2. **API controller** — authorize before any business execution
3. **Service layer** — re-verify for sensitive operations (defense in depth)
4. **Data scoping** — filter query results to allowed scope

✅ DO — permission check pattern:
```csharp
// In controller — before business execution
if (!await _permissionEvaluator.HasPermissionAsync(
    _currentUser.UserId, "orders.invoice.delete", _tenantContext.TenantId))
{
    return Forbid();
}

// In UI — before rendering action
{hasPermission('orders.invoice.delete') && (
    <button onClick={handleDelete}>Delete</button>
)}
```

❌ DON'T:
```csharp
if (user.Role == "Admin") { DeleteInvoice(); }  // inline role check — VIOLATION
if (user.IsAdmin) { allow = true; }             // bypass — VIOLATION
```

---

## Multi-Tenancy Model

### Default (use unless project requires otherwise)
**Shared database + TenantId discriminator + automatic EF global query filters**

### EF Global Query Filter Pattern

```csharp
// In DbContext.OnModelCreating:
modelBuilder.Entity<Order>()
    .HasQueryFilter(o => o.TenantId == _tenantContext.TenantId && !o.IsDeleted);

// Every tenant-owned entity MUST have this filter configured.
// Manual .Where(x => x.TenantId == ...) in queries is the EXCEPTION, not the norm.
```

### Tenant Isolation Checklist

Every piece of code that accesses tenant-owned data must verify:
- [ ] TenantId comes from `_tenantContext` (middleware-resolved), not from client
- [ ] EF global query filter is configured (or manual filter is intentional and documented)
- [ ] Cache keys include TenantId
- [ ] Job execution includes TenantId in context
- [ ] File access includes TenantId in the storage path or metadata
- [ ] Export/import is constrained to the resolved tenant scope

---

## Delete Model (Three-State — reconciles Soft Delete with GDPR)

Business records must support three deletion states:

```
Active
  ↓ (user deletes)
SoftDeleted — record hidden from normal queries, data intact
              IsDeleted = true, DeletedAtUtc = now, DeletedBy = userId
  ↓ (GDPR erasure request OR retention window expires)
Anonymized — PII fields wiped, record shell kept for FK/audit integrity
             Name = "[Anonymized]", Email = null, Phone = null, etc.
             AnonymizedAtUtc = now, AnonymizedBy = userId
  ↓ (retention purge window passes)
Purged — full hard delete from DB
         Only by scheduled purge job after legal hold check
```

❌ NEVER keep a SoftDeleted record with PII indefinitely — this violates GDPR.
❌ NEVER hard-delete without going through the three-state model for business records.

---

## Required Audit Events for Auth

| Event | When |
|---|---|
| `USER.LOGIN_SUCCESS` | Successful login (any mode) |
| `USER.LOGIN_FAILURE` | Failed login attempt |
| `USER.LOGOUT` | Explicit logout |
| `USER.LOCKOUT` | Account locked due to failed attempts |
| `USER.PASSWORD_RESET_REQUESTED` | Reset flow initiated |
| `USER.PASSWORD_RESET_COMPLETED` | Password changed via reset |
| `MFA.CHALLENGED` | MFA step triggered |
| `MFA.SUCCEEDED` | MFA passed |
| `MFA.FAILED` | MFA failed |
| `MFA.BYPASS_USED` | Emergency bypass used (requires approval audit) |
| `SSO.LINKED` | External provider linked to user |
| `SSO.UNLINKED` | External provider unlinked |
| `RBAC.ROLE_GRANTED` | Role assigned to user |
| `RBAC.ROLE_REVOKED` | Role removed from user |
| `RBAC.PERMISSION_CHANGED` | Permission set modified for role |
| `USER.ACTIVATED` | Account activated |
| `USER.DEACTIVATED` | Account deactivated |
| `USER.TENANT_ASSIGNED` | User added to a tenant |

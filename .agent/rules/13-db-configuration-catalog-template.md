---
trigger: new_config_key, new_module
---

# 13 - DB Configuration Catalog Template

> AI ASSISTANT: Load this file when adding a new configuration key or setting up a new module that requires tenant-variable behavior.
> Use the decision tree below before creating any config entry.

---

## Configuration Decision Tree (Use Before Adding ANY Config)

```
Is this value different per tenant?
  ├── YES → Put in cfg.ConfigValue with ScopeType = TENANT
  └── NO  → Is this a secret (key, password, token, certificate)?
              ├── YES → Put in secure secret store ONLY
              │         Store reference name in cfg.SecretReference
              │         DO NOT store the value in any DB column
              └── NO  → Is this environment-level (changes dev vs prod)?
                          ├── YES → Put in appsettings.{env}.json or environment variable
                          └── NO  → Put in cfg.ConfigValue with ScopeType = GLOBAL
```

---

## Scope Hierarchy (Resolution Order)

Config is resolved by this priority — higher scope overrides lower:

```
1. User       (highest priority — user-specific override)
2. Role
3. Site / Location
4. Tenant
5. Environment
6. Global     (lowest — the default fallback)
```

**Start simple**: implement GLOBAL and TENANT scopes first. Add User/Role/Site scope only when a real business requirement demands it.

---

## Config Key Naming Convention

```
MODULE_SETTING_NAME

Examples:
AUTH_MODE                          — login mode (LOCAL|OIDC|HYBRID)
AUTH_MAX_LOGIN_ATTEMPTS            — lockout threshold
AUTH_MFA_ENABLED                   — MFA on/off
SESSION_IDLE_TIMEOUT_MINUTES       — session idle limit
SESSION_ACCESS_TOKEN_MINUTES       — token lifetime
FEATURE_IMPORT_ENABLED             — import feature on/off
FILE_MAX_UPLOAD_SIZE_MB            — upload size cap
ORDER_APPROVAL_THRESHOLD           — approval required above this amount
NOTIFICATION_EMAIL_ENABLED         — email notifications on/off
RETENTION_DAYS_DEFAULT             — default retention window

-- Regional / Timezone keys (TENANT scope):
REGIONAL_TIMEZONE_DEFAULT          — IANA timezone ID (e.g. "Asia/Kolkata") — NOT Windows name
REGIONAL_LOCALE_CODE               — locale code (e.g. "en-IN", "en-US")
REGIONAL_DATE_FORMAT               — display format ("DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD")
REGIONAL_CURRENCY_CODE             — ISO 4217 currency (e.g. "INR", "USD", "EUR")
REGIONAL_NUMBER_FORMAT             — number grouping ("1,00,000" for IN | "100,000" for US)

-- Timezone Display keys (TENANT scope):
TIMEZONE_DISPLAY_MODE              — "station" | "user" (how times are displayed)
TIMEZONE_STATION_DEFAULT           — IANA ID of operational station (e.g. "Africa/Johannesburg")
TIMEZONE_SYSTEM_DEFAULT            — IANA ID global fallback (e.g. "UTC") — GLOBAL scope
TIMEZONE_USER_OVERRIDE_ALLOWED     — BOOL: can users override display mode?
```

> ⚠️ TIMEZONE CONFIG RULE: `REGIONAL_TIMEZONE_DEFAULT` value MUST be a valid IANA timezone ID.
> Always validate with `TimeZoneInfo.FindSystemTimeZoneById()` before saving.
> NEVER accept Windows timezone names (e.g. "India Standard Time") — they break on Linux containers.

---

## Required Tables

### `cfg.ConfigCategory`
Group keys logically:
```sql
Id, Code, Name, Description, IsActive

-- Seed categories:
AUTH, MFA, SESSION, BRANDING, UI, WORKFLOW,
NOTIFICATION, RETENTION, ARCHIVE, INTEGRATION, REPORTING, FILE, REGIONAL, TIMEZONE
```

### `cfg.ConfigKey`
Define the contract for each key:
```sql
Id, CategoryId, KeyCode, Name, Description,
DataType,              -- STRING|INT|DECIMAL|BOOL|JSON
AllowedScopeMask,      -- bitmask: 1=GLOBAL,2=TENANT,4=SITE,8=ROLE,16=USER
DefaultValue,
AllowedValuesJson,     -- e.g. ["LOCAL","OIDC","HYBRID"] for enum keys
ValidationRegex,
IsSecretReference,     -- TRUE if this key references a secret store entry
IsRequired,
IsRuntimeCached,
CacheTtlSeconds,
SupportsEffectiveDates,
RequiresApproval,      -- TRUE if change requires approval workflow
OwningModule,
IsActive
```

### `cfg.ConfigValue`
Actual scoped values:
```sql
Id, ConfigKeyId, ScopeType, ScopeId,
ValueText,       -- for simple scalar values
ValueJson,       -- for complex or structured values
EffectiveFromUtc, EffectiveToUtc,
IsActive,
ChangedReason,   -- why was this changed (audit trail)
ApprovedBy,
CreatedAtUtc, CreatedBy, UpdatedAtUtc, UpdatedBy
```

### `cfg.ConfigValueHistory`
Immutable history of every config change:
```sql
-- Append-only. No UPDATE or DELETE allowed by application.
Id, ConfigValueId, OldValue, NewValue,
ChangedBy, ChangedAtUtc, ChangedReason, CorrelationId
```

### `cfg.FeatureFlag`
```sql
Id, Code, Name, Description,
DefaultState,        -- ON|OFF
RolloutType,         -- ALL|TENANT_LIST|PERCENTAGE|PILOT_GROUP
StartAtUtc, EndAtUtc,
KillSwitchEnabled,   -- emergency off switch
OwningModule,
IsActive
```

### `cfg.AuthProvider` (for SSO providers)
```sql
Id, ProviderCode, ProviderType,   -- LOCAL|OIDC|ENTRA|GOOGLE|OKTA|ADFS|SAML
DisplayName, AuthorityUrl, MetadataUrl,
ClientId,
ClientSecretRef,     -- reference to cfg.SecretReference, NEVER the actual secret
CertificateRef,      -- reference name only
DomainWhitelistJson,
ClaimProfileId,      -- FK to cfg.ClaimsMappingProfile
IsActive
```

### `cfg.SecretReference`
**Store reference names ONLY — never the actual secret value:**
```sql
Id, RefCode, ProviderType,    -- KEYVAULT|ENV_VAR|AWS_SSM
VaultUri, SecretName, KeyName,
CertificateThumbprint,
Notes, IsActive

-- CORRECT use: auth provider row points to SecretReference row
-- WRONG use: storing "clientSecret": "actual-secret-value" anywhere in DB
```

### `cfg.PasswordPolicy`
```sql
Id, Code, TenantId (nullable — null = global default),
MinLength, MaxLength,
RequireUpper, RequireLower, RequireDigit, RequireSpecial,
HistoryCount,          -- cannot reuse last N passwords
ExpiryDays,            -- 0 = no expiry
MaxFailedAttempts,
LockoutMinutes,
ForceResetOnFirstLogin,
IsActive
```

### `cfg.SessionPolicy`
```sql
Id, Code, TenantId (nullable),
AccessTokenMinutes, RefreshTokenDays,
IdleTimeoutMinutes, AbsoluteTimeoutMinutes,
SingleSessionOnly, RememberMeAllowed,
ReauthForSensitiveActions,
IsActive
```

---

## Config Resolution Service Contract

```csharp
// All business code reads config through this service ONLY:
public interface IConfigResolver
{
    Task<T> GetAsync<T>(string keyCode, Guid tenantId, string scopeType = "TENANT");
    Task<bool> IsFeatureEnabledAsync(string flagCode, Guid tenantId);
    void InvalidateCache(Guid tenantId, string? keyCode = null);
}

// CORRECT usage:
var maxAttempts = await _configResolver.GetAsync<int>("AUTH_MAX_LOGIN_ATTEMPTS", tenantId);
var isEnabled = await _configResolver.IsFeatureEnabledAsync("FEATURE_IMPORT_ENABLED", tenantId);

// WRONG — direct DB reads from feature code:
var value = await _context.ConfigValues.FirstOrDefaultAsync(v => v.ConfigKeyId == 5);
```

---

## Non-Negotiable Rules

- No tenant-specific behavior hardcoded in source (use cfg.ConfigValue)
- No raw secrets stored in any cfg.* table column
- All config changes must be captured in cfg.ConfigValueHistory
- Cache must be tenant-aware and invalidated on change

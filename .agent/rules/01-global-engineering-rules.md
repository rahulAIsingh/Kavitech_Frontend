---
trigger: always_on
priority: 4
---

# 01 - Global Engineering Rules

## Purpose

These rules apply to **all modules, all commits, all environments, and all projects** unless an approved project override exists in `project-overrides.md`.

---

## Core Principles

### 1. Configuration Over Hardcoding

✅ DO:
- Read business thresholds from `cfg.ConfigValue` table via `IConfigResolver`
- Read feature flags from `cfg.FeatureFlag` via `IFeatureFlagService`
- Read auth mode, MFA settings, branding, retention windows from config tables

❌ DON'T:
```csharp
if (tenant.Name == "ACME") { ... }             // tenant-specific hardcode
if (tenant.Code == "T001") { EnableBonus(); }  // tenant-specific hardcode
const int MAX_RETRIES = 3;                      // magic number (put in config)
var days = 90;                                   // magic number (put in config)
```

---

### 2. Standardized Module Expectations

Every module must define (fill this before writing code):
- **scope** — what this module owns
- **entities** — DB tables it owns
- **permission keys** — format `module.entity.action` (e.g. `orders.invoice.delete`)
- **config keys** — format `MODULE_SETTING` (e.g. `ORDER_APPROVAL_THRESHOLD`)
- **audit events** — what actions generate audit records
- **validations** — field-level and business-rule validations
- **API endpoints** — list of routes
- **UI screens** — list of screens and components
- **import/export needs** — only for Operational Masters (see taxonomy below)
- **retention impact** — does this module store PII or regulated data?
- **tests** — minimum: one unit test per business rule, one integration test per API

---

### 3. No Hidden Logic

❌ NEVER:
- Magic constants in application logic (use named config keys)
- Silent fallback for security or tenant resolution (fail explicitly, never silently)
- Undocumented background jobs
- Implicit permission bypass for "admin" users (admins still go through permission evaluator)

---

### 4. UTC First

✅ DO:
```csharp
public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
public DateTime? UpdatedAtUtc { get; set; }
```

❌ DON'T:
```csharp
public DateTime CreatedAt { get; set; }    // missing Utc suffix
public DateTime CreatedAt { get; set; } = DateTime.Now;  // local time!
```

**Display rule**: Convert UTC to tenant/user timezone ONLY at the UI rendering layer. Never convert in business logic or DB queries.

### Timezone Standards (Follow Exactly)

**Always use IANA timezone IDs — never Windows timezone names:**

| ✅ CORRECT (IANA) | ❌ WRONG (Windows) |
|---|---|
| `"Asia/Kolkata"` | `"India Standard Time"` |
| `"America/New_York"` | `"Eastern Standard Time"` |
| `"Europe/London"` | `"GMT Standard Time"` |
| `"UTC"` | `"Coordinated Universal Time"` |

**Why**: IANA IDs work on Linux, macOS, and Windows. Windows timezone names work only on Windows. Since .NET 6+ on Linux is common for containers, using Windows names will break on non-Windows deployments.

**Timezone Hierarchy (resolution order):**
```
User.TimezoneId (if set, highest priority)
    ↓ NULL → use
Tenant.TimezoneId (tenant default)
    ↓ NULL → use
"UTC" (fallback, never assume a local timezone)
```

**Backend rule**: Resolve the display timezone in the API response or let the frontend resolve it. Never convert stored UTC datetimes to local time inside EF queries or business logic.

**Validate IANA IDs on input:**
```csharp
// CORRECT — validate IANA timezone before saving:
try {
    TimeZoneInfo.FindSystemTimeZoneById(request.TimezoneId); // .NET 6+ accepts IANA on all OS
} catch (TimeZoneNotFoundException) {
    return BadRequest(ApiError.Validation("Invalid timezone ID", "timezoneId", correlationId));
}
```

---

### 5. Auditability by Design

Every security-sensitive and business-critical action must record:
- **who** (UserId / system identity)
- **what** (EventType, EntityType, EntityId, BeforeValue, AfterValue)
- **when** (PerformedAtUtc in UTC)
- **where** (TenantId, Channel: WEB / API / JOB / IMPORT)
- **outcome** (SUCCESS / FAILURE)

See `09-audit-logging-monitoring-dr.md` for the full audit event structure and `00-trigger-map.md` for the code template.

---

### 6. Safe Defaults

- New modules start with feature flag = **disabled** until permissions, configs, and visibility rules are verified
- No unsafe defaults (e.g. `IsActive = true` for a new user before email verification)
- Temporary bypasses must have: written justification, time-box date, and owner name in code comment

---

## Coding Rules

### General
- Use clean, deterministic naming (no abbreviations unless universally understood)
- Keep controllers/endpoints thin — orchestrate only
- Business rules live in Services or Domain layer, never in Controllers
- Avoid duplication — create reusable services/components before copying code
- Do not commit dead code, commented-out old code, or speculative abstractions

### Data Access
- All data access must be tenant-aware where relevant (use global query filters)
- AsNoTracking() for all read-only queries (listings, reports)
- Use tracked entities for writes
- Do NOT use `.ToLower()` in EF LINQ queries (see `99-anti-patterns.md`)

### Error Handling
- Return user-safe errors always
- Log technical details internally with correlation ID
- Do NOT expose: stack traces, SQL fragments, connection details, or internal object names

### Security
- Never log: secrets, tokens, plaintext passwords, OTPs, or full sensitive identifiers
- Never put secret defaults in source code, seed data, or README files
- Never create permanent backdoor users or static super-admin passwords

---

## Master Data Taxonomy

Use this taxonomy to determine what capabilities a data entity needs:

### Tier 1 — Seed / Lookup Data (system-owned, never user-imported)
> Examples: Country, Currency, StatusCode, MimeType, DayOfWeek

Required capabilities:
- Code, Name, Description, IsActive, IsSystem, DisplayOrder columns
- Read-only API (no user create/edit)

NOT required:
- Import / Export
- User audit trail (system-managed)
- Quick-add from UI

---

### Tier 2 — Reference Master (admin-managed, rarely changes)
> Examples: ProductCategory, AccountType, ServiceTier, DocumentType

Required capabilities:
- Full CRUD with admin permission
- Archive / Deactivate
- Permission control
- Basic audit (created/updated events)

NOT required (add only if explicitly requested):
- Bulk import
- Export

---

### Tier 3 — Operational Master (user-managed, fully featured)
> Examples: Customer, Vendor, Employee, Contract, Asset

Required capabilities:
- Full CRUD with permission control
- Archive / Deactivate / Restore
- Search, filter, sort, paginate
- **Import with validation, preview, partial success, and error report**
- **Export (async for large datasets)**
- Full audit trail (field-level change history)
- Quick-add (when business-safe)
- Duplicate prevention (Code or Name uniqueness)

Standard fields for Operational Master entities:
```csharp
public int Id { get; set; }
public Guid TenantId { get; set; }
public string Code { get; set; } = string.Empty;
public string Name { get; set; } = string.Empty;
public string? Description { get; set; }
public bool IsActive { get; set; } = true;
public bool IsSystem { get; set; } = false;
public int DisplayOrder { get; set; }
public DateTime? EffectiveFromUtc { get; set; }
public DateTime? EffectiveToUtc { get; set; }
public bool IsDeleted { get; set; } = false;
public DateTime CreatedAtUtc { get; set; }
public string CreatedBy { get; set; } = string.Empty;
public DateTime? UpdatedAtUtc { get; set; }
public string? UpdatedBy { get; set; }
public byte[] RowVersion { get; set; } = Array.Empty<byte>();
```

---

## Rule for New Features

No feature is considered complete until:
- [ ] Authorization (permission keys defined and enforced)
- [ ] Audit (events written for all mutations)
- [ ] Configuration (no hardcoded variability)
- [ ] Validation (client + server side)
- [ ] Monitoring (error rate, health impact reviewed)
- [ ] Failure handling (what happens when it fails?)
- [ ] Test coverage (unit + integration)
- [ ] Deployment impact (migration, rollback path)
- [ ] Documentation impact (release notes entry)

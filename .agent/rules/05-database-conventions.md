---
trigger: always_on
priority: 6
---

# 05 - Database Conventions and SQL Rules

> AI ASSISTANT: These rules are always active. Apply column templates exactly as shown.
> When creating any new DB table or EF entity, run the DB checklist in `15-ai-self-check.md` Section 3.

---

## Database Philosophy

- SQL Server is the transactional source of truth for this ruleset.
- Use EF Core as the primary CRUD abstraction.
- Use reviewed raw SQL / stored procedures for bulk, reporting, or performance-critical paths.

---

## Schema Assignment

| Schema | Purpose |
|---|---|
| `auth` | Authentication, users, roles, permissions |
| `cfg` | Configuration, feature flags, policies |
| `core` | Core shared business entities |
| `ref` | Lookup / reference / seed data |
| `ops` | Operational transactions |
| `audit` | Audit and activity history |
| `file` | Document / file metadata |
| `job` | Background jobs and execution logs |
| `intg` | Integration state and connector logs |
| `rpt` | Reporting / read model objects |
| `notification` | Notification and alert tables (event types, rules, templates, recipients, delivery, DLQ, escalation, archive) |

---

## Naming Rules (Always Follow)

| Object | Convention | Example |
|---|---|---|
| Schema | short lowercase | `auth`, `cfg`, `ops` |
| Table | singular PascalCase | `Order`, `CustomerProfile` |
| Column | PascalCase | `CreatedAtUtc`, `TenantId` |
| Primary key | `Id` | `Id` |
| Foreign key | `{EntityName}Id` | `OrderId`, `TenantId` |
| Tenant column | `TenantId` | `TenantId` |
| Concurrency | `RowVersion` | `RowVersion` |
| UTC timestamp | suffix `Utc` | `CreatedAtUtc`, `DeletedAtUtc` |
| Boolean | prefix `Is` or `Has` | `IsDeleted`, `IsActive`, `HasApproval` |

---

## Mandatory Columns — Tenant-Owned Business Records

```csharp
// REQUIRED on every tenant-owned business entity:
public int Id { get; set; }                           // or Guid — see key rules
public Guid TenantId { get; set; }                    // MANDATORY
public bool IsDeleted { get; set; } = false;          // MANDATORY — soft delete
public DateTime CreatedAtUtc { get; set; }            // MANDATORY
public string CreatedBy { get; set; } = string.Empty; // MANDATORY — userId or "SYSTEM"
public DateTime? UpdatedAtUtc { get; set; }           // MANDATORY
public string? UpdatedBy { get; set; }                // MANDATORY
public byte[] RowVersion { get; set; } = Array.Empty<byte>(); // MANDATORY — concurrency

// OPTIONAL but recommended where applicable:
public bool IsActive { get; set; } = true;
public string? SourceSystem { get; set; }
public string? SourceReference { get; set; }
public DateTime? EffectiveFromUtc { get; set; }
public DateTime? EffectiveToUtc { get; set; }

// FOR GDPR three-state delete support (required on entities with PII):
public DateTime? DeletedAtUtc { get; set; }
public string? DeletedBy { get; set; }
public DateTime? AnonymizedAtUtc { get; set; }
public string? AnonymizedBy { get; set; }
```

---

## Mandatory Columns — Lookup / Seed Tables

```csharp
// REQUIRED on every Tier 1 lookup/seed table (see Rule 01 Tier taxonomy):
public int Id { get; set; }
public string Code { get; set; } = string.Empty;   // short, stable, no spaces
public string Name { get; set; } = string.Empty;
public string? Description { get; set; }
public bool IsActive { get; set; } = true;
public bool IsSystem { get; set; } = false;
public int DisplayOrder { get; set; }
```

---

## Delete Model — Three States (resolves Soft Delete vs GDPR)

```
Active  →  SoftDeleted  →  Anonymized  →  Purged
```

| State | IsDeleted | AnonymizedAtUtc | Action |
|---|---|---|---|
| Active | false | null | Normal record |
| SoftDeleted | true | null | Hidden from queries, PII intact temporarily |
| Anonymized | true | [timestamp] | PII wiped, shell kept for FK integrity |
| Purged | (deleted from DB) | — | Physical delete after retention window |

❌ NEVER keep a SoftDeleted record with PII indefinitely.
✅ Purge jobs must check for legal hold before hard-deleting.

---

## Date / Time Rules

```csharp
✅ CORRECT:
public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

❌ WRONG:
public DateTime CreatedAt { get; set; }          // missing Utc suffix
public DateTime CreatedAt { get; set; } = DateTime.Now;  // local time!
```

- Use `datetime2(3)` in SQL for most timestamps
- Use `datetimeoffset` ONLY when the original UTC offset is business-significant (e.g. contract signed in a specific timezone)
- Never store local time without a corresponding UTC value

---

## Data Type Rules

| Use case | Type |
|---|---|
| Human-readable text | `nvarchar(n)` with explicit length |
| Long free-text | `nvarchar(2000)` — use `nvarchar(max)` only with justification comment |
| Money / quantity | `decimal(18,4)` for money, `decimal(18,6)` for rates |
| Boolean | `bit` |
| Primary key (internal) | `int` or `bigint` |
| Primary key (external/distributed) | `uniqueidentifier` with justification |

---

## Index Rules

```sql
-- Every FK used in joins or filters MUST be indexed:
CREATE INDEX IX_Order_TenantId_CustomerId ON ops.Order (TenantId, CustomerId);

-- Standard composite indexes for frequently queried tenant tables:
CREATE INDEX IX_Order_TenantId_IsDeleted_Status ON ops.Order (TenantId, IsDeleted, Status);
CREATE INDEX IX_Entity_TenantId_Code ON [schema].Entity (TenantId, Code);
CREATE INDEX IX_Entity_TenantId_CreatedAtUtc ON [schema].Entity (TenantId, CreatedAtUtc);

-- Filtered indexes for active records:
CREATE INDEX IX_Order_TenantId_Active ON ops.Order (TenantId) WHERE IsDeleted = 0;
```

---

## EF Core Usage Rules

### Use EF Core LINQ for:
- Standard CRUD operations
- Read-only listings with pagination
- Simple filtered queries
- Routine entity relationships with explicit Includes

### Use raw SQL / stored procedures via EF for:
- Bulk insert / update / merge operations
- Complex reporting extracts
- Heavy set-based corrections
- Queue-like or batch processing
- Any query where EF generates inefficient SQL (verify with Interceptor logs)

### EF LINQ Anti-Patterns (see `99-anti-patterns.md`):
```csharp
❌ NEVER: query.Where(c => c.Name.ToLower() == input.ToLower())  // kills index
❌ NEVER: _context.Orders.ToListAsync()                           // unbounded
✅ DO: query.Where(c => c.Name == input)                          // SQL Server handles case
✅ DO: query.Skip(skip).Take(Math.Min(pageSize, 500)).ToListAsync()
```

---

## Stored Procedure Rules

- Must be schema-owned and version-controlled in `/database/programmable/`
- Call through EF using `FromSqlRaw` or `ExecuteSqlRawAsync` with reviewed wrappers
- Results map to keyless entity types or DTO classes
- No ad-hoc SQL in Controllers or Services

---

## Migration Rules

- Default schema changes: EF Core migrations only
- Complex programmable objects: reviewed SQL scripts in `/database/programmable/`
- Every migration must be:
  - Reversible (Down() method implemented)
  - Reviewed for lock/contention impact on large tables
  - Tested on a copy of production data size before PROD release
- Never manually drift a PROD schema outside an approved emergency process

---

## Required Governance Objects

```sql
core.DbVersion          -- current DB schema version
audit.ReleaseHistory    -- which release deployed which migration
cfg.ConfigChange        -- history of config value changes
job.ExecutionLog        -- background job execution records
intg.InboundMessageLog  -- inbound integration message log
intg.OutboundMessageLog -- outbound integration message log
```

---
trigger: new_module, new_mutation_endpoint
---

# 09 - Audit, Logging, Monitoring, Backup, and DR Rules

> AI ASSISTANT: Load this file when creating a new module or any endpoint that mutates data.
> Run Section 4 (Audit) and Section 5 (Observability) of `15-ai-self-check.md` before marking complete.

---

## Three Distinct Concerns (Keep Separate)

| Concern | Purpose | Audience |
|---|---|---|
| **Audit log** | Compliance and traceability — who changed what and when | Compliance, legal, management |
| **Activity history** | User-friendly timeline on business records | Business users |
| **Application/security log** | Operational and security event stream | Ops, support, security |

---

## Mandatory Audit Event Structure

**Every audit event MUST include ALL fields below:**

```csharp
public class AuditEvent
{
    public long Id { get; set; }
    public Guid TenantId { get; set; }              // MANDATORY
    public string EventType { get; set; }           // MANDATORY — format: "ENTITY.ACTION"
    public string EntityType { get; set; }          // MANDATORY — e.g. "Order", "User"
    public string? EntityId { get; set; }           // MANDATORY for record-level events
    public string Action { get; set; }              // MANDATORY — CREATE|UPDATE|DELETE|LOGIN|etc.
    public string? BeforeValue { get; set; }        // JSON snapshot — required for UPDATE events
    public string? AfterValue { get; set; }         // JSON snapshot — required for CREATE/UPDATE
    public string PerformedBy { get; set; }         // MANDATORY — userId or "SYSTEM"
    public DateTime PerformedAtUtc { get; set; }    // MANDATORY — always UTC
    public string Channel { get; set; }             // MANDATORY — WEB|API|JOB|IMPORT|MOBILE
    public string CorrelationId { get; set; }       // MANDATORY
    public string Outcome { get; set; }             // MANDATORY — SUCCESS|FAILURE
    public string? SourceIp { get; set; }           // recommended for auth events
    public string? Reason { get; set; }             // for rejections, approvals, deletions

    // TIMEZONE CONTEXT — required for time-sensitive operational events:
    // (scheduling, boarding, dispatch, approval deadlines, SLA tracking)
    public string? DisplayedLocalTime { get; set; }  // what the user SAW on screen (local formatted)
    public string? DisplayTimezoneId { get; set; }   // IANA ID used for display (e.g. "Africa/Johannesburg")
    public string? DisplayMode { get; set; }         // "station" | "user" | "utc"
}
```

---

## Minimum Audit Coverage by Category

### Authentication Events
| EventType | When |
|---|---|
| `USER.LOGIN_SUCCESS` | After successful login |
| `USER.LOGIN_FAILURE` | After failed login attempt |
| `USER.LOGOUT` | On explicit logout |
| `USER.LOCKOUT` | When account is locked |
| `USER.PASSWORD_RESET_REQUESTED` | Reset flow initiated |
| `USER.PASSWORD_RESET_COMPLETED` | Password changed via reset |
| `MFA.BYPASS_USED` | Emergency MFA bypass |

### Data Mutations (apply to EVERY entity that stores business data)
| EventType Pattern | When |
|---|---|
| `{ENTITY}.CREATED` | Record created |
| `{ENTITY}.UPDATED` | Record updated (include BeforeValue and AfterValue) |
| `{ENTITY}.DELETED` | Record soft-deleted |
| `{ENTITY}.ARCHIVED` | Record archived/deactivated |
| `{ENTITY}.RESTORED` | Record restored from soft-delete |
| `{ENTITY}.ANONYMIZED` | PII wiped (GDPR erasure) |

### Access Events (for sensitive data)
| EventType | When |
|---|---|
| `{ENTITY}.EXPORTED` | Data exported to file |
| `{ENTITY}.BULK_IMPORTED` | Bulk import completed |
| `FILE.DOWNLOADED` | Sensitive file accessed |
| `REPORT.GENERATED` | Report containing sensitive data generated |

### Config/Admin Events
| EventType | When |
|---|---|
| `CONFIG.CHANGED` | Config value modified |
| `RBAC.ROLE_GRANTED` | Role assigned to user |
| `RBAC.ROLE_REVOKED` | Role removed from user |
| `RBAC.PERMISSION_CHANGED` | Permission set modified |
| `TENANT.CONFIG_CHANGED` | Tenant settings changed |
| `JOB.MANUALLY_TRIGGERED` | Background job triggered manually |

### Notification & Alert Events (load `18-notification-alert-rules.md` for full context)

Every stage of the notification lifecycle MUST produce an audit event via `IAuditWriter`.
Use the standard AuditEvent structure. Include `SiteId`, `StationCode`, and `ReferenceId` in the Reason/AfterValue field where applicable.

| EventType | When |
|---|---|
| `NOTIFICATION.CREATED` | Notification record generated from a business event |
| `NOTIFICATION.RULE_EVALUATED` | Notification rule engine evaluated the event |
| `NOTIFICATION.RECIPIENT_RESOLVED` | Recipients resolved for a notification |
| `NOTIFICATION.TEMPLATE_RENDERED` | Template rendered for a channel/language |
| `NOTIFICATION.QUEUED` | Notification placed into delivery queue |
| `NOTIFICATION.DELIVERED` | Successfully delivered via a channel |
| `NOTIFICATION.FAILED` | Delivery attempt failed for a channel |
| `NOTIFICATION.DEAD_LETTERED` | Moved to DLQ after max retries exceeded |
| `NOTIFICATION.READ` | User opened/read the notification |
| `NOTIFICATION.ACKNOWLEDGED` | User acknowledged an ACTION_REQUIRED notification |
| `NOTIFICATION.ESCALATED` | Escalation triggered (unacknowledged past SLA) |
| `NOTIFICATION.SUPPRESSED` | Notification suppressed (duplicate / user preference / access rule) |
| `NOTIFICATION.EXPIRED` | Notification passed its expiryAtUtc without action |
| `NOTIFICATION.ARCHIVED` | Notification moved to archive table by retention job |
| `NOTIFICATION.DELETED` | Notification hard-deleted after purge retention window |

---

## Audit Writer Call Pattern

```csharp
// CORRECT — write audit event in every mutation service method:
await _auditWriter.WriteAsync(new AuditEvent
{
    TenantId = tenantId,
    EventType = "ORDER.CREATED",
    EntityType = nameof(Order),
    EntityId = order.Id.ToString(),
    Action = "CREATE",
    AfterValue = JsonSerializer.Serialize(new { order.Id, order.Code, order.Status }),
    PerformedBy = userId,
    PerformedAtUtc = DateTime.UtcNow,
    Channel = "WEB",
    CorrelationId = _correlationProvider.CorrelationId,
    Outcome = "SUCCESS",
    SourceIp = _httpContext.Connection.RemoteIpAddress?.ToString()
});

// For UPDATE events, always capture before and after:
var before = JsonSerializer.Serialize(existingOrder);
// ... apply changes ...
var after = JsonSerializer.Serialize(updatedOrder);
await _auditWriter.WriteAsync(new AuditEvent { ..., BeforeValue = before, AfterValue = after, Action = "UPDATE" });
```

---

## Timezone Context in Audit (for Time-Sensitive Operations)

For any event involving scheduling, operational timing, SLA deadlines, or boarding/dispatch,
add these 3 fields to the audit record:

```csharp
// CORRECT — capture what the user SAW and which timezone governed it:
await _auditWriter.WriteAsync(new AuditEvent
{
    // ... standard fields ...
    PerformedAtUtc     = DateTime.UtcNow,
    DisplayedLocalTime = "2026-04-17 12:30",            // formatted local time user saw
    DisplayTimezoneId  = "Africa/Johannesburg",          // IANA ID used for display
    DisplayMode        = "station",                      // "station" | "user" | "utc"
});
```

This ensures audit records contain full timezone context — critical for investigations
in multi-timezone operational systems.



✅ DO:
```csharp
// Use structured logging with correlation ID and relevant context:
_logger.LogWarning("Login failed for user {UserId}. Attempt {Count} of {Max}. CorrelationId: {CorrelationId}",
    userId, attemptCount, maxAttempts, correlationId);

_logger.LogError(ex, "Order creation failed for tenant {TenantId}. CorrelationId: {CorrelationId}",
    tenantId, correlationId);
```

❌ NEVER:
```csharp
// No secrets, no PII in logs:
_logger.LogInformation("User {Email} logged in with {Password}", email, password);  // VIOLATION
_logger.LogDebug("Generated token: {Token}", fullToken);                             // VIOLATION
Console.WriteLine("Error: " + ex.ToString());                                        // VIOLATION — not structured
```

---

## Monitoring Requirements

Monitor these at minimum per environment:
- Application health endpoint (`/api/health`)
- DB availability (EF health check)
- Background job queue depth and age
- Error rate (5xx responses per minute)
- Authentication failure rate (alert on spike)
- Storage access failures (if file module exists)

---

## Audit Log Tamper Protection

Audit records must be protected from modification:
- [ ] App DB principal has INSERT-only privilege on `audit.*` tables (no UPDATE, no DELETE)
- [ ] Audit records are never updated or deleted by application code
- [ ] Consider using Azure SQL Ledger tables for highest-assurance environments
- [ ] Forward audit events to external SIEM as the authoritative tamper-evident record

---

## Backup and DR Notes

- Automated daily backups: mandatory
- Restore testing: required before go-live and quarterly thereafter
- RPO and RTO: must be defined before production go-live
- File/object storage backup: must be addressed if File module is active

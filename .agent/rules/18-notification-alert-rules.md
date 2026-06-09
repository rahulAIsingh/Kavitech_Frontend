---
trigger: notification_or_alert_functionality
priority: 18
---

# 18 — Notification & Alert Rules

> AI ASSISTANT: Load this file when the trigger is "Building notification or alert functionality".
> Also load all 10 files under `notifications-alerts/` subfolder.
> Run Section 10 of `15-ai-self-check.md` before marking any notification feature complete.

---

## 1. Mandatory Architecture Principle

Business modules must ONLY publish domain events.
They must NEVER directly send emails, SMS, push notifications, webhooks, or in-app notifications.

```
Business Module
     │ publishes domain event
     ▼
Event Bus / Message Broker
     │
     ▼
Notification Event Consumer
     │
     ▼
Notification Rule Engine  (DB-driven rules)
     │
     ▼
Recipient Resolver  (DB-driven, no hardcoded recipients)
     │
     ▼
Template Resolver  (DB-driven, per channel per language)
     │
     ▼
Deduplication Engine  (suppress duplicate events)
     │
     ▼
Notification Record  (saved to notification.Notification table)
     │
     ▼
Delivery Queue  (one queue per channel)
     │
     ├─ InAppWorker       → notification.NotificationRecipient
     ├─ EmailWorker       → external SMTP/SendGrid/ACS
     ├─ SmsWorker         → external Twilio/ACS
     ├─ PushWorker        → FCM/APNS
     └─ WebhookWorker     → external webhook endpoint
     │
     ▼
Retry Engine  →  Dead Letter Queue (on max retries exceeded)
     │
     ▼
Escalation Engine  (for CRITICAL and ACTION_REQUIRED)
     │
     ▼
Audit Log  (every stage written via IAuditWriter)
```

For detailed architecture and technology stack, see `notifications-alerts/01-notification-alert-architecture.md`.

---

## 2. Standard Business Event Payload

Every business event that can trigger a notification MUST include ALL required fields.

```csharp
public class BusinessNotificationEvent
{
    // MANDATORY fields:
    public Guid   EventId           { get; set; } = Guid.NewGuid();
    public string EventCode         { get; set; } = string.Empty;  // format: MODULE_ENTITY_ACTION
    public string EventCategory     { get; set; } = string.Empty;  // OPERATIONAL|SECURITY|SLA|SYSTEM|APPROVAL|REMINDER|etc.
    public Guid   TenantId          { get; set; }                   // from _tenantContext — NOT from request body
    public string ReferenceEntity   { get; set; } = string.Empty;  // e.g. "Order", "Bag", "Roster"
    public string ReferenceId       { get; set; } = string.Empty;  // entity record ID
    public string SourceSystem      { get; set; } = string.Empty;  // e.g. "BRS", "RMS", "Auth"
    public DateTime EventTimestampUtc { get; set; } = DateTime.UtcNow;
    public string CorrelationId     { get; set; } = string.Empty;  // from _correlationProvider
    public string DedupKey          { get; set; } = string.Empty;  // format: MODULE:EVENT_CODE:ENTITY_ID[:EXTRA]

    // CONDITIONAL — include when applicable:
    public Guid?  SiteId            { get; set; }
    public string StationCode       { get; set; } = string.Empty;

    // OPTIONAL — non-sensitive context data only:
    public object? Payload          { get; set; }
}
```

**Event code naming convention:** `MODULE_ENTITY_ACTION`
Examples: `AUTH_USER_LOCKED`, `RMS_ROSTER_PUBLISHED`, `TDBS_DOCK_SLA_BREACHED`

**DedupKey format:** `MODULE:EVENT_CODE:ENTITY_ID[:OPTIONAL_QUALIFIER]`
Examples: `BRS:BAG_WRONG_FLIGHT:BAG123:FLIGHT_AI101`, `RMS:ROSTER_PUBLISHED:ROSTER_001`

For full payload specification, see `notifications-alerts/03-event-payload-and-lifecycle-rules.md`.

---

## 3. Severity and Priority — Mandatory Fields

Every generated notification MUST have both Severity and Priority set from DB rules.

| Severity | Meaning | Default Channel Behaviour |
|---|---|---|
| `INFO` | Passive information | IN_APP only |
| `WARNING` | Needs attention | IN_APP + Email |
| `CRITICAL` | Immediate attention required | IN_APP + Email + Push (+ optional SMS) |
| `ACTION_REQUIRED` | User must act or acknowledge | IN_APP + Email + Push (+ optional SMS) |

| Priority | Queue Behaviour |
|---|---|
| `LOW` | Normal queue |
| `MEDIUM` | Normal queue |
| `HIGH` | Priority queue |
| `URGENT` | Priority queue + immediate dispatch |

Severity and priority are independent dimensions.
Example: `Severity = ACTION_REQUIRED` + `Priority = HIGH` = user must act, not a system emergency.

For full severity/priority channel matrix, see `notifications-alerts/04-channel-delivery-retry-dlq-rules.md`.

---

## 4. Notification Lifecycle States

The following states must be tracked on `notification.Notification.Status` and `notification.NotificationRecipient.Status`:

```
Success path:
CREATED → RULE_EVALUATED → RECIPIENT_RESOLVED → TEMPLATE_RENDERED → QUEUED → SENT → DELIVERED → READ → ACKNOWLEDGED

Failure path:
CREATED → QUEUED → FAILED → RETRYING → FAILED_PERMANENT → DEAD_LETTER

Suppression paths:
CREATED → SUPPRESSED_DUPLICATE
CREATED → SUPPRESSED_BY_USER_PREFERENCE
CREATED → SUPPRESSED_BY_ACCESS_RULE

Expiry:
CREATED → QUEUED → EXPIRED

Archive:
[any completed state] → ARCHIVED
```

For full lifecycle specification, see `notifications-alerts/03-event-payload-and-lifecycle-rules.md`.

---

## 5. Database Tables — `notification` Schema, PascalCase Columns

All notification tables use:
- **Schema:** `notification`
- **Column naming:** PascalCase (Rule 05 standard)
- **Mandatory columns on business record tables:** `TenantId`, `IsDeleted`, `CreatedAtUtc`, `CreatedBy`, `UpdatedAtUtc`, `UpdatedBy`, `RowVersion`

### Required Tables

| Table | Purpose |
|---|---|
| `notification.EventType` | All event definitions and defaults |
| `notification.Rule` | DB-driven notification rules per tenant/site/station |
| `notification.Template` | Channel-wise, language-wise message templates |
| `notification.RecipientRule` | Who receives which notification (resolved dynamically) |
| `notification.UserPreference` | Per-user channel opt-out and quiet-hours |
| `notification.ChannelConfig` | Provider configuration per channel per tenant |
| `notification.Notification` | All generated notification records |
| `notification.NotificationRecipient` | Per-recipient delivery status per channel |
| `notification.DeliveryAttempt` | Every delivery attempt log |
| `notification.Acknowledgement` | Acknowledgement records for ACTION_REQUIRED |
| `notification.EscalationRule` | Escalation hierarchy configuration |
| `notification.EscalationLog` | Escalation history |
| `notification.DeadLetter` | Permanently failed deliveries awaiting resolution |
| `notification.Archive` | Archived notification records |

For full column-level schema with PascalCase names, see `notifications-alerts/06-database-model-notification-alerts.md` (adapted version with PascalCase).

---

## 6. Deduplication Rules

Duplicate notifications MUST be suppressed before creating a new record.

Deduplication must check:
- `DedupKey` matches an existing notification
- Same `RecipientId`
- Same `ChannelCode`
- Within the configured deduplication window (from `cfg.ConfigValue`)

Default dedup windows (read from config — never hardcode):

| Severity | Config Key | Default |
|---|---|---|
| `INFO` | `notification.dedup_window_info_minutes` | 5 min |
| `WARNING` | `notification.dedup_window_warning_minutes` | 10 min |
| `CRITICAL` | `notification.dedup_window_critical_minutes` | 1–3 min |
| `ACTION_REQUIRED` | `notification.dedup_window_action_required` | Until acknowledged or expired |

For full dedup specification, see `notifications-alerts/03-event-payload-and-lifecycle-rules.md`.

---

## 7. Delivery and Retry Rules

- All external delivery MUST be queue-based (IN_APP is also queued via `notification.inapp.queue`)
- Each channel has an independent worker — failure in one channel MUST NOT block other channels
- Retry strategy: exponential backoff — read from config, NOT hardcoded
  - Default: retry at 1 min, 5 min, 15 min (config key: `notification.default_retry_backoff_policy`)
  - Default max retries: 3 (config key: `notification.default_retry_count`)
- After max retries → move to `notification.DeadLetter` table, write `NOTIFICATION.DEAD_LETTERED` audit event
- DLQ records allow admin retry, resolve, or mark-as-ignored actions

For full channel/retry/DLQ specification, see `notifications-alerts/04-channel-delivery-retry-dlq-rules.md`.

---

## 8. Recipient Resolution Rules

Recipients MUST be resolved dynamically from `notification.RecipientRule` table.
No hardcoded email IDs, phone numbers, or user IDs are allowed anywhere.

Supported recipient types: `USER`, `ROLE`, `GROUP`, `DEPARTMENT`, `TENANT_ADMIN`, `STATION_USERS`, `DYNAMIC_OWNER`, `ESCALATION_LEVEL`

Recipient resolution must respect: Tenant → Site → Station → Module → Feature → Role → User access scope

Configuration priority (highest to lowest):
```
User-specific config → Role config → Station config → Site config → Tenant config → Global default
```

For full recipient + preference + escalation specification, see `notifications-alerts/05-recipient-preference-escalation-rules.md`.

---

## 9. User Preference Rules

- Users may disable non-critical channels/events via `notification.UserPreference`
- `CRITICAL` and `ACTION_REQUIRED` alerts CANNOT be suppressed by user preference
  - EXCEPTION: only if `notification.critical_override_preferences.enabled` = true in tenant config
- Quiet hours are configurable per user (config keys: `notification.quiet_hours.enabled`)
- Preferences are checked by the notification consumer BEFORE queuing delivery

---

## 10. Acknowledgement Rules

- Acknowledgement is required when: `Severity = ACTION_REQUIRED` OR `Rule.RequiresAcknowledgement = true`
- Only authorized users (within tenant/site/station/role scope) can acknowledge
- Expired notifications cannot be acknowledged (unless `notification.late_ack_enabled` allows it)
- Every acknowledgement writes `NOTIFICATION.ACKNOWLEDGED` audit event

Data captured on acknowledgement:
```csharp
public Guid     AcknowledgementId   { get; set; }
public Guid     NotificationId      { get; set; }
public Guid     AcknowledgedBy      { get; set; }
public DateTime AcknowledgedAtUtc   { get; set; }
public string   AcknowledgementSource { get; set; } // WEB | MOBILE | API | SYSTEM_AUTO_ACK
public string?  Remarks             { get; set; }
```

---

## 11. Escalation Rules

Escalation applies to `CRITICAL` and `ACTION_REQUIRED` alerts not acknowledged within SLA.

```
IF notification requires acknowledgement
AND notification is not acknowledged within SLA window (from notification.EscalationRule.SlaMinutes)
THEN escalate to next configured level
```

Supported escalation actions: `REMINDER`, `ESCALATE_TO_NEXT`, `CREATE_INCIDENT`, `INCREASE_PRIORITY`, `TRIGGER_WEBHOOK`

Every escalation action writes `NOTIFICATION.ESCALATED` audit event.

For full escalation specification with examples, see `notifications-alerts/05-recipient-preference-escalation-rules.md`.

---

## 12. API Requirements

All notification APIs must follow Rule 06 standards: `[Authorize]`, versioned routes, `ApiResponse<T>`, `ApiError`, pagination.

### User-Facing APIs (minimum required)
```
GET    /api/v1/notifications                     — paginated list, filterable
GET    /api/v1/notifications/unread-count        — unread counts by severity
GET    /api/v1/notifications/{id}                — detail
POST   /api/v1/notifications/{id}/read           — mark as read
POST   /api/v1/notifications/{id}/acknowledge    — acknowledge (ACTION_REQUIRED only)
POST   /api/v1/notifications/mark-all-read       — mark all read
GET    /api/v1/notifications/preferences         — get user preferences
PUT    /api/v1/notifications/preferences         — update user preferences
```

### Admin Configuration APIs (minimum required)
```
CRUD   /api/v1/admin/notification-event-types
CRUD   /api/v1/admin/notification-rules
CRUD   /api/v1/admin/notification-templates
CRUD   /api/v1/admin/notification-escalation-rules
GET    /api/v1/admin/notification-delivery-status
GET    /api/v1/admin/notification-dead-letter
POST   /api/v1/admin/notification-dead-letter/{id}/retry
```

For full API specification and list filters, see `notifications-alerts/07-api-ui-signalr-rules.md`.

---

## 13. SignalR Rules

- `NotificationHub` must be implemented for real-time in-app delivery
- All SignalR connections MUST be authenticated
- Group membership must be scoped to: `tenant:{tenantId}`, `site:{siteId}`, `station:{stationCode}`, `role:{roleCode}`, `user:{userId}`
- DB is the source of truth — SignalR is the real-time push layer ONLY
- Disconnected users see all pending notifications from DB on next login

---

## 14. Security Rules

- Notification content MUST NOT expose: passwords, tokens, OTPs, full passport/national IDs, full card details, medical data
- Masking MUST be applied before template rendering:
  - Mobile: `******4321`
  - Email: `a***@domain.com`
  - Document: `********1234`
- Notification links MUST NOT contain security tokens in URLs (correct: `/app/orders/12345`, WRONG: `/app/orders/12345?token=abc`)
- RBAC visibility: users can only see notifications within their tenant/site/station/module/feature scope
- Cross-tenant notification access is a hard blockers

For full security, masking, and retention specification, see `notifications-alerts/08-security-audit-retention-rules.md`.

---

## 15. Required Notification Config Keys

All of these MUST be stored in `cfg.ConfigValue` per tenant. NEVER hardcode any of these values.

```
notification.enabled
notification.in_app.enabled
notification.email.enabled
notification.sms.enabled
notification.push.enabled
notification.webhook.enabled
notification.signalr.enabled
notification.dedup.enabled
notification.escalation.enabled
notification.user_preferences.enabled
notification.quiet_hours.enabled
notification.dlq_reprocess.enabled
notification.archive.enabled
notification.audit.enabled
notification.critical_override_preferences.enabled
notification.default_dedup_window_minutes
notification.default_expiry_minutes
notification.default_retry_count
notification.default_retry_backoff_policy
notification.late_ack_enabled
```

---

## 16. Notification Audit Events

Every stage of the notification lifecycle MUST write an audit event via `IAuditWriter`.
See Rule 09 (`09-audit-logging-monitoring-dr.md`) — Notification & Alert Events section for the full event catalog.

All audit events must include the mandatory AuditEvent fields from Rule 09, plus:
- `ReferenceEntity` and `ReferenceId` in `AfterValue` JSON
- `SiteId` and `StationCode` in `Reason` field where applicable

---

## 17. Retention and Archiving

Retention periods MUST be configurable per tenant and notification category. Default values (from cfg):

| Notification Type | Active Retention (default) | Archive Required |
|---|---|---|
| `INFO` | 30–90 days | Optional |
| `WARNING` | 90–180 days | Yes |
| `CRITICAL` | 180–365 days | Yes |
| `ACTION_REQUIRED` | 365 days | Yes |
| Delivery attempts | 90–180 days | Yes |
| DLQ records | Until resolved + retention period | Yes |
| Audit logs | Per compliance policy | Yes |

Archive rule: Archived notifications MUST remain searchable by authorized admin users and MUST preserve `CorrelationId` and `ReferenceId`.

---

## 18. Notification Module Contract

```
== MODULE CONTRACT ==

Module Name:          Notification & Alert
Module Type:          Generic Infrastructure (Tier B)
Schema:               notification

PURPOSE:
Provides a fully event-driven, multi-channel, tenant-aware, auditable notification
and alert framework. Business modules publish events only; this module handles
all delivery, escalation, deduplication, preference management, and archiving.

ENTITIES:
- notification.EventType
- notification.Rule
- notification.Template
- notification.RecipientRule
- notification.UserPreference
- notification.ChannelConfig
- notification.Notification
- notification.NotificationRecipient
- notification.DeliveryAttempt
- notification.Acknowledgement
- notification.EscalationRule
- notification.EscalationLog
- notification.DeadLetter
- notification.Archive

PERMISSION KEYS:
- notification.notification.view
- notification.notification.acknowledge
- notification.preference.view
- notification.preference.edit
- notification.rule.view              (admin)
- notification.rule.manage            (admin)
- notification.template.manage        (admin)
- notification.deadletter.view        (admin)
- notification.deadletter.retry       (admin)
- notification.escalation.manage      (admin)

CONFIG KEYS: (all tenant-scoped in cfg.ConfigValue)
- notification.enabled
- notification.in_app.enabled
- notification.email.enabled
- notification.sms.enabled
- notification.push.enabled
- notification.webhook.enabled
- notification.signalr.enabled
- notification.dedup.enabled
- notification.escalation.enabled
- notification.user_preferences.enabled
- notification.quiet_hours.enabled
- notification.dlq_reprocess.enabled
- notification.archive.enabled
- notification.audit.enabled
- notification.critical_override_preferences.enabled
- notification.default_dedup_window_minutes
- notification.default_expiry_minutes
- notification.default_retry_count
- notification.default_retry_backoff_policy
- notification.late_ack_enabled

AUDIT EVENTS:
- NOTIFICATION.CREATED, RULE_EVALUATED, RECIPIENT_RESOLVED, TEMPLATE_RENDERED
- NOTIFICATION.QUEUED, DELIVERED, FAILED, DEAD_LETTERED
- NOTIFICATION.READ, ACKNOWLEDGED, ESCALATED
- NOTIFICATION.SUPPRESSED, EXPIRED, ARCHIVED, DELETED

BACKGROUND JOBS:
- EscalationJob: checks unacknowledged ACTION_REQUIRED/CRITICAL past SLA → escalate
- RetentionArchiveJob: moves expired notifications to notification.Archive table
- DlqReprocessJob: retries eligible DLQ records (when admin triggers or on schedule)

FEATURE FLAG:
- NOTIFICATION_ENABLED = OFF (enable only after all tables, configs, and permissions verified)

== END CONTRACT ==
```

---

## 19. Minimum MVP Scope

For MVP, implement at minimum:

```
✅ Event-driven notification generation from domain events
✅ In-app notification storage and retrieval
✅ Notification bell with unread count API
✅ Email delivery for WARNING and above
✅ Tenant and station filtering on all queries
✅ Role-based recipient resolution from DB
✅ Basic template engine (per channel, per language)
✅ Basic retry mechanism (3 attempts, exponential backoff)
✅ Read/unread tracking
✅ Acknowledgement for ACTION_REQUIRED alerts
✅ All 15 lifecycle audit events written
✅ DB-driven event type and rule configuration
```

Phase 2 additions: SMS, push, advanced user preferences, quiet hours, webhook delivery, escalation hierarchy, DLQ admin screen, template editor UI, multi-language templates, archiving, alert analytics.

For full testing and code-review checklist, see `notifications-alerts/09-testing-code-review-checklist.md`.

# Database Model for Notifications & Alerts
# (PascalCase edition — adapted to comply with Rule 05 naming standard)

> AI ASSISTANT: All column names in this file follow PascalCase (Rule 05 standard).
> All tables use the `notification` schema.
> Apply mandatory business-record columns (TenantId, IsDeleted, CreatedAtUtc, CreatedBy, UpdatedAtUtc, UpdatedBy, RowVersion) to every entity that qualifies.

---

## 1. Database Design Principle

All notification and alert functionality must be database-driven.

Rules, templates, channel configuration, recipients, preferences, escalation, audit, and retry status must not be hardcoded.

---

## 2. Required Tables

```text
notification.EventType
notification.Rule
notification.Template
notification.RecipientRule
notification.UserPreference
notification.ChannelConfig
notification.Notification
notification.NotificationRecipient
notification.DeliveryAttempt
notification.Acknowledgement
notification.EscalationRule
notification.EscalationLog
notification.DeadLetter
notification.Archive
```

---

## 3. Table: notification.EventType

Stores all event definitions.

| Column | Type | Description |
|---|---|---|
| `Id` | uniqueidentifier | Primary key |
| `EventCode` | nvarchar(100) | Unique event code (MODULE_ENTITY_ACTION) |
| `EventName` | nvarchar(200) | Display name |
| `ModuleCode` | nvarchar(50) | Module code |
| `Category` | nvarchar(50) | OPERATIONAL, SECURITY, SLA, APPROVAL, SYSTEM, etc. |
| `DefaultSeverity` | nvarchar(30) | INFO, WARNING, CRITICAL, ACTION_REQUIRED |
| `DefaultPriority` | nvarchar(30) | LOW, MEDIUM, HIGH, URGENT |
| `IsActive` | bit | Active/inactive |
| `CreatedAtUtc` | datetime2 | Created date |
| `CreatedBy` | nvarchar(100) | Created by (userId or SYSTEM) |
| `UpdatedAtUtc` | datetime2 | Updated date |
| `UpdatedBy` | nvarchar(100) | Updated by |

---

## 4. Table: notification.Rule

Stores notification generation rules. One rule per event code per tenant (with optional site/station override).

| Column | Type | Description |
|---|---|---|
| `Id` | uniqueidentifier | Primary key |
| `TenantId` | uniqueidentifier | Tenant (MANDATORY) |
| `SiteId` | uniqueidentifier | Optional site scope |
| `StationCode` | nvarchar(20) | Optional station scope |
| `EventCode` | nvarchar(100) | Event code |
| `RuleName` | nvarchar(200) | Rule name |
| `Severity` | nvarchar(30) | Severity override |
| `Priority` | nvarchar(30) | Priority override |
| `RequiresAcknowledgement` | bit | Requires acknowledgement |
| `DedupWindowMinutes` | int | Duplicate suppression window |
| `ExpiryMinutes` | int | Notification expiry |
| `ConditionExpression` | nvarchar(2000) | Optional rule condition expression |
| `IsEnabled` | bit | Rule enabled |
| `IsDeleted` | bit | Soft delete |
| `CreatedAtUtc` | datetime2 | Created date |
| `CreatedBy` | nvarchar(100) | Created by |
| `UpdatedAtUtc` | datetime2 | Updated date |
| `UpdatedBy` | nvarchar(100) | Updated by |
| `RowVersion` | rowversion | Concurrency token |

---

## 5. Table: notification.Template

Stores channel-wise, language-wise templates.

| Column | Type | Description |
|---|---|---|
| `Id` | uniqueidentifier | Primary key |
| `TenantId` | uniqueidentifier | Tenant (MANDATORY) |
| `EventCode` | nvarchar(100) | Event code |
| `ChannelCode` | nvarchar(30) | IN_APP, EMAIL, SMS, PUSH, WEBHOOK |
| `LanguageCode` | nvarchar(10) | en, hi, id, etc. |
| `TitleTemplate` | nvarchar(500) | Title template (with placeholders) |
| `BodyTemplate` | nvarchar(max) | Body template — justified: user-generated rich text content |
| `IsHtml` | bit | Whether body is HTML |
| `IsActive` | bit | Active/inactive |
| `IsDeleted` | bit | Soft delete |
| `CreatedAtUtc` | datetime2 | Created date |
| `CreatedBy` | nvarchar(100) | Created by |
| `UpdatedAtUtc` | datetime2 | Updated date |
| `UpdatedBy` | nvarchar(100) | Updated by |
| `RowVersion` | rowversion | Concurrency token |

---

## 6. Table: notification.RecipientRule

Defines who receives notifications for a given rule. Resolved dynamically at runtime.

| Column | Type | Description |
|---|---|---|
| `Id` | uniqueidentifier | Primary key |
| `RuleId` | uniqueidentifier | FK → notification.Rule |
| `RecipientType` | nvarchar(30) | USER, ROLE, GROUP, DEPARTMENT, TENANT_ADMIN, STATION_USERS, DYNAMIC_OWNER, ESCALATION_LEVEL |
| `RecipientValue` | nvarchar(200) | User ID, role code, group code, etc. |
| `AccessScopeRequired` | nvarchar(100) | Tenant/site/station/module scope constraint |
| `EscalationLevel` | int | Optional escalation level |
| `IsActive` | bit | Active/inactive |

---

## 7. Table: notification.UserPreference

Stores per-user notification channel preferences and quiet hours.

| Column | Type | Description |
|---|---|---|
| `Id` | uniqueidentifier | Primary key |
| `TenantId` | uniqueidentifier | Tenant (MANDATORY) |
| `UserId` | uniqueidentifier | User |
| `EventCode` | nvarchar(100) | Event code (NULL = all events) |
| `ChannelCode` | nvarchar(30) | Channel (NULL = all channels) |
| `IsEnabled` | bit | Enabled/disabled by user |
| `QuietHoursStart` | time | Quiet hours start (optional) |
| `QuietHoursEnd` | time | Quiet hours end (optional) |
| `TimezoneId` | nvarchar(100) | IANA timezone ID for quiet hours |
| `UpdatedAtUtc` | datetime2 | Last updated |
| `UpdatedBy` | nvarchar(100) | Updated by |

---

## 8. Table: notification.ChannelConfig

Stores delivery provider configuration per channel per tenant.

| Column | Type | Description |
|---|---|---|
| `Id` | uniqueidentifier | Primary key |
| `TenantId` | uniqueidentifier | Tenant (MANDATORY) |
| `ChannelCode` | nvarchar(30) | EMAIL, SMS, PUSH, WEBHOOK |
| `ProviderCode` | nvarchar(100) | SMTP, SendGrid, Twilio, FCM, ACS, etc. |
| `ConfigJson` | nvarchar(max) | Encrypted or vault-referenced settings — justified: provider config payload |
| `IsEnabled` | bit | Channel enabled |
| `IsDefault` | bit | Default provider for channel |
| `CreatedAtUtc` | datetime2 | Created date |
| `CreatedBy` | nvarchar(100) | Created by |
| `UpdatedAtUtc` | datetime2 | Updated date |
| `UpdatedBy` | nvarchar(100) | Updated by |

> Sensitive values in `ConfigJson` MUST be encrypted or referenced via vault key name — never stored as plaintext. See Rule 08.

---

## 9. Table: notification.Notification

Stores all generated notifications. This is the central record.

| Column | Type | Description |
|---|---|---|
| `Id` | uniqueidentifier | Primary key |
| `TenantId` | uniqueidentifier | Tenant (MANDATORY) |
| `SiteId` | uniqueidentifier | Site (conditional) |
| `StationCode` | nvarchar(20) | Station (conditional) |
| `EventCode` | nvarchar(100) | Business event code |
| `EventCategory` | nvarchar(50) | Event category |
| `ReferenceEntity` | nvarchar(100) | Entity name (e.g. "Order", "Bag") |
| `ReferenceId` | nvarchar(100) | Entity record ID |
| `Severity` | nvarchar(30) | INFO, WARNING, CRITICAL, ACTION_REQUIRED |
| `Priority` | nvarchar(30) | LOW, MEDIUM, HIGH, URGENT |
| `Title` | nvarchar(500) | Rendered notification title |
| `Message` | nvarchar(2000) | Rendered notification message |
| `Status` | nvarchar(50) | Notification lifecycle status |
| `ActionRequired` | bit | Requires acknowledgement |
| `DedupKey` | nvarchar(500) | Deduplication key |
| `CorrelationId` | nvarchar(100) | End-to-end trace ID |
| `SourceSystem` | nvarchar(100) | Publishing module/system |
| `EventTimestampUtc` | datetime2 | Original business event time (UTC) |
| `CreatedAtUtc` | datetime2 | Notification record created |
| `ExpiryAtUtc` | datetime2 | Notification expiry (NULL = no expiry) |
| `MetadataJson` | nvarchar(max) | Non-sensitive context metadata — justified: variable event payload |
| `IsDeleted` | bit | Soft delete |
| `CreatedBy` | nvarchar(100) | Created by (SYSTEM) |
| `UpdatedAtUtc` | datetime2 | Last updated |
| `UpdatedBy` | nvarchar(100) | Updated by |
| `RowVersion` | rowversion | Concurrency token |

---

## 10. Table: notification.NotificationRecipient

Stores per-recipient, per-channel delivery status.

| Column | Type | Description |
|---|---|---|
| `Id` | uniqueidentifier | Primary key |
| `NotificationId` | uniqueidentifier | FK → notification.Notification |
| `RecipientUserId` | uniqueidentifier | Resolved recipient user |
| `ChannelCode` | nvarchar(30) | Delivery channel |
| `Status` | nvarchar(50) | QUEUED, SENT, DELIVERED, READ, ACKNOWLEDGED, FAILED, SUPPRESSED_*, EXPIRED |
| `ReadAtUtc` | datetime2 | Read timestamp |
| `AcknowledgedAtUtc` | datetime2 | Acknowledgement timestamp |
| `CreatedAtUtc` | datetime2 | Created date |

---

## 11. Table: notification.DeliveryAttempt

Stores every delivery attempt log for full traceability.

| Column | Type | Description |
|---|---|---|
| `Id` | uniqueidentifier | Primary key |
| `NotificationId` | uniqueidentifier | FK → notification.Notification |
| `RecipientUserId` | uniqueidentifier | Recipient user |
| `ChannelCode` | nvarchar(30) | Delivery channel |
| `AttemptNo` | int | Attempt number (1-based) |
| `ProviderName` | nvarchar(100) | Provider used (SendGrid, FCM, etc.) |
| `ProviderMessageId` | nvarchar(200) | External message ID from provider |
| `ProviderResponse` | nvarchar(2000) | Provider response (scrubbed of secrets) |
| `Status` | nvarchar(50) | SUCCESS, FAILED |
| `AttemptedAtUtc` | datetime2 | Attempt timestamp |
| `ErrorMessage` | nvarchar(2000) | Error detail (internal only — never exposed to users) |

---

## 12. Table: notification.Acknowledgement

Stores acknowledgement records for ACTION_REQUIRED notifications.

| Column | Type | Description |
|---|---|---|
| `Id` | uniqueidentifier | Primary key |
| `NotificationId` | uniqueidentifier | FK → notification.Notification |
| `AcknowledgedBy` | uniqueidentifier | User who acknowledged |
| `AcknowledgedAtUtc` | datetime2 | Acknowledgement timestamp |
| `AcknowledgementSource` | nvarchar(50) | WEB, MOBILE, API, SYSTEM_AUTO_ACK |
| `Remarks` | nvarchar(2000) | Optional acknowledgement remarks |

---

## 13. Table: notification.EscalationRule

Stores escalation hierarchy configuration per notification rule.

| Column | Type | Description |
|---|---|---|
| `Id` | uniqueidentifier | Primary key |
| `RuleId` | uniqueidentifier | FK → notification.Rule |
| `EscalationLevel` | int | Level number (1 = first escalation) |
| `SlaMinutes` | int | Minutes since creation before escalating |
| `RecipientType` | nvarchar(30) | ROLE, USER, GROUP, DYNAMIC |
| `RecipientValue` | nvarchar(200) | Recipient identifier |
| `ActionType` | nvarchar(50) | REMINDER, ESCALATE, CREATE_INCIDENT, INCREASE_PRIORITY, TRIGGER_WEBHOOK |
| `IsActive` | bit | Active/inactive |

---

## 14. Table: notification.EscalationLog

Stores escalation history.

| Column | Type | Description |
|---|---|---|
| `Id` | uniqueidentifier | Primary key |
| `NotificationId` | uniqueidentifier | FK → notification.Notification |
| `EscalationRuleId` | uniqueidentifier | FK → notification.EscalationRule |
| `EscalationLevel` | int | Level escalated to |
| `EscalatedTo` | nvarchar(200) | Recipient resolved |
| `EscalatedAtUtc` | datetime2 | Escalation timestamp |
| `Status` | nvarchar(50) | SENT, FAILED |
| `Remarks` | nvarchar(2000) | Remarks |

---

## 15. Table: notification.DeadLetter

Stores permanently failed notifications awaiting admin resolution.

| Column | Type | Description |
|---|---|---|
| `Id` | uniqueidentifier | Primary key |
| `NotificationId` | uniqueidentifier | FK → notification.Notification |
| `RecipientUserId` | uniqueidentifier | Recipient |
| `ChannelCode` | nvarchar(30) | Channel |
| `FailureReason` | nvarchar(500) | User-safe failure reason |
| `LastErrorMessage` | nvarchar(2000) | Technical error detail (internal only) |
| `AttemptCount` | int | Total attempts made |
| `FailedAtUtc` | datetime2 | Date moved to DLQ |
| `CanRetry` | bit | Admin retry allowed |
| `ResolvedAtUtc` | datetime2 | Resolution timestamp |
| `ResolvedBy` | uniqueidentifier | Admin who resolved |

---

## 16. Table: notification.Archive

Stores notifications moved from active table by retention job.

| Column | Type | Description |
|---|---|---|
| `Id` | uniqueidentifier | Primary key (same as original notification.Notification.Id) |
| `TenantId` | uniqueidentifier | Tenant |
| `EventCode` | nvarchar(100) | Event code |
| `ReferenceEntity` | nvarchar(100) | Entity |
| `ReferenceId` | nvarchar(100) | Entity ID |
| `Severity` | nvarchar(30) | Severity |
| `Status` | nvarchar(50) | Final status at time of archiving |
| `CorrelationId` | nvarchar(100) | Trace ID (MANDATORY — preserved for audits) |
| `EventTimestampUtc` | datetime2 | Original event time |
| `CreatedAtUtc` | datetime2 | Notification creation time |
| `ArchivedAtUtc` | datetime2 | Time archived |
| `MetadataJson` | nvarchar(max) | Preserved metadata — justified: variable content |

> Archived records must remain searchable by authorized admin users.
> Archived records must NOT be physically deleted unless the compliance retention window has passed.

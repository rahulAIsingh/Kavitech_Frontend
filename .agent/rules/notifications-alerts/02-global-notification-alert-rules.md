# Global Notification & Alert Rules

## 1. Core Principles

All notification and alert functionality must follow these principles:

| Principle | Rule |
|---|---|
| Event-driven | Notifications must be generated from business events |
| Asynchronous | Notification delivery must not block business transactions |
| Traceable | Every notification must have source event, reference entity, and correlation ID |
| Configurable | Rules, templates, channels, recipients, and escalation must be DB-driven |
| Multi-channel | In-app, email, SMS, push, webhook, and future channels must be supported where applicable |
| Idempotent | Duplicate notifications must be suppressed |
| Tenant-aware | Tenant, site, station, and timezone must be respected |
| Role-aware | Visibility must follow RBAC and user access scope |
| Preference-aware | User notification preferences must be respected where allowed |
| Secure | Sensitive data must not be exposed in notification content |
| Auditable | Creation, delivery, read, acknowledgement, failure, and escalation must be logged |
| Scalable | Delivery must use queues and independent channel workers |

---

## 2. Mandatory Global Constraints

```text
No hardcoded recipients.
No direct email/SMS/push/webhook sending from business modules.
No synchronous notification delivery from business transactions.
No duplicate notifications for same event-recipient-channel combination.
No notification without event context.
No notification without tenant context.
No notification without correlation ID.
No notification without dedupKey.
No sensitive data in notification content.
No cross-tenant notification visibility.
No expired notification action.
No acknowledgement bypass for ACTION_REQUIRED alerts.
No notification rule hardcoding in application code.
```

---

## 3. Business Event Rule

Business modules must only publish events.

Correct:

```text
Business Action
→ Business Event Published
→ Notification Framework Evaluates Rule
→ Notification Generated
→ Delivery Queued
→ Channel Workers Deliver
```

Incorrect:

```text
Business Action
→ Send Email Directly
```

---

## 4. Event Trigger Rule

```text
IF business_event_occurred
THEN publish_event
THEN evaluate_notification_rules
THEN generate_notification
THEN queue_delivery
```

---

## 5. Severity Rules

| Severity | Meaning | Expected Behaviour |
|---|---|---|
| INFO | Passive information | Display silently in notification list |
| WARNING | Needs attention | Highlight in UI and optionally send email |
| CRITICAL | Immediate attention required | Use multi-channel delivery |
| ACTION_REQUIRED | User must act or acknowledge | Track acknowledgement and escalation |

---

## 6. Priority Rules

| Priority | Meaning | Queue Behaviour |
|---|---|---|
| LOW | General update | Normal queue |
| MEDIUM | Important update | Normal queue |
| HIGH | Operationally important | Priority queue |
| URGENT | Business critical | Priority queue and immediate dispatch |

Severity and priority are different.

Example:

```text
Severity = ACTION_REQUIRED
Priority = HIGH
```

This means the user must act, but it may not always be a system emergency.

---

## 7. Notification Categories

Standard categories:

| Category | Purpose |
|---|---|
| OPERATIONAL | Flight, baggage, dock, roster, lounge operations |
| SECURITY | Login, password, MFA, role, permission, suspicious activity |
| APPROVAL | Approval or rejection workflows |
| SYSTEM | Background job, system process, service health |
| SLA | SLA warning or breach |
| REMINDER | Pending task reminder |
| EXCEPTION | Data mismatch, validation failure, process exception |
| AUDIT | Important auditable system action |
| INTEGRATION | External API, SFTP, DCS, AODB, BSM, FIDS, payment integration |
| BUSINESS | Normal business updates |

---

## 8. Timezone Rules

All timestamps must be stored in UTC using ISO 8601.

Display mode must be configurable:

```text
USER_TIMEZONE
STATION_TIMEZONE
TENANT_TIMEZONE
UTC
```

Recommended usage:

| Screen | Display Mode |
|---|---|
| Station dashboard | STATION_TIMEZONE |
| User notification page | USER_TIMEZONE |
| Audit logs | UTC with optional local display |
| Multi-station dashboard | Station timezone per record |

---

## 9. Feature Configuration Rules

All notification features must be configurable from database.

Suggested keys:

```text
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
```

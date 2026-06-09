# Notification & Alert Rules Package

**Purpose:** Ready-to-use global rule package for implementing notifications and alerts in Antigravity projects.

**Recommended Path:**

```text
.project-rules/notifications-alerts/
```

## Files Included

| File | Purpose |
|---|---|
| `01-notification-alert-architecture.md` | Architecture, components, event flow, recommended technology stack |
| `02-global-notification-alert-rules.md` | Core organization-wide rules and constraints |
| `03-event-payload-and-lifecycle-rules.md` | Event payload, notification payload, lifecycle, idempotency |
| `04-channel-delivery-retry-dlq-rules.md` | Channels, queue delivery, retries, DLQ handling |
| `05-recipient-preference-escalation-rules.md` | Recipient resolution, user preferences, acknowledgement, escalation |
| `06-database-model-notification-alerts.md` | Recommended database tables and schema guidance |
| `07-api-ui-signalr-rules.md` | APIs, UI components, SignalR real-time delivery rules |
| `08-security-audit-retention-rules.md` | Security, masking, RBAC visibility, audit, retention, archiving |
| `09-testing-code-review-checklist.md` | Unit, integration, security testing and code review checklist |
| `10-antigravity-implementation-prompt.md` | Compact implementation prompt for Antigravity |

## Usage Rule

When creating or modifying notification functionality, instruct Antigravity to follow this full folder:

```text
Follow all rules under .project-rules/notifications-alerts/ before generating or modifying notification and alert functionality.
```

## Mandatory Principle

Business modules must publish domain events only. They must not directly send emails, SMS, push notifications, webhooks, or in-app notifications.

# Antigravity Implementation Prompt for Notifications and Alerts

Use this prompt when asking Antigravity to implement notification and alert functionality.

```text
Implement the notification and alert framework by following all markdown rules under:

.project-rules/notifications-alerts/

Do not send emails, SMS, push notifications, webhooks, or in-app notifications directly from business services.

Create an event-driven notification flow using the following approach:

1. Business modules publish domain events.
2. Notification consumer evaluates DB-driven notification rules.
3. Recipients are resolved from role, group, station, tenant, user access scope, and dynamic ownership rules.
4. Templates are resolved from DB.
5. Notifications are stored in DB.
6. Channel delivery is queue-based.
7. In-app notification is mandatory.
8. SignalR should be used for real-time in-app delivery where applicable.
9. Email/SMS/push/webhook delivery must be handled by independent workers.
10. Retry and dead-letter handling must be implemented.
11. Acknowledgement and escalation must be supported for ACTION_REQUIRED alerts.
12. All timestamps must be stored in UTC.
13. RBAC, tenant, site, and station-level access must be enforced.
14. No sensitive data should be exposed in notification content.
15. All creation, delivery, read, acknowledgement, failure, suppression, expiry, archive, and escalation actions must be audit logged.

Generate or update the following as needed:

- Database tables and EF entities
- DTOs
- Domain events
- Event publisher interfaces
- Notification consumer
- Rule evaluation service
- Recipient resolver service
- Template rendering service
- Deduplication service
- Notification service
- Delivery workers
- Retry and DLQ handling
- Acknowledgement APIs
- User preference APIs
- Admin configuration APIs
- SignalR hub
- React/React Native notification UI components
- Unit tests
- Integration tests
- Security tests

Before coding, inspect the existing project architecture and reuse existing base patterns for:

- Tenant handling
- User context
- RBAC permissions
- Audit logging
- EF repository or DbContext pattern
- Background worker pattern
- Configuration table pattern
- API response model
- Error handling
- Logging

Do not introduce hardcoded recipients, hardcoded provider settings, hardcoded templates, or synchronous delivery from business services.
```

---

## Compact Prompt for Small Changes

```text
Follow `.project-rules/notifications-alerts/`. Implement this notification feature as event-driven, queue-based, DB-configured, tenant/station/RBAC-aware, idempotent, auditable, and secure. Do not directly send email/SMS/push from business logic. Store timestamps in UTC and mask sensitive data.
```

---

## Review Prompt

```text
Review the notification and alert implementation against all rules in `.project-rules/notifications-alerts/`. Identify violations related to direct sending, hardcoded recipients, missing tenant context, missing correlationId, missing dedupKey, missing audit, missing retry/DLQ, sensitive data exposure, missing RBAC checks, timezone issues, and missing acknowledgement/escalation support.
```

# Notification & Alert Testing and Code Review Checklist

## 1. Implementation Acceptance Criteria

A notification and alert implementation is acceptable only if it satisfies the following:

| Criteria | Required |
|---|---:|
| Event-driven | Yes |
| Queue-based | Yes |
| Multi-channel | Yes |
| In-app notification support | Yes |
| Email support | Yes |
| Retry support | Yes |
| Dead Letter Queue support | Yes |
| Deduplication | Yes |
| User preferences | Yes |
| Tenant-aware | Yes |
| Station-aware | Yes |
| RBAC visibility | Yes |
| UTC timestamp storage | Yes |
| Audit logs | Yes |
| Escalation support | Yes |
| Acknowledgement support | Yes |
| DB-driven configuration | Yes |
| No hardcoded recipients | Yes |
| No sensitive data exposure | Yes |
| SignalR support for live in-app updates | Recommended |
| Archiving support | Yes |

---

## 2. Minimum MVP Scope

For MVP, the following must be implemented:

```text
Event-driven notification generation
In-app notification storage
Notification bell and unread count
Email delivery for WARNING and above
Tenant and station filtering
Role-based recipient resolution
Basic templates
Basic retry mechanism
Read/unread tracking
Acknowledgement for ACTION_REQUIRED alerts
Audit logging
DB-driven event and rule configuration
```

---

## 3. Phase 2 Scope

Phase 2 may include:

```text
SMS delivery
Push notification
Advanced user preferences
Quiet hours
Webhook delivery
Escalation hierarchy
DLQ admin screen
Template editor UI
Multi-language templates
Alert analytics dashboard
Notification archiving
Provider failover
AI-based alert grouping or noise reduction
```

---

## 4. Implementation Checklist

Before marking a notification feature complete, confirm:

```text
[ ] Business event is published instead of direct delivery.
[ ] Event includes tenantId.
[ ] Event includes correlationId.
[ ] Event includes dedupKey.
[ ] Notification rule is configured in DB.
[ ] Template is configured in DB.
[ ] Recipient rule is configured in DB.
[ ] In-app notification is created.
[ ] Channel delivery is queue-based.
[ ] Retry mechanism is implemented.
[ ] Duplicate suppression is implemented.
[ ] User preference is checked.
[ ] RBAC visibility is enforced.
[ ] Sensitive data is masked.
[ ] Notification is audit logged.
[ ] Read status is tracked.
[ ] Acknowledgement is supported where required.
[ ] Escalation rule is supported where required.
[ ] Failure is moved to DLQ after retries.
[ ] All timestamps are stored in UTC.
[ ] Timezone display is handled correctly.
```

---

## 5. Code Review Checklist

Reviewers must verify:

```text
[ ] No hardcoded email IDs, mobile numbers, or user IDs.
[ ] No direct email/SMS/push calls from business services.
[ ] No sensitive data in event payload or templates.
[ ] Event has proper dedup key.
[ ] Notification rules are DB-driven.
[ ] Recipient resolution respects tenant, site, station, and RBAC.
[ ] Delivery is asynchronous.
[ ] Retry and failure handling are present.
[ ] Audit logs are written.
[ ] Unit tests cover notification rule evaluation.
[ ] Integration tests cover queue and delivery flow.
[ ] SignalR authorization is handled properly.
[ ] User preference rules are applied.
[ ] Critical alerts cannot be silently ignored unless tenant policy allows.
```

---

## 6. Unit Tests

Must cover:

```text
Rule evaluation
Template rendering
Recipient resolution
Preference suppression
Duplicate suppression
Severity/channel mapping
Acknowledgement validation
Escalation calculation
```

---

## 7. Integration Tests

Must cover:

```text
Event published to queue
Notification consumed from queue
Notification created in DB
Email queued successfully
Retry after provider failure
DLQ after maximum retries
SignalR delivery to authorized user
RBAC-based notification visibility
```

---

## 8. Security Tests

Must cover:

```text
Cross-tenant notification access blocked
Cross-station notification access blocked
Unauthorized acknowledgement blocked
Sensitive fields are masked
Notification links do not expose tokens
Webhook signatures validated
```

---

## 9. Standard Business Alert Examples

### Baggage Reconciliation System

| Event | Severity | Action Required |
|---|---|---:|
| Bag scanned at wrong flight | CRITICAL | Yes |
| Bag missing at loading checkpoint | ACTION_REQUIRED | Yes |
| Rush bag pending | WARNING | No |
| Flight closeout mismatch | CRITICAL | Yes |
| BSM/DCS sync failed | WARNING / CRITICAL | No |
| ULD loading mismatch | CRITICAL | Yes |
| Arrival belt confirmation pending | WARNING | No |

### Lounge Management System

| Event | Severity | Action Required |
|---|---|---:|
| Lounge nearing capacity | WARNING | No |
| Lounge capacity breached | CRITICAL | Yes |
| Invalid guest entry attempt | WARNING | No |
| Delayed flight passenger overstay | WARNING | No |
| Airline policy mismatch | ACTION_REQUIRED | Yes |
| Billing exception detected | WARNING | Yes |

### Rostering Management System

| Event | Severity | Action Required |
|---|---|---:|
| Roster published | INFO | No |
| Staff shortage detected | WARNING | No |
| Critical skill not covered | CRITICAL | Yes |
| Shift approval pending | ACTION_REQUIRED | Yes |
| Rest-hour violation detected | CRITICAL | Yes |
| Split shift validation failed | WARNING | Yes |

### Truck Dock Booking System

| Event | Severity | Action Required |
|---|---|---:|
| Dock booking confirmed | INFO | No |
| Truck delayed | WARNING | No |
| Dock SLA breached | CRITICAL | Yes |
| Payment failed | ACTION_REQUIRED | Yes |
| Gate-in mismatch | WARNING | Yes |
| Dock reassignment required | ACTION_REQUIRED | Yes |

### eReadback / Load Control

| Event | Severity | Action Required |
|---|---|---:|
| LIR uploaded | INFO | No |
| LIR parsing failed | ACTION_REQUIRED | Yes |
| Lock image approval pending | ACTION_REQUIRED | Yes |
| Wrong load sequence detected | CRITICAL | Yes |
| Manual override performed | WARNING | No |
| Load approval completed | INFO | No |

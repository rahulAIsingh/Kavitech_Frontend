# API, UI & SignalR Rules for Notifications and Alerts

## 1. User Notification APIs

Minimum APIs:

```text
GET    /api/notifications
GET    /api/notifications/unread-count
GET    /api/notifications/{id}
POST   /api/notifications/{id}/read
POST   /api/notifications/{id}/acknowledge
POST   /api/notifications/mark-all-read
GET    /api/notifications/preferences
PUT    /api/notifications/preferences
```

---

## 2. Admin Configuration APIs

```text
GET    /api/admin/notification-event-types
POST   /api/admin/notification-event-types
PUT    /api/admin/notification-event-types/{id}

GET    /api/admin/notification-rules
POST   /api/admin/notification-rules
PUT    /api/admin/notification-rules/{id}
DELETE /api/admin/notification-rules/{id}

GET    /api/admin/notification-templates
POST   /api/admin/notification-templates
PUT    /api/admin/notification-templates/{id}
DELETE /api/admin/notification-templates/{id}

GET    /api/admin/notification-channel-config
POST   /api/admin/notification-channel-config
PUT    /api/admin/notification-channel-config/{id}

GET    /api/admin/notification-delivery-status
GET    /api/admin/notification-dead-letter
POST   /api/admin/notification-dead-letter/{id}/retry

GET    /api/admin/notification-escalation-rules
POST   /api/admin/notification-escalation-rules
PUT    /api/admin/notification-escalation-rules/{id}
```

---

## 3. Notification List API Rules

`GET /api/notifications` must support filters:

```text
severity
priority
category
status
isRead
actionRequired
fromDate
toDate
referenceEntity
referenceId
stationCode
moduleCode
```

Must enforce:

```text
Tenant access
Station access
Role access
User scope
```

---

## 4. Unread Count API

`GET /api/notifications/unread-count` should return:

```json
{
  "totalUnread": 12,
  "criticalUnread": 2,
  "actionRequired": 3,
  "warningUnread": 4
}
```

---

## 5. Acknowledge API Rules

`POST /api/notifications/{id}/acknowledge`

Rules:

```text
Only allowed for action-required notifications.
User must have access to the notification.
Acknowledgement must be audit logged.
Notification status must be updated.
Escalation job must stop or update status.
```

---

## 6. UI Components

Every web/mobile application should include:

```text
Notification bell icon
Unread count badge
Critical count badge
Notification list/drawer
Notification detail view
Read/unread indicator
Acknowledge button for action-required alerts
Filter by severity/category/date
Link to reference entity
User preference screen
Admin configuration screen
```

---

## 7. Notification Bell Rules

The bell icon should show:

```text
Total unread count
Critical unread count
Action-required count
Latest 5-10 notifications
View all option
```

---

## 8. Alert Dashboard Rules

Operational applications should provide an alert dashboard with:

```text
Open alerts
Critical alerts
SLA breached alerts
Acknowledgement pending
Escalation pending
Failed deliveries
Dead letter queue count
Alerts by station
Alerts by module
Alerts by severity
```

---

## 9. Notification List Columns

Recommended fields:

```text
Severity
Priority
Title
Message
Module
Reference
Station
Created Date
Status
Action Required
Acknowledgement Status
```

---

## 10. SignalR Real-Time Rules

SignalR should be used for real-time in-app notification delivery.

Recommended groups:

```text
tenant:{tenantId}
site:{siteId}
station:{stationCode}
role:{roleCode}
user:{userId}
module:{moduleCode}
```

SignalR flow:

```text
Notification generated
→ Saved in database
→ Recipient resolved
→ SignalR message sent to user/role/station group
→ UI updates notification bell and list
```

SignalR security:

```text
SignalR connection must be authenticated.
User must only join authorized groups.
Group membership must be based on tenant, station, role, and access scope.
Disconnected users should still see notifications from database on next login.
```

# Notification & Alert Architecture

## 1. Purpose

This file defines the standard architecture for notifications and alerts across all organization projects.

The architecture must be reusable for systems such as BRS, LMS, RMS, TDBS, eReadback, Ramp Vision, WMS, Asset Management, Control Centre, and other enterprise applications.

---

## 2. Notification vs Alert

### Notification

A notification is a system-generated message that informs a user or group about a business event, status update, reminder, or operational change.

Examples:

- Roster published
- Dock booking confirmed
- Lounge guest entry completed
- LIR uploaded successfully
- Bag scanned at checkpoint
- User password reset requested

### Alert

An alert is a higher-priority notification that requires attention, acknowledgement, escalation, or operational action.

Examples:

- SLA breached
- Wrong-flight bag detected
- Critical manpower shortage
- Integration failed repeatedly
- Lock image approval pending beyond SLA
- Lounge capacity breached

### Global Rule

```text
Every alert is a notification, but not every notification is an alert.
```

---

## 3. High-Level Architecture

```text
Business Module
     |
     | Publishes Business Event
     v
Event Bus / Message Broker
     |
     v
Notification Event Consumer
     |
     v
Notification Rule Engine
     |
     v
Recipient Resolver
     |
     v
Template Resolver
     |
     v
Notification Generator
     |
     v
Notification Queue
     |
     v
Channel Delivery Workers
     |
     |-- In-App Worker
     |-- Email Worker
     |-- SMS Worker
     |-- Push Worker
     |-- Webhook Worker
     |
     v
Delivery Status / Audit / Retry / Dead Letter Queue
     |
     v
Escalation Engine
```

---

## 4. Recommended Technology Stack

| Component | Recommended Technology |
|---|---|
| API | .NET Core Web API |
| Worker services | .NET Core Worker Service |
| Database | MSSQL |
| Event bus | RabbitMQ / Azure Service Bus |
| Background jobs | Hangfire / Quartz.NET |
| Real-time in-app updates | SignalR |
| Email provider | SMTP / SendGrid / Azure Communication Services / AWS SES |
| SMS provider | Twilio / Azure Communication Services / local telecom gateway |
| Push notification | Firebase Cloud Messaging / APNS / Expo Push |
| Audit logging | MSSQL audit tables |
| Configuration | Database-driven feature/configuration tables |

---

## 5. Core Components

### 5.1 Business Event Publisher

Business modules must publish domain events when important business actions occur.

Examples:

```text
BagScanned
BagRejected
FlightClosed
RosterPublished
DockBookingCreated
DockSlaBreached
LoungeCapacityExceeded
LoadInstructionApproved
UserPasswordResetRequested
```

Business modules must not directly send email, SMS, push, webhook, or in-app notifications.

---

### 5.2 Event Bus / Message Broker

Use a broker to decouple business events from notification delivery.

Recommended options:

| Scenario | Recommended Option |
|---|---|
| Standard enterprise project | RabbitMQ |
| Azure-native deployment | Azure Service Bus |
| High-volume streaming | Kafka |
| Small internal system | SQL queue / Redis Streams, only if justified |

---

### 5.3 Notification Rule Engine

The rule engine decides:

```text
Should a notification be generated?
Who should receive it?
Which channel should be used?
What template should be used?
What severity and priority should apply?
Is acknowledgement required?
Is escalation required?
```

Rules must be database-driven.

---

### 5.4 Recipient Resolver

Recipients must be resolved dynamically using:

- User
- Role
- Group
- Department
- Tenant admin
- Station users
- Dynamic owner
- Escalation hierarchy

No hardcoded recipients are allowed.

---

### 5.5 Template Resolver

Templates must be channel-wise and configurable.

Supported template types:

```text
IN_APP_TITLE
IN_APP_BODY
EMAIL_SUBJECT
EMAIL_BODY
SMS_BODY
PUSH_TITLE
PUSH_BODY
WEBHOOK_PAYLOAD
```

---

### 5.6 Channel Delivery Workers

Each channel should have an independent worker:

```text
EmailWorker
SmsWorker
PushWorker
InAppWorker
WebhookWorker
```

Failure in one channel must not block another channel.

---

### 5.7 Escalation Engine

Escalation engine handles SLA-based follow-ups.

Example:

```text
IF notification is ACTION_REQUIRED
AND not acknowledged within 15 minutes
THEN escalate to next-level supervisor
```

---

## 6. Standard Event Flow

```text
1. Business action occurs.
2. Business module publishes event.
3. Notification consumer receives event.
4. Rule engine evaluates DB rules.
5. Recipient resolver identifies users/groups/roles.
6. Template resolver prepares content.
7. Deduplication engine checks duplicates.
8. Notification is saved in DB.
9. In-app notification is created.
10. Channel deliveries are queued.
11. Workers deliver notifications.
12. Delivery status is tracked.
13. Acknowledgement and escalation are handled where required.
14. Audit logs are created.
```

---

## 7. SignalR Real-Time Architecture

SignalR should be used for real-time in-app delivery.

Recommended groups:

```text
tenant:{tenantId}
site:{siteId}
station:{stationCode}
role:{roleCode}
user:{userId}
module:{moduleCode}
```

SignalR rules:

```text
SignalR connection must be authenticated.
User must only join authorized groups.
Disconnected users must still see saved notifications on next login.
Database is the source of truth, not SignalR.
```

# Channel Delivery, Retry & Dead Letter Queue Rules

## 1. Supported Channels

Supported channels:

```text
IN_APP
EMAIL
SMS
PUSH
WEBHOOK
TEAMS
SLACK
```

`TEAMS` and `SLACK` are optional future channels.

---

## 2. Mandatory Channel Rule

```text
IN_APP is mandatory for all systems.
```

Every notification must be stored as an in-app notification unless explicitly suppressed by access rules.

---

## 3. Default Channel Matrix

| Severity | In-App | Email | SMS | Push |
|---|---:|---:|---:|---:|
| INFO | Yes | No | No | No |
| WARNING | Yes | Yes | No | Optional |
| CRITICAL | Yes | Yes | Optional | Yes |
| ACTION_REQUIRED | Yes | Yes | Optional | Yes |

---

## 4. Channel Selection Rule

Selected channels are determined by:

```text
1. Tenant configuration
2. Event notification rule
3. Event severity
4. User preference
5. Recipient contact availability
6. Channel availability
7. Compliance/security policy
```

---

## 5. Queue-Based Delivery Rule

All external delivery must be queue-based.

```text
Business transactions must never wait for notification delivery.
```

Recommended queues:

```text
notification.inapp.queue
notification.email.queue
notification.sms.queue
notification.push.queue
notification.webhook.queue
notification.priority.queue
notification.deadletter.queue
```

---

## 6. Retry Rule

Minimum retry configuration:

| Parameter | Default |
|---|---:|
| Minimum retries | 3 |
| Retry strategy | Exponential backoff |
| Retry delays | 1 min, 5 min, 15 min |
| Max retry duration | Configurable |
| Final failure state | Dead Letter Queue |

Retry example:

```text
Attempt 1: Immediate
Attempt 2: After 1 minute
Attempt 3: After 5 minutes
Attempt 4: After 15 minutes

If still failed:
Move to Dead Letter Queue
```

---

## 7. Dead Letter Queue Rules

A delivery must move to DLQ when:

```text
Maximum retry attempts exceeded
Invalid recipient
Invalid template
Invalid channel configuration
Permanent provider failure
Payload validation failure
Unauthorized webhook endpoint
```

DLQ must capture:

```text
notificationId
recipientId
channelCode
eventCode
failureReason
lastErrorMessage
attemptCount
failedAtUtc
canRetry
correlationId
```

DLQ admin actions:

```text
View failed notifications
View failure reason
Retry selected notification
Retry all eligible notifications
Mark as resolved
Mark as ignored
Export failure report
```

---

## 8. Email Rules

Email provider must be configurable.

Supported options:

```text
SMTP
SendGrid
Azure Communication Services
AWS SES
```

Email configuration must not be hardcoded.

---

## 9. SMS Rules

SMS provider must be configurable.

Supported options:

```text
Twilio
Azure Communication Services
Local telecom gateway
```

SMS should be reserved for critical or action-required scenarios due to cost and compliance considerations.

---

## 10. Push Notification Rules

Push providers:

```text
Firebase Cloud Messaging for Android
APNS for iOS
Expo Push Service for Expo-based applications
```

Push tokens must be stored per device and per user.

---

## 11. Webhook Rules

Webhook delivery should support:

```text
Target URL
HTTP method
Headers
Secret/signature
Payload template
Retry
Timeout
Response logging
```

Webhook secrets must be encrypted.

---

## 12. Provider Failure Rule

Failure in one provider or channel must not impact another channel.

Example:

```text
If email provider is down, in-app notification must still be created and push delivery may still continue.
```

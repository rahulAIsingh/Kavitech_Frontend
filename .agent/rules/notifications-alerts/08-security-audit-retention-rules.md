# Security, Audit, Retention & Archiving Rules

## 1. Sensitive Data Rule

Notifications must not expose sensitive data.

Avoid including:

```text
Full passport number
Full government ID
Full mobile number
Full email address
Payment card details
Bank details
Security tokens
Passwords
OTP
Medical details
Confidential contract details
Access tokens
Refresh tokens
```

---

## 2. Masking Rule

Use masking where identification is necessary.

Examples:

```text
Mobile: ******4321
Email: a***@domain.com
Document: ********1234
Bag Tag: 123****789
Passenger: A*** B****
```

---

## 3. RBAC Visibility Rule

A user can only view notifications if they have access to:

```text
Tenant
Site
Station
Module
Feature
Reference entity
Action scope
```

---

## 4. Notification Link Rule

Notification links must not contain sensitive tokens.

Correct:

```text
/app/flights/12345
```

Incorrect:

```text
/app/flights/12345?token=abc123
```

---

## 5. Security Event Rule

Security-related actions must generate auditable alerts.

Examples:

```text
Role changed
Permission overridden
User locked
MFA disabled
SSO configuration changed
Password reset requested
Suspicious login detected
Repeated failed login attempts
API key regenerated
```

---

## 6. Audit Rules

Every notification must be auditable.

The system must log:

```text
Notification created
Rule evaluated
Recipient resolved
Template rendered
Notification queued
Delivery attempted
Delivery succeeded
Delivery failed
Notification read
Notification acknowledged
Notification escalated
Notification suppressed
Notification expired
Notification archived
Notification deleted
```

Audit log fields:

```text
auditId
tenantId
siteId
stationCode
notificationId
eventCode
referenceEntity
referenceId
action
oldValue
newValue
performedBy
performedAtUtc
ipAddress
deviceInfo
correlationId
remarks
```

---

## 7. Archiving and Retention Rules

Notifications should not remain in active tables forever.

Retention must be configurable per tenant and notification category.

Suggested retention:

| Data Type | Active Retention | Archive Required |
|---|---:|---:|
| INFO notifications | 30 to 90 days | Optional |
| WARNING notifications | 90 to 180 days | Yes |
| CRITICAL alerts | 180 to 365 days | Yes |
| ACTION_REQUIRED alerts | 365 days | Yes |
| Delivery attempts | 90 to 180 days | Yes |
| DLQ records | Until resolved + retention period | Yes |
| Audit logs | As per compliance | Yes |

Archive rule:

```text
Archived notifications must remain searchable by authorized admin users.
Archived records must preserve correlation ID and reference entity.
Archived records must not be physically deleted unless retention policy allows.
```

---

## 8. Data Privacy Rules

```text
Notification content must use minimum required data.
PII must be masked unless the user has explicit access and business need.
Notification audit logs must not store secrets or tokens.
Provider response logs must be reviewed to avoid storing sensitive payloads.
Notification exports must follow RBAC and tenant restrictions.
```

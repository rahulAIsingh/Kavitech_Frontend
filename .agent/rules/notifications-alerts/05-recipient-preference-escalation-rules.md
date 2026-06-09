# Recipient, Preference, Acknowledgement & Escalation Rules

## 1. Recipient Resolution Rules

Recipients must be resolved dynamically using configuration.

Supported recipient types:

```text
USER
ROLE
GROUP
DEPARTMENT
TENANT_ADMIN
STATION_USERS
DYNAMIC_OWNER
ESCALATION_LEVEL
```

No hardcoded email IDs, phone numbers, or user IDs are allowed.

---

## 2. Recipient Scope Rules

Recipient resolution must respect:

```text
Tenant
Site
Station
Module
Feature
Role
User access scope
```

Example:

```text
A DEL station user must not receive BOM station alerts unless explicitly authorized for BOM or multi-station access.
```

---

## 3. Configuration Priority

Configuration priority should follow this order:

```text
User-specific configuration
→ Role-specific configuration
→ Station-specific configuration
→ Site-specific configuration
→ Tenant-specific configuration
→ Global default configuration
```

---

## 4. User Preference Rules

Users may configure notification preferences where allowed.

Examples:

| Preference | Allowed |
|---|---:|
| Disable INFO email | Yes |
| Disable general push notifications | Yes |
| Disable WARNING email | Optional, tenant-controlled |
| Disable CRITICAL alerts | No, unless tenant policy allows |
| Disable ACTION_REQUIRED alerts | No |
| Configure quiet hours | Optional |
| Choose preferred language | Yes |

Preference evaluation rule:

```text
IF user_preference_disabled(channel OR eventCode)
AND severity NOT IN (CRITICAL, ACTION_REQUIRED)
THEN suppress notification for that channel
```

Critical override rule:

```text
CRITICAL and ACTION_REQUIRED alerts may override user preferences if tenant policy requires mandatory delivery.
```

---

## 5. Acknowledgement Rules

Acknowledgement is required when:

```text
severity = ACTION_REQUIRED
OR notificationRule.requiresAcknowledgement = true
```

Acknowledgement data:

```text
acknowledgedBy
acknowledgedAtUtc
acknowledgementRemarks
acknowledgementSource
```

Supported acknowledgement sources:

```text
WEB
MOBILE
API
SYSTEM_AUTO_ACK
```

Acknowledgement validation:

```text
Only authorized users can acknowledge a notification.
A user cannot acknowledge a notification outside their tenant, site, station, role, or access scope.
Expired notifications cannot be acknowledged unless late acknowledgement is allowed.
Acknowledgement must be audit logged.
```

---

## 6. Escalation Rules

Escalation applies to:

```text
CRITICAL alerts
ACTION_REQUIRED alerts
SLA breach alerts
Approval pending alerts
Operational exception alerts
System failure alerts
```

Escalation rule:

```text
IF notification requires acknowledgement
AND notification is not acknowledged within configured SLA
THEN escalate to next configured level
```

Example escalation hierarchy:

```text
Level 1: Supervisor
Level 2: Duty Manager
Level 3: Station Manager
Level 4: Tenant Admin
Level 5: System Admin
```

Supported escalation actions:

```text
Send reminder to same recipient
Notify next-level recipient
Increase priority
Create operational incident
Mark alert as overdue
Trigger webhook
Send summary to admin dashboard
```

---

## 7. Escalation Example

```text
Event: BAG_LOADING_MISMATCH
Severity: ACTION_REQUIRED
Initial Recipient: Baggage Supervisor
SLA: 10 minutes

If not acknowledged in 10 minutes:
Escalate to Duty Manager

If not acknowledged in 20 minutes:
Escalate to Station Manager
```

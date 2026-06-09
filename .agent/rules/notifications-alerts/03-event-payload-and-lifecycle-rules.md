# Event Payload, Notification Payload & Lifecycle Rules

## 1. Standard Business Event Payload

Every business event that can trigger a notification must include:

```json
{
  "eventId": "uuid",
  "eventCode": "BRS_BAG_WRONG_FLIGHT",
  "eventCategory": "OPERATIONAL",
  "tenantId": "tenant-001",
  "siteId": "site-001",
  "stationCode": "DEL",
  "referenceEntity": "Bag",
  "referenceId": "BAG123456",
  "sourceSystem": "BRS",
  "eventTimestampUtc": "2026-04-24T10:30:00Z",
  "correlationId": "corr-uuid",
  "dedupKey": "BRS:BAG_WRONG_FLIGHT:BAG123456:DEL",
  "payload": {
    "flightNo": "AI101",
    "bagTagNoMasked": "123****789",
    "checkpoint": "MAKEUP",
    "expectedFlight": "AI101",
    "scannedFlight": "AI202"
  }
}
```

---

## 2. Standard Notification Payload

Every generated notification must include:

```json
{
  "notificationId": "uuid",
  "tenantId": "tenant-001",
  "siteId": "site-001",
  "stationCode": "DEL",
  "eventCode": "BRS_BAG_WRONG_FLIGHT",
  "eventCategory": "OPERATIONAL",
  "referenceEntity": "Bag",
  "referenceId": "BAG123456",
  "severity": "CRITICAL",
  "priority": "URGENT",
  "title": "Wrong Flight Bag Detected",
  "message": "A bag has been scanned against an incorrect flight at DEL.",
  "eventTimestampUtc": "2026-04-24T10:30:00Z",
  "sourceSystem": "BRS",
  "correlationId": "corr-uuid",
  "dedupKey": "BRS:BAG_WRONG_FLIGHT:BAG123456:DEL",
  "actionRequired": true,
  "expiryAtUtc": "2026-04-24T12:30:00Z",
  "metadata": {
    "flightNo": "AI101",
    "checkpoint": "MAKEUP"
  }
}
```

---

## 3. Mandatory Notification Fields

| Field | Mandatory | Description |
|---|---:|---|
| notificationId | Yes | Unique notification ID |
| tenantId | Yes | Tenant isolation |
| siteId | Conditional | Site-level filtering |
| stationCode | Conditional | Station-level filtering |
| eventCode | Yes | Business event code |
| eventCategory | Yes | Event category |
| referenceEntity | Yes | Entity name |
| referenceId | Yes | Entity record ID |
| severity | Yes | INFO, WARNING, CRITICAL, ACTION_REQUIRED |
| priority | Yes | LOW, MEDIUM, HIGH, URGENT |
| title | Yes | Short display title |
| message | Yes | User-readable message |
| eventTimestampUtc | Yes | Original event time in UTC |
| sourceSystem | Yes | System/module that raised event |
| correlationId | Yes | End-to-end trace ID |
| dedupKey | Yes | Duplicate suppression key |
| actionRequired | Yes | Whether acknowledgement/action is needed |
| expiryAtUtc | Conditional | Expiry time, where applicable |
| metadata | Optional | Non-sensitive additional data |

---

## 4. Event Naming Convention

Event codes must follow this pattern:

```text
MODULE_ENTITY_ACTION
```

Examples:

```text
BRS_BAG_WRONG_FLIGHT
BRS_FLIGHT_CLOSEOUT_MISMATCH
LMS_LOUNGE_CAPACITY_EXCEEDED
RMS_ROSTER_PUBLISHED
RMS_SKILL_SHORTAGE_DETECTED
TDBS_DOCK_SLA_BREACHED
EREADBACK_LIR_PARSING_FAILED
AUTH_USER_LOCKED
AUTH_MFA_DISABLED
INTEGRATION_SFTP_FILE_MISSING
SYSTEM_BACKGROUND_JOB_FAILED
```

---

## 5. Idempotency and Deduplication Rules

Duplicate notifications must be suppressed.

Deduplication must consider:

```text
dedupKey
eventCode
referenceEntity
referenceId
recipientId
channelCode
deduplication window
```

Deduplication rule:

```text
IF same dedupKey
AND same recipient
AND same channel
AND within configured deduplication window
THEN suppress duplicate notification
```

Example dedup keys:

```text
BRS:BAG_WRONG_FLIGHT:BAG12345:FLIGHT_AI101:DEL
RMS:SKILL_SHORTAGE:SHIFT_1001:DEL
LMS:LOUNGE_CAPACITY_EXCEEDED:LOUNGE_01:DEL
TDBS:DOCK_SLA_BREACH:BOOKING_987:BOM
EREADBACK:LOCK_APPROVAL_PENDING:FLIGHT_AI101:DEL
```

Default deduplication window:

| Event Type | Default Window |
|---|---:|
| INFO | 5 minutes |
| WARNING | 10 minutes |
| CRITICAL | 1 to 3 minutes |
| ACTION_REQUIRED | Until acknowledged or expired |

---

## 6. Notification Lifecycle

Success flow:

```text
CREATED
→ RULE_EVALUATED
→ RECIPIENT_RESOLVED
→ TEMPLATE_RENDERED
→ QUEUED
→ SENT
→ DELIVERED
→ READ
→ ACKNOWLEDGED
```

Failure flow:

```text
CREATED
→ QUEUED
→ FAILED
→ RETRYING
→ FAILED_PERMANENT
→ DEAD_LETTER
```

Suppression flows:

```text
CREATED
→ SUPPRESSED_DUPLICATE
```

```text
CREATED
→ SUPPRESSED_BY_USER_PREFERENCE
```

```text
CREATED
→ SUPPRESSED_BY_ACCESS_RULE
```

Expiry flow:

```text
CREATED
→ QUEUED
→ EXPIRED
```

---

## 7. Status Naming Convention

Notification status values:

```text
CREATED
RULE_EVALUATED
RECIPIENT_RESOLVED
TEMPLATE_RENDERED
QUEUED
SENT
DELIVERED
READ
ACKNOWLEDGED
FAILED
RETRYING
FAILED_PERMANENT
DEAD_LETTER
SUPPRESSED_DUPLICATE
SUPPRESSED_BY_USER_PREFERENCE
SUPPRESSED_BY_ACCESS_RULE
EXPIRED
ARCHIVED
```

Delivery status values:

```text
PENDING
QUEUED
SENT
DELIVERED
FAILED
RETRYING
FAILED_PERMANENT
```

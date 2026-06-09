---
trigger: new_screen, new_module, new_config_key
---

# 16 — Timezone Display Rules

> AI ASSISTANT: Load this file when building any screen, report, notification, export, or module
> that displays date/time values to any user.
> Run Section TZ of `15-ai-self-check.md` before marking any timezone-related task complete.

---

## Core Principle (One-Line Rule)

> 👉 **"Save in UTC. Display using the resolved display mode — never the browser timezone."**

---

## Storage Rule (Always)

All timestamps stored in backend must be UTC. No exceptions.

```csharp
// CORRECT — backend always stores UTC:
entity.CreatedAtUtc = DateTime.UtcNow;
entity.ScheduledAtUtc = DateTime.UtcNow.AddHours(2);
```

```ts
// CORRECT — frontend sends UTC to API:
const payload = {
    scheduledAt: new Date().toISOString()  // "2026-04-17T10:30:00.000Z"
};

// WRONG — sends local time to API:
const payload = {
    scheduledAt: new Date().toLocaleDateString()  // VIOLATION — local time
};
```

---

## Two Display Modes

The system must support two configurable time display modes, selectable by user or administrator:

| Mode | Key | Meaning |
|---|---|---|
| **Station Time Zone** | `station` | All times shown in the operational station's configured timezone |
| **User Time Zone** | `user` | All times shown in the logged-in user's personal timezone |

**UI Label**: "Display Time As"
**Dropdown options**: `Station Time Zone` | `My Time Zone`

This setting must be stored in `cfg.ConfigValue` with key `TIMEZONE_DISPLAY_MODE`.

---

## 6-Level Resolution Hierarchy

When resolving which timezone to use for display, follow this order exactly.
Stop at the first non-null value found:

```
Level 1 → Screen/report-level override (if the screen explicitly sets a timezone)
Level 2 → User-selected display mode setting (station | user)
Level 3 → User profile timezone (User.TimezoneId)
Level 4 → Station timezone (cfg.ConfigValue: TIMEZONE_STATION_DEFAULT)
Level 5 → System default timezone (cfg.ConfigValue: TIMEZONE_SYSTEM_DEFAULT)
Level 6 → UTC (final fallback — log a WARNING when this is used)
```

**Never fall through silently to browser local time. If Level 6 is reached, log:**
```
WARN: Timezone could not be resolved for TenantId={id}. Falling back to UTC. DisplayMode={mode}
```

---

## Display Mode Logic

### Backend — Resolve and Return Timezone in API Response

The backend API must resolve the effective timezone and return it alongside UTC values:

```csharp
// CORRECT — return UTC value and resolved timezone together:
return new FlightDto {
    DepartureAtUtc   = flight.DepartureAtUtc,      // always UTC
    DisplayTimezone  = resolvedTimezone,            // resolved IANA ID
    DisplayMode      = displayMode                  // "station" | "user"
};

// WRONG — convert on backend before returning:
return new FlightDto {
    DepartureTime = TimeZoneInfo.ConvertTimeFromUtc(flight.DepartureAtUtc, tz)  // VIOLATION
};
```

### Frontend — Convert at Display Layer Only

```ts
// CORRECT — resolve display mode, then format:
export const formatDateTime = (
    utcString: string,
    displayMode: 'station' | 'user',
    stationTimezone: string,
    userTimezone: string,
    locale: string
): string => {
    const resolvedTz = displayMode === 'station' ? stationTimezone : userTimezone;
    return new Intl.DateTimeFormat(locale, {
        timeZone: resolvedTz,
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(utcString));
};

// Usage:
formatDateTime(
    record.departureAtUtc,
    user.timeZoneDisplayMode,     // "station" | "user"
    tenant.stationTimeZone,       // "Africa/Johannesburg"
    user.timeZone,                // "Asia/Kolkata"
    tenant.localeCode             // "en-IN"
)
```

```ts
// WRONG — any of these:
new Date(utcString).toLocaleDateString()    // VIOLATION — browser timezone
new Date(utcString).toLocaleString()        // VIOLATION — browser timezone
new Date(utcString).toString()              // VIOLATION — browser timezone
moment(utcString).format('DD/MM/YYYY')      // VIOLATION — no timezone applied
```

---

## Fallback Behaviour

| Display Mode | User TZ | Station TZ | System TZ | Result |
|---|---|---|---|---|
| `user` | ✅ Set | — | — | Use User TZ |
| `user` | ❌ Null | ✅ Set | — | Fall to Station TZ |
| `user` | ❌ Null | ❌ Null | ✅ Set | Fall to System TZ |
| `user` | ❌ Null | ❌ Null | ❌ Null | Fall to UTC + log WARNING |
| `station` | — | ✅ Set | — | Use Station TZ |
| `station` | — | ❌ Null | ✅ Set | Fall to System TZ |
| `station` | — | ❌ Null | ❌ Null | Fall to UTC + log WARNING |

---

## Config Keys (Store in `cfg.ConfigValue`)

| Key | Scope | Type | Example |
|---|---|---|---|
| `TIMEZONE_DISPLAY_MODE` | TENANT | STRING (`station` \| `user`) | `"station"` |
| `TIMEZONE_STATION_DEFAULT` | TENANT | STRING (IANA) | `"Africa/Johannesburg"` |
| `TIMEZONE_SYSTEM_DEFAULT` | GLOBAL | STRING (IANA) | `"UTC"` |
| `TIMEZONE_USER_OVERRIDE_ALLOWED` | TENANT | BOOL | `true` |

Config key `TIMEZONE_STATION_DEFAULT` and `TIMEZONE_USER_OVERRIDE` are per-tenant.
`TIMEZONE_SYSTEM_DEFAULT` is global fallback only.

---

## Validation Rules

```csharp
// CORRECT — validate IANA ID before saving:
try {
    TimeZoneInfo.FindSystemTimeZoneById(request.TimezoneId);
} catch (TimeZoneNotFoundException) {
    return BadRequest(ApiError.Validation(
        "Invalid timezone. Use a valid IANA timezone ID (e.g. 'Asia/Kolkata')",
        "timezoneId",
        correlationId));
}

// WRONG — accepting fixed UTC offset as primary config:
if (request.TimezoneId == "+05:30") { ... }   // VIOLATION — use IANA name, not offset
```

**Validation rules:**
- IANA ID required — `TimeZoneInfo.FindSystemTimeZoneById()` must not throw
- Fixed offsets like `+05:30`, `UTC+5` are rejected as primary timezone config values
- Empty string is rejected — fallback handled by the resolution hierarchy, not by storing empty

---

## Audit Trail for Critical Transactions

For any audit event that involves a time-sensitive action (scheduling, boarding, approval, reporting), the audit record must store 4 additional time context fields:

```csharp
// CORRECT — full time context in audit:
new AuditEvent {
    // ... standard fields ...
    PerformedAtUtc    = DateTime.UtcNow,
    // Additional timezone context:
    DisplayedLocalTime = localTimeString,        // what the user SAW on screen
    DisplayTimezoneId  = resolvedTimezoneId,     // IANA ID used for display
    DisplayMode        = "station" | "user",     // which mode was active
}

// Example:
// PerformedAtUtc:    "2026-04-17T10:30:00Z"
// DisplayedLocalTime: "2026-04-17 12:30"
// DisplayTimezoneId:  "Africa/Johannesburg"
// DisplayMode:        "station"
```

---

## Recommended Default Per System Type

| System Type | Recommended Default |
|---|---|
| Airport / Warehouse / Operational system | `station` — users work by station time |
| Management dashboard / HQ / Global users | `user` — users work in their own timezone |
| Reporting/analytics screens | Screen-level override (Level 1) — show both on demand |

---

## Example — Same UTC, Two Display Modes

```
Stored in backend:
    DepartureAtUtc = "2026-04-17T10:30:00Z"

Display Mode = station | Station TZ = Africa/Johannesburg (UTC+2):
    → Displayed: "2026-04-17 12:30"

Display Mode = user | User TZ = Asia/Kolkata (UTC+5:30):
    → Displayed: "2026-04-17 16:00"
```

---

## Self-Check (Run Before Marking Any Timezone Feature Complete)

| # | Check | Answer |
|---|---|---|
| TZ1 | All datetime columns stored as UTC (suffix `Utc`) | YES / NO |
| TZ2 | IANA timezone ID used everywhere — no Windows names, no `+05:30` | YES / NO |
| TZ3 | `TIMEZONE_DISPLAY_MODE` config key is read from `cfg.ConfigValue` — not hardcoded | YES / NO |
| TZ4 | Timezone conversion happens only at display layer (frontend / report renderer) | YES / NO |
| TZ5 | Fallback hierarchy implemented — does not silently use browser timezone | YES / NO |
| TZ6 | Resolution logs a WARNING when falling back to UTC | YES / NO |
| TZ7 | Critical audit events include: DisplayedLocalTime, DisplayTimezoneId, DisplayMode | YES / NO |
| TZ8 | IANA ID validated with `TimeZoneInfo.FindSystemTimeZoneById()` before saving | YES / NO |
| TZ9 | `formatDateTime()` helper exists and is used — no inline `toLocaleDateString()` | YES / NO |

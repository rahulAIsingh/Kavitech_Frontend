---
trigger: always_on
priority: 2
---

# 99 — Anti-Patterns (AI Must NEVER Generate These)

## INSTRUCTION FOR AI ASSISTANT

Every item in this file is a **hard rejection pattern**.
If you are about to generate code that matches any pattern below, STOP.
Refactor to the correct pattern before proceeding.
These are not suggestions. They are absolute rules.

---

## SECURITY ANTI-PATTERNS

### ❌ NEVER: Store any secret in appsettings.json or any source-controlled file
```json
// VIOLATION — never generate this:
"JwtSettings": { "Secret": "any-value-here" }
"ConnectionStrings": { "Default": "Server=...;Password=realpassword" }
"StorageKey": "AccountKey=abc123..."

// CORRECT:
"JwtSettings": { "Secret": "" }  // loaded from environment variable at runtime
// Environment variable: JWTSETTINGS__SECRET=<value-from-secure-store>
```

### ❌ NEVER: Log passwords, tokens, OTPs, or secrets
```csharp
// VIOLATION:
_logger.LogInformation("User {Email} logged in with password {Password}", email, password);
_logger.LogDebug("Token generated: {Token}", token);

// CORRECT:
_logger.LogInformation("Login attempt for {Email}", email);  // no password, partial token only
```

### ❌ NEVER: Return stack traces or SQL to the client
```csharp
// VIOLATION:
return BadRequest(ex.Message);
return BadRequest(ex.StackTrace);
return BadRequest(ex.InnerException?.Message);

// CORRECT:
return BadRequest(new ApiError { Message = "An error occurred.", Code = "VALIDATION_FAILED", CorrelationId = correlationId });
```

### ❌ NEVER: Trust TenantId or UserId from the request body
```csharp
// VIOLATION:
var tenantId = request.TenantId;   // client-provided, cannot trust
var userId = request.UserId;        // client-provided, cannot trust

// CORRECT:
var tenantId = _tenantContext.TenantId;  // from resolved tenant middleware
var userId = _currentUser.UserId;         // from validated JWT claims
```

### ❌ NEVER: Use [AllowAnonymous] on a mutation endpoint without documented justification
```csharp
// VIOLATION (without written justification):
[AllowAnonymous]
[HttpPost("users")]
public async Task<IActionResult> CreateUser(...)

// CORRECT: [AllowAnonymous] only on: login, public registration, webhook receivers with HMAC validation
```

### ❌ NEVER: Write inline role checks instead of permission evaluator
```csharp
// VIOLATION:
if (user.Role == "Admin") { DoSensitiveThing(); }
if (role == "SuperAdmin" || role == "Manager") { allow = true; }

// CORRECT:
if (!await _permissionEvaluator.HasPermissionAsync(userId, "module.entity.action")) 
    return Forbid();
```

### ❌ NEVER: Use MD5, SHA1, or plain SHA-256 for password hashing
```csharp
// VIOLATION:
var hash = MD5.HashData(Encoding.UTF8.GetBytes(password));
var hash = SHA1.HashData(Encoding.UTF8.GetBytes(password));
var hash = SHA256.HashData(Encoding.UTF8.GetBytes(password));  // raw SHA-256 without KDF

// CORRECT (preferred — Argon2id):
var hash = Argon2id.HashPassword(password, new Argon2idOptions {
    MemorySize = 65536, Iterations = 3, DegreeOfParallelism = 4
});

// CORRECT (acceptable fallback — BCrypt):
var hash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);
```

### ❌ NEVER: Store a redundant user permission override that duplicates a role-derived permission
```csharp
// VIOLATION — user already gets this permission from their role:
await _overrideService.GrantUserOverride(userId, permissionId, "ALLOW");
// when the user's role already includes this permission

// CORRECT — check first, reject if redundant:
var alreadyGrantedByRole = await _authService.IsPermissionGrantedByRole(userId, permissionId);
if (alreadyGrantedByRole)
    return Result.Failure("Override rejected: permission already granted by role assignment.");
```

### ❌ NEVER: Hardcode auth thresholds (lockout, token TTL, password history depth)
```csharp
// VIOLATION:
if (failedAttempts > 5) { LockAccount(); }                    // 5 is hardcoded
var tokenExpiry = DateTime.UtcNow.AddMinutes(30);             // 30 is hardcoded
if (passwordHistory.Count >= 5) { RejectReuse(); }            // 5 is hardcoded

// CORRECT — read from config:
var maxAttempts = await _configResolver.GetAsync<int>("AUTH_MAX_FAILED_ATTEMPTS", tenantId);
var tokenTtl = await _configResolver.GetAsync<int>("PASSWORD_RESET_TOKEN_TTL_STANDARD", tenantId);
var historyDepth = await _configResolver.GetAsync<int>("PASSWORD_HISTORY_DEPTH", tenantId);
```

---

## DATA / DATABASE ANTI-PATTERNS

### ❌ NEVER: Return unbounded results from a list endpoint
```csharp
// VIOLATION — no pagination:
return await _context.Orders.ToListAsync();
return await query.Select(x => new Dto(...)).ToListAsync();

// CORRECT — always paginate:
var items = await query
    .Skip((page - 1) * pageSize)
    .Take(Math.Min(pageSize, 500))  // hard cap
    .Select(x => new Dto(...))
    .ToListAsync();
return new PagedResult<Dto>(items, total, page, pageSize);
```

### ❌ NEVER: Use .ToLower() or .ToUpper() inside EF LINQ queries
```csharp
// VIOLATION — forces SQL function wrap, kills index usage:
query.Where(c => c.Name.ToLower() == input.ToLower())
query.Where(c => c.Email.ToUpper() == email.ToUpper())

// CORRECT — SQL Server collation handles case-insensitivity:
query.Where(c => c.Name == input)
query.Where(c => c.Email == email)
```

### ❌ NEVER: Use DateTime without Utc suffix in entity declarations
```csharp
// VIOLATION:
public DateTime CreatedAt { get; set; }
public DateTime? UpdatedOn { get; set; }

// CORRECT:
public DateTime CreatedAtUtc { get; set; }
public DateTime? UpdatedAtUtc { get; set; }
```

### ❌ NEVER: Hard-delete a business record without checking retention policy
```csharp
// VIOLATION:
_context.Customers.Remove(customer);

// CORRECT for business records — soft delete:
customer.IsDeleted = true;
customer.DeletedAtUtc = DateTime.UtcNow;
customer.DeletedBy = _currentUser.UserId;

// Hard delete only allowed for: join tables, temp records, or after retention purge window
```

### ❌ NEVER: Store PII in application log messages
```csharp
// VIOLATION:
_logger.LogWarning("Failed lookup for customer {Email} with ID {NationalId}", email, nationalId);

// CORRECT:
_logger.LogWarning("Failed lookup for customer {CustomerId}", customerId);
```

### ❌ NEVER: Use SELECT * or project entity directly to API response
```csharp
// VIOLATION:
return await _context.Users.ToListAsync();   // exposes ALL columns including PasswordHash

// CORRECT:
return await _context.Users.Select(u => new UserDto {
    Id = u.Id, Name = u.Name, Email = u.Email  // only safe fields
}).ToListAsync();
```

### ❌ NEVER: Use nvarchar(max) without justification comment
```csharp
// VIOLATION:
[Column(TypeName = "nvarchar(max)")]
public string Notes { get; set; }

// CORRECT (with justification) or use appropriate length:
[Column(TypeName = "nvarchar(2000)")]
public string Notes { get; set; }
// If truly unlimited: [Column(TypeName = "nvarchar(max)")] // justified: user-generated rich text content
```

---

## ARCHITECTURE ANTI-PATTERNS

### ❌ NEVER: Write business logic in a Controller
```csharp
// VIOLATION:
[HttpPost]
public async Task<IActionResult> CreateOrder(OrderRequest req) {
    if (req.TotalAmount > 10000) { /* complex rule */ }   // business rule in controller!
    var tax = req.TotalAmount * 0.18m;                    // calculation in controller!
    _context.Orders.Add(...);
}

// CORRECT — controller only orchestrates:
[HttpPost]
public async Task<IActionResult> CreateOrder(OrderRequest req) {
    var result = await _orderService.CreateOrderAsync(req, _currentUser.UserId, _tenantContext.TenantId);
    return result.IsSuccess ? Ok(result.Value) : BadRequest(result.Error);
}
```

### ❌ NEVER: Write hardcoded tenant-specific conditions
```csharp
// VIOLATION:
if (tenantId == Guid.Parse("some-guid")) { UseSpecialLogic(); }
if (tenant.Name == "ACME") { ApplyDiscount(); }
if (tenant.Code == "T001") { EnableFeature(); }

// CORRECT:
var isEnabled = await _configResolver.GetAsync<bool>("FEATURE_SPECIAL_LOGIC", tenantId);
if (isEnabled) { UseSpecialLogic(); }
```

### ❌ NEVER: Hardcode business thresholds or magic numbers
```csharp
// VIOLATION:
if (loginAttempts > 5) { LockAccount(); }          // 5 is hardcoded
if (amount > 10000) { RequireApproval(); }          // 10000 is hardcoded
var expiry = DateTime.UtcNow.AddDays(30);           // 30 days hardcoded

// CORRECT:
var maxAttempts = await _configResolver.GetAsync<int>("AUTH_MAX_LOGIN_ATTEMPTS", tenantId);
var approvalThreshold = await _configResolver.GetAsync<decimal>("APPROVAL_AMOUNT_THRESHOLD", tenantId);
var retentionDays = await _configResolver.GetAsync<int>("SESSION_RETENTION_DAYS", tenantId);
```

### ❌ NEVER: Call external APIs or long-running operations inside a DB transaction
```csharp
// VIOLATION:
using var tx = await _context.Database.BeginTransactionAsync();
_context.Orders.Add(order);
await _context.SaveChangesAsync();
await _emailService.SendAsync(email);   // external call inside transaction!
await tx.CommitAsync();

// CORRECT: commit transaction, then dispatch integration event via outbox
using var tx = await _context.Database.BeginTransactionAsync();
_context.Orders.Add(order);
_context.OutboxMessages.Add(new OutboxMessage("ORDER_CREATED", payload));
await _context.SaveChangesAsync();
await tx.CommitAsync();
// Background relay picks up outbox and sends email independently
```

### ❌ NEVER: Use async void (except event handlers)
```csharp
// VIOLATION:
public async void ProcessOrder(OrderRequest req)  // exceptions swallowed silently

// CORRECT:
public async Task ProcessOrderAsync(OrderRequest req)
```

---

## API ANTI-PATTERNS

### ❌ NEVER: Create an API endpoint without versioning
```csharp
// VIOLATION:
[Route("api/[controller]")]
public class OrdersController : ControllerBase

// CORRECT:
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[ApiVersion("1.0")]
public class OrdersController : ControllerBase
```

### ❌ NEVER: Return different error shapes from different endpoints
```csharp
// VIOLATION — inconsistent error shapes:
return BadRequest("Email is required");           // plain string
return BadRequest(new { error = "Not found" });   // ad-hoc object
return StatusCode(500, ex.Message);               // raw exception

// CORRECT — always use ApiError:
return BadRequest(ApiError.Validation("Email is required", "email", correlationId));
return NotFound(ApiError.NotFound("Order not found", correlationId));
return StatusCode(500, ApiError.Internal(correlationId));    // no detail exposed
```

---

## FRONTEND ANTI-PATTERNS

### ❌ NEVER: Render a sensitive action button without checking the permission
```tsx
// VIOLATION:
<button onClick={deleteUser}>Delete User</button>   // no permission check

// CORRECT:
{hasPermission('users.delete') && (
    <button onClick={deleteUser}>Delete User</button>
)}
```

### ❌ NEVER: Store sensitive data in localStorage
```ts
// VIOLATION:
localStorage.setItem('access_token', token);
localStorage.setItem('user_role', role);

// CORRECT:
// Access tokens: memory only (React state or context)
// Refresh tokens: httpOnly cookie (set by server)
// Non-sensitive state only in localStorage (theme preference, language)
```

### ❌ NEVER: Show a form with no loading state during submission
```tsx
// VIOLATION — no feedback during async call:
const handleSubmit = async () => { await api.save(data); };

// CORRECT:
const [loading, setLoading] = useState(false);
const handleSubmit = async () => {
    setLoading(true);
    try { await api.save(data); }
    finally { setLoading(false); }
};
```

### ❌ NEVER: Display raw API error messages to users
```tsx
// VIOLATION:
setError(error.response.data.message);        // may expose internal details
setError(error.message);                      // may expose stack trace or SQL

// CORRECT:
setError(error.response.data.userMessage      // use the user-safe message field
    ?? 'An error occurred. Please try again.');
```

---

## TIMEZONE ANTI-PATTERNS

### ❌ NEVER: Use Windows timezone names — always use IANA IDs
```csharp
// VIOLATION — Windows names break on Linux containers:
var tz = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");   // VIOLATION
var tz = TimeZoneInfo.FindSystemTimeZoneById("Eastern Standard Time"); // VIOLATION
user.TimezoneId = "India Standard Time";                               // VIOLATION

// CORRECT — IANA IDs work on all platforms (.NET 6+):
var tz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");    // ✅
var tz = TimeZoneInfo.FindSystemTimeZoneById("America/New_York"); // ✅
user.TimezoneId = "Asia/Kolkata";                                 // ✅
```

### ❌ NEVER: Convert UTC to local time in backend business logic or DB queries
```csharp
// VIOLATION — converting timezone in service/business layer:
var localTime = TimeZoneInfo.ConvertTimeFromUtc(order.CreatedAtUtc, tenantZone);
var display = order.CreatedAtUtc.ToLocalTime();     // VIOLATION — uses server local time

// CORRECT — store UTC, return UTC, let frontend convert for display:
return new OrderDto {
    CreatedAtUtc = order.CreatedAtUtc   // return UTC string, frontend formats it
};
```

### ❌ NEVER: Display dates using browser local timezone instead of tenant timezone
```tsx
// VIOLATION — uses browser timezone, ignores tenant/user timezone setting:
new Date(utcString).toLocaleDateString()     // VIOLATION
new Date(utcString).toLocaleString()         // VIOLATION
new Date(utcString).toString()               // VIOLATION
moment(utcString).format('DD/MM/YYYY')       // VIOLATION — no timezone applied

// CORRECT — always use the tenant/user timezone from AuthContext:
const { timezoneId, localeCode } = useAuth();
new Intl.DateTimeFormat(localeCode, {
    timeZone: timezoneId,
    dateStyle: 'medium',
    timeStyle: 'short'
}).format(new Date(utcString));
```

### ❌ NEVER: Hardcode a timezone anywhere in the codebase
```csharp
// VIOLATION:
var tz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata"); // hardcoded
var offset = "+05:30";                                         // hardcoded

// CORRECT — always read from config or user/tenant context:
var timezoneId = await _configResolver.GetAsync<string>("REGIONAL_TIMEZONE_DEFAULT", tenantId);
var tz = TimeZoneInfo.FindSystemTimeZoneById(timezoneId);
```

### ❌ NEVER: Store a DateTime without UTC suffix in any entity or DTO
```csharp
// VIOLATION:
public DateTime CreatedAt { get; set; }      // Is this UTC? Local? Unknown.
public DateTime DueDate { get; set; }        // Same ambiguity

// CORRECT:
public DateTime CreatedAtUtc { get; set; }   // Unambiguous — always UTC
public DateTime DueDateUtc { get; set; }     // Unambiguous — always UTC
```

### ❌ NEVER: Use a fixed UTC offset as a timezone configuration value
```csharp
// VIOLATION — fixed offsets do not account for DST and break in half the world:
config.StationTimezone = "+02:00";           // VIOLATION
config.StationTimezone = "UTC+5:30";         // VIOLATION
config.UserTimezone = "+05:30";              // VIOLATION

// CORRECT — always use IANA timezone ID:
config.StationTimezone = "Africa/Johannesburg";  // ✅ handles DST
config.UserTimezone = "Asia/Kolkata";            // ✅ correct IANA
```

### ❌ NEVER: Ignore the display mode setting and always use one timezone
```ts
// VIOLATION — hardcoded to tenant timezone, ignores display mode:
const displayTz = tenant.timeZone;   // VIOLATION — always uses tenant, never respects user mode

// CORRECT — resolve based on the display mode setting:
const displayTz = displayMode === 'station'
    ? tenant.stationTimeZone      // station mode → station timezone
    : user.timeZone               // user mode → user's timezone
    ?? tenant.stationTimeZone     // fallback → station timezone
    ?? 'UTC';                     // final fallback → UTC + log warning
```

---

## NOTIFICATION ANTI-PATTERNS

### ❌ NEVER: Send email, SMS, push, or webhook directly from a business service
```csharp
// VIOLATION — direct sending from business logic:
await _emailService.SendAsync("user@example.com", "Order Created", body);  // VIOLATION
await _smsService.SendAsync(phone, "Your order is confirmed");              // VIOLATION
await _pushService.SendAsync(deviceToken, title, message);                  // VIOLATION
_notificationService.Send(userId, "Order created");                         // VIOLATION if synchronous

// CORRECT — publish a domain event; the notification framework handles delivery:
await _eventPublisher.PublishAsync(new OrderCreatedEvent
{
    EventCode    = "ORDER_ORDER_CREATED",
    TenantId     = tenantId,
    ReferenceEntity = "Order",
    ReferenceId  = order.Id.ToString(),
    CorrelationId = correlationId,
    DedupKey     = $"ORDER:ORDER_CREATED:{order.Id}",
    EventTimestampUtc = DateTime.UtcNow,
    Payload      = new { order.Code, order.Status }
});
```

### ❌ NEVER: Hardcode recipients (email addresses, phone numbers, user IDs) in notification logic
```csharp
// VIOLATION:
await _emailService.SendAsync("ops@company.com", subject, body);   // hardcoded recipient
var recipientId = Guid.Parse("some-fixed-guid");                    // hardcoded userId
var recipients = new[] { "admin@tenant.com", "manager@tenant.com" }; // hardcoded list

// CORRECT — resolve recipients dynamically from DB via RecipientResolverService:
var recipients = await _recipientResolver.ResolveAsync(eventCode, tenantId, siteId, stationCode);
```

### ❌ NEVER: Block a business transaction waiting for notification delivery
```csharp
// VIOLATION — synchronous delivery inside business operation:
await _orderService.CreateAsync(request);
await _emailService.SendOrderConfirmationAsync(order);   // blocks transaction!
return Ok(result);

// CORRECT — publish event; delivery is fully async via queue workers:
await _orderService.CreateAsync(request);
await _eventPublisher.PublishAsync(new OrderCreatedEvent { ... });  // fire and forget
return Ok(result);
```

### ❌ NEVER: Generate a notification without a dedupKey
```csharp
// VIOLATION — no dedup key means duplicate notifications are possible:
var notification = new NotificationEvent
{
    EventCode   = "RMS_ROSTER_PUBLISHED",
    TenantId    = tenantId,
    ReferenceId = roster.Id.ToString()
    // missing DedupKey!
};

// CORRECT — always include a meaningful, stable dedupKey:
var notification = new NotificationEvent
{
    EventCode   = "RMS_ROSTER_PUBLISHED",
    TenantId    = tenantId,
    ReferenceId = roster.Id.ToString(),
    DedupKey    = $"RMS:ROSTER_PUBLISHED:{roster.Id}:{roster.PublishedAtUtc:yyyyMMddHH}"
};
```

### ❌ NEVER: Allow CRITICAL or ACTION_REQUIRED alerts to be silently suppressed without a policy check
```csharp
// VIOLATION — blindly applying user preference without checking severity:
if (!userPreference.IsEnabled(eventCode, channel))
    return;  // suppressed CRITICAL alert without checking if override is allowed!

// CORRECT — check severity first; only suppress if tenant policy allows:
if (!userPreference.IsEnabled(eventCode, channel))
{
    var isCritical = severity is "CRITICAL" or "ACTION_REQUIRED";
    var criticalOverrideEnabled = await _configResolver.GetAsync<bool>(
        "notification.critical_override_preferences.enabled", tenantId);
    if (isCritical && criticalOverrideEnabled)
        return;  // tenant says critical can override user preferences — suppress
    if (!isCritical)
        return;  // non-critical can be suppressed by user preference
    // isCritical && override NOT enabled → do NOT suppress, deliver anyway
}
```

### ❌ NEVER: Hardcode notification rules, templates, or channel configuration in application code
```csharp
// VIOLATION:
if (eventCode == "RMS_ROSTER_PUBLISHED") {
    var channels = new[] { "EMAIL", "IN_APP" };   // hardcoded channels
    var template = "Dear {user}, your roster has been published.";  // hardcoded template
}

// CORRECT — read everything from DB:
var rule     = await _notificationRuleRepo.GetByEventCodeAsync(eventCode, tenantId);
var template = await _templateResolver.ResolveAsync(eventCode, channelCode, languageCode);
var channels = rule.Channels;  // from DB, not code
```



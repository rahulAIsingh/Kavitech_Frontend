---
trigger: always_on
priority: 7
---

# 06 - Backend API and EF Rules

> AI ASSISTANT: These rules are always active. Apply all code templates exactly as shown.
> Run Section 2 (API) of `15-ai-self-check.md` after creating any endpoint.

---

## Standard API Response Contract

**All API responses MUST use these shapes. Never use ad-hoc anonymous objects.**

```csharp
// Success response wrapper:
public class ApiResponse<T>
{
    public bool Success { get; set; } = true;
    public T? Data { get; set; }
    public string? CorrelationId { get; set; }
}

// Error response:
public class ApiError
{
    public bool Success { get; set; } = false;
    public string Message { get; set; } = string.Empty;    // user-safe
    public string Code { get; set; } = string.Empty;       // machine-readable
    public string? CorrelationId { get; set; }
    public List<FieldError>? Errors { get; set; }          // validation errors

    public static ApiError Validation(string msg, string field, string correlationId) { ... }
    public static ApiError NotFound(string msg, string correlationId) { ... }
    public static ApiError Internal(string correlationId) { ... }  // no detail exposed
    public static ApiError Forbidden(string correlationId) { ... }
}

public class FieldError
{
    public string Field { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
```

---

## Standard Pagination Request / Response

**All list endpoints MUST use this pagination contract:**

```csharp
// Request (query parameters):
public class PagedRequest
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;   // default 20, max 500 (enforced server-side)
    public string? Search { get; set; }
    public string? SortBy { get; set; }
    public string? SortDirection { get; set; } = "asc";  // "asc" | "desc"
}

// Response:
public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
}

// EF query pattern:
var total = await query.CountAsync();
var items = await query
    .Skip((request.Page - 1) * request.PageSize)
    .Take(Math.Min(request.PageSize, 500))   // HARD CAP — never omit this
    .ToListAsync();
return new PagedResult<T> { Items = items, TotalCount = total, Page = request.Page, PageSize = request.PageSize };
```

---

## Standard Controller Pattern

**All controllers MUST follow this exact template:**

```csharp
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[ApiVersion("1.0")]
[Authorize]  // MANDATORY on all controllers (remove only for: login, public webhook with HMAC)
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly ICurrentUserAccessor _currentUser;
    private readonly ITenantContext _tenantContext;
    private readonly IPermissionEvaluator _permissions;
    private readonly ILogger<OrdersController> _logger;

    // Inject all of the above via constructor

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] PagedRequest request)
    {
        // 1. Check permission
        if (!await _permissions.HasPermissionAsync(_currentUser.UserId, "orders.order.view", _tenantContext.TenantId))
            return Forbid();

        // 2. Execute service (no business logic here)
        var result = await _orderService.GetAllAsync(request, _tenantContext.TenantId);

        // 3. Return wrapped response
        return Ok(new ApiResponse<PagedResult<OrderDto>> { Data = result, CorrelationId = HttpContext.Items["CorrelationId"]?.ToString() });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateOrderRequest request)
    {
        // 1. Check permission
        if (!await _permissions.HasPermissionAsync(_currentUser.UserId, "orders.order.create", _tenantContext.TenantId))
            return Forbid();

        // 2. Validate input
        if (!ModelState.IsValid)
            return BadRequest(ApiError.Validation("Validation failed", "", HttpContext.Items["CorrelationId"]?.ToString()!));

        // 3. Execute service
        var result = await _orderService.CreateAsync(request, _currentUser.UserId, _tenantContext.TenantId);

        // 4. Return
        return result.IsSuccess
            ? CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, new ApiResponse<OrderDto> { Data = result.Value })
            : BadRequest(ApiError.Validation(result.Error.Message, result.Error.Field, HttpContext.Items["CorrelationId"]?.ToString()!));
    }
}
```

---

## Correlation ID Middleware (Required in every project)

```csharp
// Register in Program.cs BEFORE UseAuthentication():
app.Use(async (context, next) =>
{
    var correlationId = context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
                        ?? Guid.NewGuid().ToString("N");
    context.Items["CorrelationId"] = correlationId;
    context.Response.Headers["X-Correlation-Id"] = correlationId;
    using (_logger.BeginScope(new { CorrelationId = correlationId }))
    {
        await next();
    }
});
```

---

## Service-Layer Rules

```csharp
// Services DO contain business logic. Controllers DO NOT.
// Service method pattern:

public async Task<Result<OrderDto>> CreateAsync(CreateOrderRequest request, string userId, Guid tenantId)
{
    // 1. Validate business rules
    var validationResult = await _validator.ValidateAsync(request);
    if (!validationResult.IsValid)
        return Result.Failure<OrderDto>(validationResult.Errors);

    // 2. Execute domain logic
    var order = Order.Create(request, tenantId);

    // 3. Persist
    await _context.Orders.AddAsync(order);
    await _context.SaveChangesAsync();

    // 4. Write audit event (MANDATORY for every mutation)
    await _auditWriter.WriteAsync(new AuditEvent
    {
        TenantId = tenantId,
        EventType = "ORDER.CREATED",
        EntityType = "Order",
        EntityId = order.Id.ToString(),
        Action = "CREATE",
        AfterValue = JsonSerializer.Serialize(order),
        PerformedBy = userId,
        PerformedAtUtc = DateTime.UtcNow,
        Channel = "WEB",
        CorrelationId = _correlationProvider.CorrelationId,
        Outcome = "SUCCESS"
    });

    return Result.Success(_mapper.Map<OrderDto>(order));
}
```

---

## Transaction Rules

✅ Use DB transactions for:
- Multi-entity writes that must succeed together
- Workflow state transitions
- Import commit batches
- Outbox pattern writes (record + outbox message in same transaction)

❌ NEVER hold a DB transaction open during:
- External API calls (HTTP, SMTP, SMS)
- File storage operations
- Long-running computations

```csharp
// CORRECT — commit transaction, then do external work:
await using var tx = await _context.Database.BeginTransactionAsync();
_context.Orders.Add(order);
_context.OutboxMessages.Add(new OutboxMessage("ORDER_CREATED", payload));
await _context.SaveChangesAsync();
await tx.CommitAsync();
// Outbox relay handles email/notification separately
```

---

## Background Job Rules

**Every job MUST record this minimum in `job.ExecutionLog`:**

```csharp
public class ExecutionLog
{
    public long Id { get; set; }
    public Guid TenantId { get; set; }
    public string JobType { get; set; } = string.Empty;
    public string CorrelationId { get; set; } = string.Empty;
    public string InitiatedBy { get; set; } = string.Empty;   // userId or "SCHEDULER"
    public string Status { get; set; } = "QUEUED";             // QUEUED|RUNNING|COMPLETED|FAILED|PARTIAL
    public int RetryCount { get; set; }
    public int MaxRetries { get; set; }
    public DateTime StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public string? FailureReason { get; set; }     // user-safe message
    public string? FailureDetail { get; set; }     // technical detail (NOT exposed to users)
    public string? ResultSummary { get; set; }     // e.g. "Inserted: 500, Skipped: 10, Failed: 2"
}
```

**Before writing any job, define:**
- Is the job idempotent? (safe to retry?)
- What is the max retry count? (read from config, not hardcoded)
- What is the compensating action on permanent failure?
- Does partial completion leave inconsistent data?

---

## Required Cross-Cutting Services (inject, never re-implement)

```csharp
ITenantContext          // TenantId resolved by middleware
ICurrentUserAccessor   // UserId, email, roles from JWT
IPermissionEvaluator   // HasPermissionAsync(userId, permKey, tenantId)
IConfigResolver        // GetAsync<T>(key, tenantId, scope)
IAuditWriter           // WriteAsync(AuditEvent)
ICorrelationProvider   // CorrelationId for current request
IExceptionMapper       // Maps exceptions to ApiError
IFileService           // Upload, Download, Delete abstraction
INotificationService   // Send abstraction (email, in-app, SMS)
IJobDispatcher         // Enqueue, Schedule jobs
```

---

## Rate Limiting

```csharp
// Use separate named policies — NEVER use one policy for everything:
builder.Services.AddRateLimiter(options => {
    // Login and auth endpoints — strict
    options.AddFixedWindowLimiter("auth", l => {
        l.PermitLimit = 5;
        l.Window = TimeSpan.FromMinutes(1);
    });
    // Public API read endpoints — lenient
    options.AddSlidingWindowLimiter("api_read", l => {
        l.PermitLimit = 100;
        l.Window = TimeSpan.FromMinutes(1);
        l.SegmentsPerWindow = 6;
    });
    // Export endpoints — very strict (prevent abuse)
    options.AddFixedWindowLimiter("export", l => {
        l.PermitLimit = 3;
        l.Window = TimeSpan.FromMinutes(5);
    });
    options.RejectionStatusCode = 429;
});
```

---
trigger: api_client, external_integration, partner_api, webhook_integration
priority: 7
---

# 20 - API Client Registry and External Integration Security

> AI ASSISTANT: Load this file when building any external-facing API, partner integration,
> webhook endpoint, or client-specific API access. Also load when registering a new API consumer
> or designing rate limiting for external clients.
> Run Section 12 of `15-ai-self-check.md` before marking any client-facing API task complete.

---

## Core Principle

**Every external API consumer must be registered, scoped, rate-limited, and revocable.**

No API should be exposed to any client unless ALL of the following are defined:
- Client/tenant mapping
- Environment access (DEV / QA / UAT / PROD)
- Authentication model
- Authorization scopes
- Rate limit policy
- Allowed IP ranges (if required)
- Allowed endpoints
- Payload size limits
- Audit logging rules
- Data exposure and masking rules
- Key/secret storage reference
- Credential expiry and rotation process

---

## API Client Registry Tables

Every project that exposes APIs to external consumers MUST implement this registry:

```sql
CREATE TABLE auth.ApiClient (
    ApiClientId          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId             UNIQUEIDENTIFIER NOT NULL,
    ClientName           NVARCHAR(200) NOT NULL,
    ClientType           NVARCHAR(50) NOT NULL,       -- PARTNER | INTERNAL | SYSTEM | WEBHOOK
    EnvironmentName      NVARCHAR(50) NOT NULL,        -- DEV | QA | UAT | PROD
    AuthType             NVARCHAR(50) NOT NULL,        -- OAUTH2 | JWT | APIKEY | MTLS
    AllowedIpRanges      NVARCHAR(2000) NULL,          -- JSON array of CIDR ranges, NULL = unrestricted
    SecretReferenceKey   NVARCHAR(300) NULL,           -- vault key name ONLY — no actual secret here
    KeyVersion           NVARCHAR(50) NULL,
    SecretExpiryDate     DATETIME2 NULL,
    LastRotatedAtUtc     DATETIME2 NULL,
    RateLimitPolicyId    UNIQUEIDENTIFIER NULL,
    OwnerTeam            NVARCHAR(100) NOT NULL,
    IsActive             BIT NOT NULL DEFAULT 1,
    CreatedAtUtc         DATETIME2 NOT NULL,
    CreatedBy            NVARCHAR(100) NOT NULL,
    UpdatedAtUtc         DATETIME2 NULL,
    UpdatedBy            NVARCHAR(100) NULL
);

CREATE TABLE auth.ApiClientScope (
    ApiClientScopeId     UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    ApiClientId          UNIQUEIDENTIFIER NOT NULL,
    ScopeCode            NVARCHAR(100) NOT NULL,       -- e.g. "orders.read", "reports.export"
    PermissionLevel      NVARCHAR(50) NOT NULL,        -- READ | WRITE | ADMIN
    IsActive             BIT NOT NULL DEFAULT 1
);
```

---

## Where Client Access Details Are Saved

### Save in Application DB (non-secret configuration)

- Tenant/client mapping
- Environment access rules
- Allowed API scopes
- Allowed IP ranges
- Rate limit policy mapping
- API client status (active/revoked)
- Expiry date
- Owner team
- Audit metadata (`CreatedAtUtc`, `CreatedBy`, `UpdatedAtUtc`, `UpdatedBy`)

### Save in Secret Manager ONLY (never in DB value fields)

- API client secret
- OAuth client secret
- JWT signing key
- Webhook signing secret
- SFTP password
- SMTP password
- Database password
- Certificate private key
- Encryption key

The DB stores **only the reference key name**, not the secret value.

```text
SecretReferenceKey = "kv-prod-project-client-partnerx-api-secret-v3"
```

---

## DB-Driven Rate Limit Policy Tables

Rate limits must be configurable from the database — not hardcoded in application code.

```sql
CREATE TABLE cfg.ApiRateLimitPolicy (
    RateLimitPolicyId    UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    PolicyName           NVARCHAR(100) NOT NULL,
    RequestsPerSecond    INT NULL,
    RequestsPerMinute    INT NULL,
    RequestsPerHour      INT NULL,
    RequestsPerDay       INT NULL,
    BurstLimit           INT NULL,
    RetryAfterSeconds    INT NOT NULL DEFAULT 60,
    BlockDurationMinutes INT NULL,
    IsActive             BIT NOT NULL DEFAULT 1,
    CreatedAtUtc         DATETIME2 NOT NULL,
    CreatedBy            NVARCHAR(100) NOT NULL
);

CREATE TABLE cfg.ApiClientRateLimit (
    ApiClientRateLimitId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    ApiClientId          UNIQUEIDENTIFIER NOT NULL,
    RateLimitPolicyId    UNIQUEIDENTIFIER NOT NULL,
    EffectiveFromUtc     DATETIME2 NOT NULL,
    EffectiveToUtc       DATETIME2 NULL,
    IsActive             BIT NOT NULL DEFAULT 1
);
```

### Recommended Rate Limit Values (Starting Point — Override via DB Policy)

| API Type | Suggested Limit |
|---|---|
| Login / Auth endpoints | 5 attempts/minute per username+IP |
| Public client API | 60 requests/minute, 1,000/hour |
| Internal trusted API | 300 requests/minute, 10,000/hour |
| File upload API | Limit by size + count + async queue capacity |
| Report export API | Low frequency — audited, preferably async |
| Password reset / OTP API | Strict — per user, per IP, per device |
| Webhook endpoints | Limit by source IP/client + verify signature |

### Rate Limit Enforcement Preference Order

For horizontally scaled APIs, **do not rely on in-memory rate limiting alone** — it does not work across multiple instances.

1. API Gateway / API Management (preferred for external-facing)
2. WAF / reverse proxy
3. Redis-backed distributed rate limiter (preferred for internal enforcement)
4. .NET in-process middleware (only acceptable for single-instance deployments)

### Standard Rate Limit Response

All rate-limit rejections must use this exact shape:

```json
{
  "success": false,
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please retry after some time.",
  "retryAfterSeconds": 60,
  "correlationId": "<correlation-id>"
}
```

HTTP status code: **429 Too Many Requests**
Response header: `Retry-After: 60`

---

## Allowed API Authentication Models

| Model | When to Use |
|---|---|
| OAuth2 Client Credentials | Machine-to-machine integrations |
| OIDC | User-delegated access via external provider |
| JWT Bearer | Stateless API access with signed tokens |
| Signed API Key (HMAC) | Controlled partner integrations — see Rule 19 for signing spec |
| mTLS | High-security service-to-service or financial integrations |
| Webhook HMAC Signature | Inbound webhook verification |

> ⚠️ Avoid Basic Authentication in production integrations unless explicitly approved with documented compensating controls.

---

## API Authorization Checklist (Per Request)

Every API request from an external client must verify ALL of the following before processing:

- [ ] Authenticated caller (valid token or key)
- [ ] API client status = Active (not revoked, not expired)
- [ ] Tenant / client mapping is valid
- [ ] Endpoint permission matches assigned scope
- [ ] IP address is in allowed range (if IP restriction is configured)
- [ ] Feature flag for this endpoint is enabled for this tenant
- [ ] Data ownership (results filtered to the client's allowed scope)
- [ ] Rate limit not exceeded for this client/IP combination

---

## Client Credential Rules

- Client credentials must have an expiry date — no indefinite credentials.
- Credentials must be rotated before expiry — alert 30 days before expiry.
- Rotation must not cause downtime — support overlapping old/new credentials during rotation grace period.
- Credentials must be revocable without code deployment (via DB status flag).
- Rotate immediately after suspected leak or team member exit.
- Production credentials must never be shared across environments.

---

## Client Handover Documentation

When providing API access to a client, provide ALL of the following. Never deliver production credentials in the same document as public API documentation:

- API documentation (OpenAPI / Swagger)
- Environment URLs (DEV, UAT, PROD separately)
- Authentication flow diagram
- Token endpoint and scopes
- Allowed IP ranges (if any)
- Rate limit details (requests/minute, requests/day, burst limit)
- Sample requests and responses
- Error code reference list
- Token expiry and refresh details
- Credential rotation process and support contact
- SLA and support escalation matrix

### Credential Handover — Allowed Channels Only

✅ Allowed:
- Secret manager invitation (preferred)
- Secure password vault share
- Encrypted handover file with password delivered via separate channel
- Client-approved secure credential vault

❌ Never allowed:
- Plain email
- Teams or Slack chat message
- Word / Excel document with plaintext credentials
- Screenshot of credentials
- Repository commit or PR comment

---

## Audit Events for API Client Operations

| EventType | When |
|---|---|
| `API_CLIENT.CREATED` | New API client registered |
| `API_CLIENT.UPDATED` | Client config modified |
| `API_CLIENT.REVOKED` | Client access revoked |
| `API_CLIENT.SCOPE_CHANGED` | Scope added or removed |
| `API_CLIENT.SECRET_ROTATED` | Credential rotated |
| `API_CLIENT.IP_RANGE_CHANGED` | Allowed IP list modified |
| `API_CLIENT.RATE_LIMIT_CHANGED` | Rate limit policy updated |
| `API_CLIENT.ACCESS_DENIED` | Request rejected (auth, scope, IP, rate) |

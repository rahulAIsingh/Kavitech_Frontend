---
trigger: always_on
priority: 8
---

# 08 - Security, Privacy, and Encryption Rules

> AI ASSISTANT: These rules are always active. Violations here are hard blockers — do not proceed, fix the gap first.

---

## Security Baseline (Every Project, No Exception)

- [ ] Secure authentication flows (see Rule 03)
- [ ] Authorization at all layers: UI, API, Service, Data (see Rule 03)
- [ ] Transport security (HTTPS mandatory in production)
- [ ] Secure response headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`)
- [ ] Input validation on every inbound request
- [ ] CSRF protections for form-based web flows
- [ ] Rate limiting on sensitive endpoints (see Rule 06)
- [ ] Secrets management (secret store — never source code)
- [ ] Audit logging (see Rule 09)
- [ ] Dependency vulnerability scanning in CI

---

## Secret Management Rules

✅ DO:
```json
// appsettings.json — always empty for secrets:
"JwtSettings": { "Secret": "" }
"ConnectionStrings": { "Default": "" }
"StorageAccount": { "Key": "" }

// Load actual values from environment variables:
// JWTSETTINGS__SECRET=<from-secure-store>
// CONNECTIONSTRINGS__DEFAULT=<from-secure-store>
```

✅ DO for Azure environments:
```csharp
// Reference Key Vault in appsettings — reference only, not the secret:
"KeyVault": { "Uri": "https://myvault.vault.azure.net/" }
// Then use AddAzureKeyVault in Program.cs to pull actual secrets at startup
```

❌ NEVER:
```json
// VIOLATIONS — never any of these in source:
"Secret": "A_REAL_SECRET_VALUE"
"Password": "dbpassword123"
"AccountKey": "abc/xyz+real+key=="
```

**Rule**: DB may store a `cfg.SecretReference` row pointing to a vault key by name. DB must NEVER store the actual secret value.

### SecretReference Table (Required in Every Project)

```sql
CREATE TABLE cfg.SecretReference (
    SecretReferenceId    UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId             UNIQUEIDENTIFIER NULL,          -- NULL = global/system-level secret
    EnvironmentName      NVARCHAR(50) NOT NULL,           -- DEV | QA | UAT | PROD
    SecretName           NVARCHAR(200) NOT NULL,
    SecretReferenceKey   NVARCHAR(300) NOT NULL,          -- vault key name — NO actual secret
    SecretPurpose        NVARCHAR(100) NOT NULL,          -- e.g. "JWT_SIGNING", "DB_CONNECTION"
    KeyVersion           NVARCHAR(50) NULL,
    OwnerTeam            NVARCHAR(100) NOT NULL,
    RotationFrequencyDays INT NULL,
    LastRotatedAtUtc     DATETIME2 NULL,
    ExpiryDate           DATETIME2 NULL,
    IsActive             BIT NOT NULL DEFAULT 1,
    CreatedAtUtc         DATETIME2 NOT NULL,
    CreatedBy            NVARCHAR(100) NOT NULL
);
```

### Environment Separation Rules

- DEV, QA, UAT, and PROD must use **completely separate secrets** — never share across environments.
- Production secrets must NOT be accessible to developers by default.
- Production secret access must be **approved and audited** — track access in `cfg.SecretReference` and audit log.
- Review secret access quarterly — remove access for anyone who no longer needs it.

### Secret Rotation Triggers

Rotate ALL secrets immediately when any of the following happen:
- Suspected or confirmed secret leak
- Team member with secret access leaves the organization
- Vendor / third-party integration is terminated
- Security incident involving the environment
- Scheduled rotation window reaches expiry date

> ⚠️ Loss of an encryption key may mean **permanent data loss**. Backup and DR plans MUST include key recovery steps for every encryption key in use. See `19-cryptography-standards.md` for full key management rules.

---

## Password Handling

✅ DO (PREFERRED — Argon2id):
```csharp
// Hash on create/change (preferred):
var hash = Argon2id.HashPassword(plainPassword, new Argon2idOptions {
    MemorySize = 65536, Iterations = 3, DegreeOfParallelism = 4
});

// Verify on login:
var isValid = Argon2id.VerifyHash(inputPassword, storedHash);
```

✅ DO (ACCEPTABLE FALLBACK — BCrypt):
```csharp
// If Argon2id library is unavailable:
var hash = BCrypt.Net.BCrypt.HashPassword(plainPassword, workFactor: 12);
var isValid = BCrypt.Net.BCrypt.Verify(inputPassword, storedHash);
```

✅ DO (FIPS FALLBACK — PBKDF2-HMAC-SHA-256):
```csharp
// When FIPS compliance is required:
var hash = Rfc2898DeriveBytes.Pbkdf2(plainPassword, salt, 600000, HashAlgorithmName.SHA256, 32);
```

❌ NEVER:
```csharp
// These are absolute violations:
var hash = MD5.HashData(bytes);                    // MD5 is broken
var hash = SHA1.HashData(bytes);                   // SHA1 is broken
var encrypted = AesEncrypt(password, key);         // reversible = VIOLATION
var stored = Convert.ToBase64String(bytes);        // plain = VIOLATION
_logger.LogInformation("Password: {p}", password); // logged = VIOLATION
```

Password policy must come from `cfg.PasswordPolicy` per tenant. Never hardcode min length, complexity, expiry, or lockout threshold.

> For detailed password policy rules, password history, forgot-password flow, and change-password flow, see `17-role-user-management-spec.md` Sections 4–6.

---

## Logging Privacy Rules

❌ NEVER log these fields:
```csharp
// VIOLATIONS:
_logger.Log("Password: {p}", password);
_logger.Log("Token: {t}", accessToken);
_logger.Log("OTP: {o}", otp);
_logger.Log("Key: {k}", encryptionKey);
_logger.Log("NationalId: {n}", aadhaarNumber);
_logger.Log("Card: {c}", cardNumber);

// CORRECT — log reference only:
_logger.Log("Auth action for user {UserId} correlation {CorrelationId}", userId, correlationId);
```

✅ Minimize (log only when operationally necessary):
- Email address
- Phone number
- Full name
- Physical address

---

## Data Classification (Act Proportionately)

| Classification | Examples | Controls |
|---|---|---|
| Public | Product names, pricing | No special controls |
| Internal | Business records, reports | Standard access control |
| Confidential | Contracts, financials | Role-based access + audit |
| Sensitive PII | Name, email, phone, address | Access control + anonymization support |
| Regulated | National ID, passport, biometric, health | Field-level encryption or tokenization + strict audit |
| Secret | Passwords, tokens, keys | Hash (passwords) or secret store (keys/tokens) |

---

## GDPR / Privacy Requirements

The application must be able to:
- [ ] Capture consent where required (with policy version, timestamp, channel)
- [ ] Record policy/version acceptance
- [ ] Fulfill right-to-access requests (export all data linked to a subject)
- [ ] Fulfill right-to-rectification
- [ ] Fulfill right-to-erasure (anonymize → purge three-state model, see Rule 03)
- [ ] Distinguish records under legal hold (must NOT be purged)
- [ ] Export all subject-linked data in machine-readable format

---

## Confidential File Handling

### File Storage Rules

- Store all sensitive files in **private** blob/object storage — no public folders, no permanent public URLs.
- Encrypt files at rest.
- Store file metadata in DB; store actual file binary in blob/object storage outside the codebase.
- Use tenant-specific logical segregation (TenantId in storage path or container).

### Required DB Tables

```sql
CREATE TABLE file.SecureFile (
    FileId                  UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId                UNIQUEIDENTIFIER NOT NULL,
    EntityType              NVARCHAR(100) NOT NULL,      -- what owns this file (e.g. "Contract", "Employee")
    EntityId                UNIQUEIDENTIFIER NULL,
    FileCategory            NVARCHAR(100) NOT NULL,
    FileClassification      NVARCHAR(50) NOT NULL,       -- Public | Internal | Confidential | Restricted
    StorageProvider         NVARCHAR(50) NOT NULL,       -- AzureBlob | S3 | Local
    StoragePath             NVARCHAR(1000) NOT NULL,
    FileNameOriginal        NVARCHAR(255) NOT NULL,
    FileNameStored          NVARCHAR(255) NOT NULL,      -- server-renamed, never trust original
    MimeType                NVARCHAR(100) NOT NULL,
    FileSizeBytes           BIGINT NOT NULL,
    FileHashAlgorithm       NVARCHAR(20) NULL,           -- "SHA-256"
    FileHashValue           NVARCHAR(256) NULL,          -- for integrity verification
    EncryptionStatus        NVARCHAR(50) NOT NULL,       -- ENCRYPTED | UNENCRYPTED
    EncryptionKeyReference  NVARCHAR(300) NULL,          -- vault key reference (see Rule 19)
    EncryptionKeyVersion    NVARCHAR(50) NULL,
    VirusScanStatus         NVARCHAR(50) NOT NULL,       -- PENDING | CLEAN | INFECTED | FAILED
    RetentionPolicyId       UNIQUEIDENTIFIER NULL,
    IsDeleted               BIT NOT NULL DEFAULT 0,
    CreatedAtUtc            DATETIME2 NOT NULL,
    CreatedBy               NVARCHAR(100) NOT NULL,
    DeletedAtUtc            DATETIME2 NULL,
    DeletedBy               NVARCHAR(100) NULL
);

CREATE TABLE file.SecureFileAccessLog (
    AccessLogId     UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    FileId          UNIQUEIDENTIFIER NOT NULL,
    TenantId        UNIQUEIDENTIFIER NOT NULL,
    UserId          UNIQUEIDENTIFIER NULL,
    ApiClientId     UNIQUEIDENTIFIER NULL,
    Action          NVARCHAR(50) NOT NULL,              -- UPLOAD | VIEW | DOWNLOAD | DELETE | SHARE
    AccessedAtUtc   DATETIME2 NOT NULL,
    IpAddress       NVARCHAR(100) NULL,
    DeviceId        NVARCHAR(200) NULL,
    Result          NVARCHAR(50) NOT NULL,              -- SUCCESS | DENIED | ERROR
    CorrelationId   NVARCHAR(100) NULL
);
```

### Upload Rules

Every upload must validate:
- [ ] Extension allowlist only — reject unlisted extensions
- [ ] MIME type validation
- [ ] File signature / magic bytes validation (not just extension)
- [ ] File size limit from config (key: `FILE_MAX_UPLOAD_SIZE_MB`)
- [ ] Filename sanitization — rename server-side, never trust original filename
- [ ] Malware / antivirus scan before file is accessible
- [ ] Tenant ownership verified
- [ ] User permission verified
- [ ] Strip EXIF / metadata from images (GDPR: GPS location, author name)
- [ ] Duplicate hash check where applicable
- [ ] Protect upload endpoints with CSRF token

Blocked unless explicitly approved:
- Executable files (`.exe`, `.dll`, `.bat`, `.sh`)
- Script files (`.js`, `.ps1`, `.vbs`)
- Double extensions (`.jpg.exe`)
- Macro-enabled Office files (`.xlsm`, `.docm`)
- Password-protected archives
- Files with active embedded content

### Download and View Rules

- Every download requires explicit permission check.
- Sensitive files must be accessed through a controlled API — never via direct storage URL.
- Use **short-lived signed URLs** where applicable (expire within minutes, not hours).
- Signed URLs must NOT be logged in full — log only the file ID and access event.
- Every view, download, and delete must write a `SecureFileAccessLog` record.
- Bulk downloads require special elevated permission.

### File Sharing Rules

✅ Preferred sharing channels:
- Secure portal access (authenticated download)
- Short-lived signed URL
- Encrypted file transfer
- SFTP with managed credentials
- Client-approved secure storage

❌ Never send confidential files via:
- Unencrypted email attachment
- Teams or Slack message
- Shared public URL
- Unencrypted FTP

### File Retention and Deletion

- Soft delete metadata first (`IsDeleted = true`, `DeletedAtUtc`, `DeletedBy`).
- Physical purge from storage must follow the configured retention policy.
- Legal hold must prevent deletion — check before purging.
- GDPR erasure must delete or anonymize eligible files.
- Every deletion must be audited in `SecureFileAccessLog`.

---

## Session and Token Rules

- Enforce expiry and idle timeout from `cfg.SessionPolicy` (never hardcoded)
- Support explicit logout with server-side token/session invalidation
- Admin sessions must use shorter timeout than standard user sessions
- Log all lockouts and repeated failures with audit event

---

## Security Release Gate

**A release MUST NOT proceed to production if any of these are unresolved:**

- [ ] Secret exposure risk (any secret in source, config, or DB value field)
- [ ] Weak auth flow (no password hashing, no lockout policy)
- [ ] Missing permission checks on any non-public endpoint
- [ ] Missing audit trail for any privileged action
- [ ] Sensitive data logged in any log statement
- [ ] Hardcoded keys or configuration in source
- [ ] Unreviewed file upload path (if feature exists)
- [ ] Unresolved critical/high severity vulnerability in dependency scan

---
trigger: before_golive, release_sign_off, production_deployment
priority: 9
---

# 22 - Security Acceptance Checklist (Go-Live Gate)

> AI ASSISTANT: Load this file when a project or feature is approaching production go-live.
> Every item below must be verified. A release MUST NOT proceed if any item is unresolved.
> This is a gate checklist — it supplements `15-ai-self-check.md` which is for per-task verification.

---

## Section 1 — Threat Model and Data Classification

- [ ] Threat model completed and reviewed
- [ ] Data classification completed (every DB field, file category, API payload, report, and export is classified)
- [ ] PII inventory completed — all personal data fields identified and documented
- [ ] Data residency requirements confirmed (where data is stored, processed, and backed up)
- [ ] Legal basis for processing personal data defined (GDPR / applicable law)
- [ ] Consent requirements documented and implemented where applicable

---

## Section 2 — Authentication and Session Security

- [ ] Authentication tested for all supported auth modes (LOCAL / OIDC / LDAP / HYBRID as applicable)
- [ ] MFA tested for privileged users and admin roles
- [ ] Session handling tested: expiry, idle timeout, explicit logout
- [ ] Password reset flow tested end-to-end
- [ ] Account lockout tested (failed login threshold from `cfg.ConfigValue` — not hardcoded)
- [ ] Remember-me token flow tested (server-backed opaque tokens — not localStorage)
- [ ] JWT TenantId claim validation tested (cross-tenant token reuse must be rejected with 403)
- [ ] Bootstrap admin credential is NOT a permanent hardcoded password

---

## Section 3 — Authorization and RBAC

- [ ] Permission keys defined for every screen and action
- [ ] Permission checks verified at API level (not only UI level)
- [ ] Service-layer re-verification implemented for sensitive operations
- [ ] Tenant isolation tested: Tenant A cannot access Tenant B data
- [ ] Role hierarchy cycle prevention tested
- [ ] Redundant user permission override rejection tested
- [ ] Admin accounts are NOT exempt from permission evaluator

---

## Section 4 — API Security

- [ ] API client registry configured for every external consumer (see Rule 20)
- [ ] API scopes defined and enforced per client
- [ ] API rate limits configured (via DB policy — not hardcoded)
- [ ] Rate limit response tested: 429 status + `retryAfterSeconds` + `correlationId`
- [ ] IP allowlisting configured where required
- [ ] Credential expiry dates set for all API clients
- [ ] API versioned routes in use: `api/v{version:apiVersion}/...`
- [ ] No stack traces, SQL text, or internal paths returned in any API error response
- [ ] All responses use `ApiResponse<T>` wrapper and `ApiError` contract

---

## Section 5 — Keys, Secrets, and Cryptography

- [ ] No secrets in any source file, appsettings.json, DB value field, log, or email
- [ ] All secrets stored in approved secret manager (Azure Key Vault / AWS Secrets Manager / HashiCorp Vault / equivalent)
- [ ] DEV, QA, UAT, and PROD use separate secret store entries — no shared secrets across environments
- [ ] Production secret access is approved, audited, and restricted to necessary personnel only
- [ ] `SecretReference` table contains key references only — no actual secret values
- [ ] Key rotation process documented for every encryption key in use
- [ ] Emergency key rotation process tested
- [ ] DR backup and restore plan includes key recovery steps

### Cryptography-Specific Checklist

- [ ] `19-cryptography-standards.md` reviewed and applied to all encryption code
- [ ] TLS 1.2+ enforced; SSL, TLS 1.0, TLS 1.1 disabled; weak cipher suites disabled
- [ ] AES-256-GCM used for reversible sensitive field and file encryption
- [ ] Unique nonce/IV generated per encryption operation — never reused
- [ ] Authentication tag stored alongside ciphertext and validated on decryption
- [ ] Key version and algorithm stored with every encrypted record
- [ ] SHA-256 / SHA-512 used only for integrity, checksum, duplicate detection, or audit hash chaining
- [ ] HMAC-SHA256 used for signed webhook and partner API request verification
- [ ] Constant-time comparison used for HMAC signature verification
- [ ] Passwords hashed using Argon2id (preferred), PBKDF2-HMAC-SHA256, or bcrypt — per-password algorithm tracking stored
- [ ] Plain SHA / MD5 / SHA-1 NOT used anywhere for passwords
- [ ] No prohibited algorithms found: MD5, SHA-1, DES, 3DES, RC4, AES-ECB, static IV, custom crypto, `alg=none` JWT
- [ ] Certificate expiry monitoring configured (alert at 30, 14, and 7 days)
- [ ] Private keys stored only in key vault / certificate store / HSM

---

## Section 6 — Database Security

- [ ] TDE (Transparent Data Encryption) enabled where supported
- [ ] Database backups are encrypted
- [ ] Column-level encryption implemented for Restricted/Regulated fields
- [ ] Always Encrypted used where DB admins must not see plaintext sensitive data
- [ ] Passwords are hashed — not stored as reversible encrypted values
- [ ] All tenant-owned tables include `TenantId` column
- [ ] EF global query filters configured for all tenant-owned entities
- [ ] Application DB principal has least-privilege access (INSERT-only on `audit.*` tables)
- [ ] No production DB manual changes without approval and rollback plan reviewed

---

## Section 7 — File and Document Security

- [ ] All sensitive files stored in private blob/object storage (no public URLs)
- [ ] File encryption at rest confirmed
- [ ] `SecureFile` table implemented with `EncryptionStatus`, `EncryptionKeyReference`, `VirusScanStatus`, `RetentionPolicyId`
- [ ] `SecureFileAccessLog` table implemented — every upload/view/download/delete is audited
- [ ] Malware scanning enabled for all uploaded files before they are accessible
- [ ] Upload validation implemented: extension allowlist, MIME type, magic bytes, file size, filename sanitization
- [ ] Blocked file types enforced: executables, scripts, double extensions, macro-enabled files
- [ ] Signed URLs implemented with short expiry — not logged in full
- [ ] EXIF / metadata stripped from images before storage
- [ ] File hash (SHA-256) stored for integrity verification

---

## Section 8 — Application Security (Web, Mobile, API)

- [ ] Secure response headers configured: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`
- [ ] CORS restricted to known origins only
- [ ] CSRF protection implemented where cookie-based authentication is used
- [ ] Access tokens stored in memory only (NOT localStorage / sessionStorage)
- [ ] Refresh tokens served as httpOnly, Secure, SameSite cookies (set by server only)
- [ ] Raw API error messages never displayed directly to users
- [ ] Input validation implemented on every inbound request (API, import, file, queue)
- [ ] Dependency vulnerability scan completed — no unresolved critical or high severity issues

---

## Section 9 — Logging, Monitoring, and Audit

- [ ] Logs verified to contain: UTC timestamp, correlation ID, tenant ID, user ID, action, result
- [ ] Logs verified to NOT contain: passwords, OTPs, tokens, API keys, encryption keys, full PII
- [ ] Audit log records verified for: login/logout, password reset, MFA change, role changes, file operations, admin actions, data deletion
- [ ] Audit records are INSERT-only — no application UPDATE or DELETE on `audit.*` tables
- [ ] Monitoring alerts configured for: failed login spike, rate limit abuse, cross-tenant access attempt, excessive export/download, backup failure, dead-letter growth, expired certificate
- [ ] Correlation ID propagated through all log statements
- [ ] Health check endpoint (`/api/health`) confirmed responding

---

## Section 10 — GDPR and Privacy

- [ ] GDPR rights implemented where applicable: access, rectification, erasure, restriction, portability, consent withdrawal
- [ ] Three-state delete implemented: Active → SoftDeleted → Anonymized → Purged
- [ ] Legal hold mechanism prevents purge of records under hold
- [ ] Retention policy configured per data class — not indefinite retention
- [ ] Temporary import files purged after processing
- [ ] Consent capture implemented with policy version, timestamp, and channel where required
- [ ] Data export for subject access requests produces machine-readable output

---

## Section 11 — Backup, DR, and Deployment

- [ ] Automated daily backups confirmed and tested (DB + file storage)
- [ ] Restore tested successfully before go-live
- [ ] RPO and RTO defined and confirmed achievable
- [ ] Rollback steps documented with owner name and estimated rollback time
- [ ] Environment config and secrets verified: no DEV secrets in PROD environment
- [ ] Feature flags reviewed and set correctly for production
- [ ] No unreviewed schema changes applied directly to PROD outside migration artifacts

### Azure Deployment (if applicable)

- [ ] Key Vault configured and referenced via Managed Identity
- [ ] HTTPS-only enforced on App Service / API Management
- [ ] SQL Server firewall restricted to application IPs only
- [ ] TDE and automated backups enabled on Azure SQL
- [ ] Private endpoints used where required
- [ ] Azure Monitor / Application Insights diagnostics enabled

### VM / IIS Deployment (if applicable)

- [ ] OS hardened and patched
- [ ] Unused ports disabled
- [ ] HTTPS binding only — no HTTP
- [ ] Directory browsing disabled in IIS
- [ ] App pool running under least-privilege identity
- [ ] RDP / SSH restricted to approved IP ranges or VPN only
- [ ] Secrets stored outside web root
- [ ] Backup and monitoring enabled

---

## Section 12 — VAPT and Security Testing

- [ ] SAST completed — no unresolved critical or high severity findings
- [ ] Dependency / SCA scan completed — no unresolved critical or high severity vulnerabilities
- [ ] Secret scan completed — no secrets found in codebase or build artifacts
- [ ] DAST / API security scan completed on release candidate
- [ ] Tenant isolation test completed — Tenant A cannot read Tenant B data confirmed
- [ ] File upload security test completed
- [ ] Authentication and authorization tests completed
- [ ] Rate limit test completed — 429 response verified
- [ ] Backup / restore validation completed
- [ ] External VAPT completed (required before first production go-live)
- [ ] All critical and high VAPT findings closed or have approved exception with documented compensating controls

### VAPT Frequency Reference

| Activity | Required Frequency |
|---|---|
| SAST | Every build |
| Secret scan | Every commit / every build |
| Dependency scan | Every build / daily |
| DAST / API scan | Every release candidate |
| Internal VAPT | Monthly or major release |
| External VAPT | Before go-live and annually |

### Hard Release Blockers (Production MUST be blocked if any are unresolved)

- Critical vulnerability (any)
- High vulnerability without approved documented exception
- Authentication bypass
- Authorization bypass / privilege escalation
- Tenant data leakage between tenants
- SQL injection
- Exposed secrets in source or build artifacts
- Plaintext sensitive data in logs
- Unrestricted file upload
- Broken MFA or password reset flow
- Sensitive data returned in API response body

---

## Section 13 — Client Handover and Accessibility

- [ ] API documentation delivered to client (OpenAPI / Swagger)
- [ ] Client credentials delivered via approved secure channel only (never plain email, Teams chat, or document)
- [ ] Client responsibility matrix defined for hosted environments (who owns certs, patching, DB backup, keys, monitoring, incident escalation)
- [ ] WCAG 2.1 AA accessibility requirements reviewed for all UI screens:
  - [ ] Keyboard navigation works for all critical flows
  - [ ] Visible focus indicators on all interactive elements
  - [ ] Sufficient color contrast (WCAG AA minimum)
  - [ ] All form controls have labels
  - [ ] Screen-reader friendly components (aria attributes where needed)
  - [ ] No color-only status indicators (use icon or text alongside color)
  - [ ] Responsive design verified on desktop, tablet, and mobile

---

## Final Sign-Off Statement

Before marking production go-live as approved, the responsible technical lead must confirm:

> "I have reviewed and verified all applicable items in `22-security-acceptance-checklist.md`.
> All items are resolved, documented, or have an approved exception on record.
> The application is ready for production release."

Name: _________________ Date: _________________ Version: _________________

---
trigger: encryption, file_encryption, webhook_signing, jwt_signing, key_management
priority: 9
---

# 19 - Cryptography Standards

> AI ASSISTANT: Load this file when writing any code that encrypts/decrypts data, signs requests or webhooks,
> handles JWT signing keys, manages encryption keys, or stores sensitive field values.
> Run Section 11 of `15-ai-self-check.md` before marking any cryptographic task complete.

---

## Golden Rules (Never Break These)

1. Do NOT create custom encryption algorithms — use platform-approved libraries only.
2. Do NOT hardcode keys in source code, frontend code, mobile app bundles, scripts, config files, or database value fields.
3. Do NOT reuse IV/nonce values with the same key — generate a fresh random IV/nonce per operation.
4. Do NOT use ECB mode for any block cipher.
5. Do NOT use plain SHA-256/SHA-512 for passwords — use Argon2id / PBKDF2 / bcrypt (see Rule 08).
6. Do NOT log plaintext values, ciphertext keys, IVs with sensitive context, tokens, or secrets.
7. Always store key version with encrypted data — decryption depends on knowing which key was used.
8. Always plan key rotation before go-live — define it before writing encryption code.
9. Use managed key vault / secret manager for all production keys (see Rule 08).
10. Use reviewed and maintained cryptographic libraries only — no homebrew crypto.

---

## Approved Encryption Standards

| Use Case | Approved Standard | Notes |
|---|---|---|
| Data in transit | TLS 1.2 minimum, TLS 1.3 preferred | HTTPS mandatory for all APIs, portals, mobile apps, integrations |
| Application-level field encryption | AES-256-GCM preferred | Unique nonce/IV per operation — never reuse |
| Application-level file encryption | AES-256-GCM preferred | Store key version and metadata separately |
| Database at-rest encryption | SQL Server TDE / cloud DB encryption | Protects DB files and backups |
| Sensitive DB fields | SQL Always Encrypted or application-level AES-GCM | Use where DB admin isolation is required |
| Backup encryption | Platform-native backup encryption or AES-256 | Keys must be recoverable in DR scenario |
| Queue payload encryption | AES-256-GCM where payload contains sensitive data | Prefer avoiding sensitive payloads in queues entirely |

---

## AES-GCM Rules (Mandatory for Reversible Field and File Encryption)

AES-GCM provides both confidentiality and integrity. It is the preferred standard for reversible application-level encryption.

### Mandatory Rules

- Use AES-256-GCM wherever supported.
- Generate a **fresh random nonce/IV for every single encryption operation** — never reuse.
- Store the authentication tag with the ciphertext.
- Store the key version with the ciphertext.
- Do not truncate the authentication tag unless formally approved.
- Validate the authentication tag before trusting decrypted data.
- Failed tag validation must be treated as tampering or corruption — reject immediately.
- Decryption failures must never expose internal cryptographic details to users.

### .NET Implementation Pattern

```csharp
// CORRECT — AES-256-GCM encryption:
public static EncryptedValue Encrypt(byte[] plaintext, byte[] key, string keyVersion)
{
    var nonce = new byte[AesGcm.NonceByteSizes.MaxSize]; // 12 bytes
    RandomNumberGenerator.Fill(nonce);

    var ciphertext = new byte[plaintext.Length];
    var tag = new byte[AesGcm.TagByteSizes.MaxSize]; // 16 bytes

    using var aes = new AesGcm(key, AesGcm.TagByteSizes.MaxSize);
    aes.Encrypt(nonce, plaintext, ciphertext, tag);

    return new EncryptedValue
    {
        CipherText   = Convert.ToBase64String(ciphertext),
        Nonce        = Convert.ToBase64String(nonce),
        Tag          = Convert.ToBase64String(tag),
        KeyVersion   = keyVersion,
        Algorithm    = "AES-256-GCM",
        EncryptedAtUtc = DateTime.UtcNow
    };
}

// CORRECT — AES-256-GCM decryption with tag validation:
public static byte[] Decrypt(EncryptedValue encrypted, byte[] key)
{
    var ciphertext = Convert.FromBase64String(encrypted.CipherText);
    var nonce      = Convert.FromBase64String(encrypted.Nonce);
    var tag        = Convert.FromBase64String(encrypted.Tag);
    var plaintext  = new byte[ciphertext.Length];

    using var aes = new AesGcm(key, AesGcm.TagByteSizes.MaxSize);
    aes.Decrypt(nonce, ciphertext, tag, plaintext); // throws if tag is invalid — do NOT catch silently
    return plaintext;
}
```

### Cryptographic Storage Format — DB Fields

For every encrypted sensitive field, store these alongside it:

```text
<FieldName>_CipherText     — base64 encoded ciphertext
<FieldName>_Nonce          — base64 encoded nonce/IV (unique per operation)
<FieldName>_Tag            — base64 encoded GCM authentication tag
<FieldName>_KeyVersion     — reference to which key version was used
<FieldName>_Algorithm      — always "AES-256-GCM"
```

Example for PassengerName field:

```text
PassengerNameCipherText
PassengerNameNonce
PassengerNameTag
PassengerNameKeyVersion
PassengerNameAlgorithm
```

---

## Hashing Standards (Not for Passwords)

Hashes are one-way — do NOT use them for data you need to decrypt.

### Approved Use Cases for SHA-256 / SHA-512

- File checksum validation
- Duplicate file detection
- Package integrity verification
- Audit hash chaining (tamper evidence)
- Request canonicalization before signing
- Non-secret deterministic lookup (only after security review)

### Rules

- SHA-256 minimum for checksums.
- SHA-512 for stronger integrity requirements.
- **Do NOT use MD5.**
- **Do NOT use SHA-1.**
- Do NOT use unsalted hashes for sensitive personal identifiers without an approved pseudonymization design.
- **Do NOT use plain SHA hashing for passwords** — see Rule 08 for password hashing.

### Example File Metadata Fields

```text
FileHashAlgorithm = "SHA-256"
FileHashValue     = <hex or base64 hash>
```

---

## HMAC and API / Webhook Signing

Use HMAC for request signing and webhook verification when shared-secret signing is required.

### Approved Standard: HMAC-SHA256

### Use Cases

- Signed webhook delivery (inbound and outbound)
- Partner API request validation
- Callback verification
- Message integrity validation
- Replay protection

### Mandatory Rules

- Sign a **canonical** request content string — define the canonicalization format explicitly.
- Include a **timestamp** in the signature base string.
- Include a **nonce/request ID** where possible.
- **Reject stale timestamps** (default: reject if older than 5 minutes — read from config).
- **Reject replayed request IDs** (track in cache/DB with TTL).
- Store webhook/API signing secrets **only in secret manager** — never in DB value fields or source code.
- Rotate signing secrets periodically.
- Support overlapping old/new secret during rotation grace period.
- Use **constant-time comparison** when verifying signatures — never use string equality.

### Recommended Signed Webhook Headers

```text
X-Client-Id
X-Timestamp
X-Nonce
X-Signature-Algorithm: HMAC-SHA256
X-Signature
```

### .NET Verification Pattern

```csharp
// CORRECT — constant-time HMAC-SHA256 verification:
public static bool VerifySignature(string payload, string receivedSignature, byte[] signingKey)
{
    var payloadBytes = Encoding.UTF8.GetBytes(payload);
    using var hmac = new HMACSHA256(signingKey);
    var computedHash = hmac.ComputeHash(payloadBytes);
    var computedSignature = Convert.ToHexString(computedHash).ToLower();

    // MUST use constant-time comparison — never string.Equals or ==:
    return CryptographicOperations.FixedTimeEquals(
        Encoding.UTF8.GetBytes(computedSignature),
        Encoding.UTF8.GetBytes(receivedSignature)
    );
}
```

---

## Digital Signatures

Use digital signatures where asymmetric trust is required.

### Approved Algorithms

| Use Case | Approved Algorithm |
|---|---|
| JWT signing | RS256, PS256, or ES256 |
| Document / package signing | RSA-2048 minimum or ECDSA P-256+ |
| High-security signing | RSA-3072+ or ECDSA P-384 |

### Mandatory Rules

- **Do NOT use `alg=none` for JWT — ever.**
- Do NOT accept token algorithm from an untrusted source without explicit validation.
- Validate: issuer, audience, expiry, not-before, and signature on every JWT.
- Rotate signing keys — plan rotation before go-live.
- Publish public keys through JWKS endpoint where applicable.
- Store private keys **only in key vault / certificate store / HSM** — never in source code or DB.

---

## TLS and Certificate Rules

- TLS 1.2 minimum. TLS 1.3 preferred.
- Disable SSL, TLS 1.0, and TLS 1.1 explicitly.
- Disable weak cipher suites.
- Use trusted CA-issued certificates in production (no self-signed in PROD).
- Monitor certificate expiry — alert at 30 days, 14 days, and 7 days remaining.
- Renew certificates before expiry.
- Use HSTS for web applications.
- Use mTLS for high-security service-to-service or partner integrations where required.

### Certificate Private Key Rules

- Must NOT be committed to source control.
- Must NOT be emailed.
- Must NOT be stored in shared folders without encryption.
- Must be stored in key vault, certificate store, or HSM.
- Must be access-controlled and audited.

---

## Key Management and Key Versioning

Every encrypted record must be traceable to a key version. This is what makes key rotation possible.

### What the Application DB May Store

```text
KeyReference       — name/path pointing to the key in the vault
KeyVersion         — version label (e.g. "v3")
Algorithm          — "AES-256-GCM"
CreatedAtUtc       — when this key version was created
RotationDueDate    — when it should be rotated next
Status             — ACTIVE | RETIRED | COMPROMISED
```

**The actual key material must NEVER be stored in the application DB — only in approved secret storage.**

### Approved Secret Storage Locations

- Azure Key Vault
- AWS KMS / Secrets Manager
- Google Cloud KMS / Secret Manager
- HashiCorp Vault
- HSM (for highest-security environments)
- Approved enterprise secret manager

### Key Separation Rules

- Separate keys by environment (DEV / QA / UAT / PROD).
- Separate keys by purpose (field encryption vs file encryption vs signing).
- Separate keys by tenant where required by contract or risk level.
- Maintain old key versions for decryption until all data is re-encrypted or retention ends.
- Disable compromised keys immediately.

---

## Key Rotation Rules

Every key must have a documented rotation plan before go-live. Store this metadata:

```text
KeyName
Purpose
Environment
Owner
CreatedAtUtc
ExpiryDate
RotationFrequency
LastRotatedAtUtc
NextRotationDueAtUtc
SecretReference
CurrentVersion
Status
```

### Rotation Process (Follow This Order)

1. Generate new key version in secret manager.
2. Deploy new key reference to application config.
3. Encrypt new data with new key version.
4. Decrypt old data using old key version (tracked via stored KeyVersion).
5. Re-encrypt old data with new key if required by policy.
6. Validate application behavior with both old and new key versions.
7. Disable old key version only after safe migration is confirmed.
8. Keep full audit trail of rotation event.

> ⚠️ Loss of an encryption key may mean permanent data loss. Backup and DR plans MUST include key recovery steps.

---

## Audit Hash Chain (Tamper-Evidence Pattern)

For high-assurance audit logs, implement hash chaining:

```text
AuditId
EventPayloadHash      — SHA-256 hash of the current event payload
PreviousEventHash     — SHA-256 hash of the immediately preceding audit event
HashAlgorithm         — "SHA-256"
CreatedAtUtc
```

This allows detection of any tampering or deletion of individual audit records.

---

## Prohibited Algorithms and Practices

❌ NEVER use any of the following:

| Prohibited | Reason |
|---|---|
| MD5 | Cryptographically broken |
| SHA-1 | Cryptographically broken |
| DES | Key too short, broken |
| 3DES | Slow, vulnerable to SWEET32 |
| RC4 | Broken stream cipher |
| AES-ECB | No IV, identical blocks produce identical ciphertext |
| Custom encryption | Not reviewed, not trusted |
| Hardcoded encryption keys | Secret exposure risk |
| Plain SHA for passwords | No cost factor, rainbow table vulnerable |
| Reversible password encryption | If DB leaked, all passwords exposed |
| Static IV / nonce | Breaks AES-GCM security completely |
| Reused IV/nonce with same key | Breaks AES-GCM confidentiality |
| Unsigned JWTs (`alg=none`) | Trivially forgeable |
| Weak self-signed PROD certificates | No trust chain |
| Secrets in Git, appsettings, frontend code, mobile bundle | Secret exposure |

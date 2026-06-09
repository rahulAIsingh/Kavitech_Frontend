---
trigger: new_config_key, new_feature_flag
---

# 04 - Configuration and Feature Management Rules

## Golden rule

**All business behavior and tenant variability must live in configuration tables, not hardcoded source paths.**

However, **secrets are not normal configuration** and must not be stored as regular DB values.

## Configuration categories

### A. Business configuration (DB-driven)
Examples:
- module on/off
- feature flags
- screen visibility
- tenant branding
- regional settings
- time cutoffs
- workflow toggles
- approval thresholds
- notification preferences
- retry counts
- escalation rules
- data retention windows
- archive rules
- import template rules
- lookup-driven rules
- auth mode toggles
- MFA policies
- password rules
- claims mapping profiles
- default roles
- org hierarchy settings

### B. Infrastructure configuration (secure store / env driven)
Examples:
- DB connection strings
- OIDC client secrets
- signing certificates
- SMTP/API passwords
- storage access keys
- Key Vault references
- encryption master keys
- token signing keys

## Scope hierarchy

Configuration resolution should support override hierarchy like:

1. Global default
2. Deployment / environment
3. Tenant
4. Site / location / station
5. Role
6. User

Higher-priority scopes override lower scopes only where allowed by key definition.

## Mandatory config metadata

Every config key definition should include:
- ConfigKey
- Category
- DataType
- AllowedValues / validation rules
- ScopeAllowed
- IsSecretReference
- DefaultValue
- IsRequired
- IsRuntimeCached
- CacheTTL
- EffectiveDateSupport
- ChangeApprovalRequired
- Description
- OwningModule

## Mandatory runtime behavior

- Configuration must be centrally resolved through a config service.
- No direct ad-hoc DB reads for config from random feature code.
- Cache config safely with tenant-aware keys.
- Invalidate cache when config changes.
- Maintain config history and audit trail.
- Support future-dated config activation where required.

## Feature flag rules

Feature flags must support:
- tenant enablement
- phased rollout
- start/end dates
- user/role pilot groups
- kill switch
- dependency rules
- audit trail
- rollout notes

## Auth and MFA example configs

The database must be able to represent:
- login mode = Local / OIDC / AD / Hybrid
- SSO enabled = true/false
- MFA enabled = true/false
- MFA provider = email / authenticator / external IdP policy
- password expiry days
- lockout threshold
- session timeout
- idle timeout
- remember-me allowed
- JIT provisioning allowed
- automatic role mapping allowed
- role mapping profile id
- claims mapping profile id

## Secret handling rule

DB can store:
- secret reference name
- vault URI reference
- certificate thumbprint reference
- key alias
- provider identifier

DB must not store:
- raw client secrets
- raw signing keys
- raw encryption master keys
- permanent admin default passwords

## Startup bootstrap minimum

A system that says "everything from DB only" still requires a **minimal bootstrap path** to reach the database and secret store.

Minimum bootstrap inputs allowed outside DB:
- environment name
- application identity
- DB connection bootstrap reference
- secret store reference
- telemetry endpoint reference

These must be environment-managed, not code-hardcoded.

## Required tables (recommended)

- cfg.ConfigCategory
- cfg.ConfigKey
- cfg.ConfigValue
- cfg.ConfigValueHistory
- cfg.FeatureFlag
- cfg.FeatureFlagAssignment
- cfg.AuthProvider
- cfg.ClaimsMappingProfile
- cfg.PasswordPolicy
- cfg.SessionPolicy
- cfg.MfaPolicy
- cfg.BrandingProfile
- cfg.RegionalSettings
- cfg.RetentionPolicy
- cfg.ArchivePolicy
- cfg.NotificationPreference
- cfg.IntegrationEndpoint
- cfg.SecretReference

## Review gate

Reject implementation if:
- a tenant-specific rule is hardcoded
- a secret is stored as plain DB config
- a business threshold is hidden in code
- feature enablement requires redeploy when it should be config-driven

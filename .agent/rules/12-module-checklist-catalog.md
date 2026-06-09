---
trigger: new_module
---

# 12 - Module Checklist Catalog

> AI ASSISTANT: Load this file ONLY when creating a new module (generic or business).
> Fill in the Module Contract template BEFORE writing any code.
> Do not generate any module code until the contract below is completed.

---

## Module Contract Template (Fill Before Writing Code)

```
== MODULE CONTRACT ==

Module Name:          [e.g. Orders, BudgetManagement, HRLeave]
Owner Team:           [team responsible]
Module Type:          [Generic Infrastructure | Business Domain]

PURPOSE:
[One paragraph describing what this module manages and its boundaries]

ENTITIES (DB Tables Owned):
- [schema.TableName] — purpose
- [schema.TableName] — purpose

MASTER DATA DEPENDENCIES:
- [ref.TableName] — used for lookup
- [ref.TableName] — used for lookup

PERMISSION KEYS: (format: module.entity.action)
- [module].[entity].view
- [module].[entity].create
- [module].[entity].edit
- [module].[entity].delete
- [module].[entity].export     (if applicable)
- [module].[entity].import     (if applicable)
- [module].[entity].approve    (if workflow exists)

CONFIG KEYS: (format: MODULE_SETTING_NAME)
- [KEY_NAME] — description, scope (GLOBAL|TENANT), data type, default

API ENDPOINTS:
- GET    /api/v1/[module]               — paginated list
- GET    /api/v1/[module]/{id}          — single record
- POST   /api/v1/[module]               — create
- PUT    /api/v1/[module]/{id}          — update
- DELETE /api/v1/[module]/{id}          — soft delete
- POST   /api/v1/[module]/import        — bulk import (if Tier 3 master)
- GET    /api/v1/[module]/export        — async export (if Tier 3 master)

UI SCREENS:
- [ModuleName] List screen (search, filter, sort, paginate)
- [ModuleName] Create/Edit form
- [ModuleName] Detail/View screen
- [ModuleName] Import screen (if applicable)

WORKFLOW STATES: (if applicable)
- Draft → Submitted → Approved → Rejected → Archived

AUDIT EVENTS:
- [ENTITY].CREATED
- [ENTITY].UPDATED
- [ENTITY].DELETED
- [ENTITY].ARCHIVED
- [ENTITY].IMPORTED (if import exists)
- [ENTITY].EXPORTED (if export exists)

BACKGROUND JOBS: (if applicable)
- [description, trigger, retry policy, compensating action]

RETENTION / PRIVACY IMPACT:
- Contains PII: YES / NO
- If YES: which fields, retention window, anonymization plan

DATA TAXONOMY TIER (from Rule 01):
- Tier 1 (Seed/Lookup) | Tier 2 (Reference Master) | Tier 3 (Operational Master)

TESTS REQUIRED:
- Unit: [list business rules to test]
- Integration: [list API scenarios to test]
- Security: [tenant isolation test, permission denied test]

FEATURE FLAG:
- Flag Code: [MODULE]_ENABLED
- Default: OFF (enable only after all permission/config/audit verified)

RELEASE NOTES ENTRY:
[One line summary for the changelog]
== END CONTRACT ==
```

---

## Generic Module Quick Reference

Use the table below to look up what is required for each standard generic module:

| Module | Tier A Required | Entities (min) | Notes |
|---|---|---|---|
| Identity & Auth | ✅ YES | auth.User, auth.UserCredential, auth.RefreshToken | See Rule 03 |
| Authorization / RBAC | ✅ YES | auth.Role, auth.Permission, auth.RolePermission, auth.UserRole | See Rule 03 |
| Multi-Tenancy | ✅ YES | auth.Tenant, auth.TenantDomain | See Rule 03 |
| Error Handling | ✅ YES | (middleware only) | See Rule 06 |
| Logging/Monitoring | ✅ YES | (structured logging only) | See Rule 09 |
| User Management | Tier B | auth.UserProfile, auth.UserTenant | Add when first feature needs users |
| Audit | Tier B | audit.AuditEvent | Add when first mutation endpoint exists |
| Notifications | Tier B | notification.* | Add when first notification use case exists |
| Background Jobs | Tier B | job.ExecutionLog | Add when first async job exists |
| Configuration | Tier B | cfg.* | Add when first tenant-variable config needed |
| GDPR/Retention | Tier C | (policies + anonymization jobs) | Add when compliance confirmed |
| File Management | Tier C | file.* | Add when file upload is a feature |
| Org Structure | Tier C | org.* | Add when org hierarchy is a domain requirement |
| Import/Export | Tier C | (import pipeline) | Add when first Tier 3 master needs it |
| Admin Console | Tier C | (admin screens) | Add when ops team needs visibility |

---

## Module Completion Checklist

A new module is **not done** unless it has:

- [ ] Module contract filled and confirmed before code was written
- [ ] All entities/tables with mandatory columns (Rule 05)
- [ ] EF global query filter for TenantId and IsDeleted
- [ ] All API endpoints with versioning, auth, pagination (Rule 06)
- [ ] Permission keys defined and enforced in all three layers (UI, API, Service)
- [ ] Config keys defined in cfg.ConfigKey table (Rule 04)
- [ ] All audit events written for every mutation (Rule 09)
- [ ] Feature flag: MODULE_ENABLED = off by default
- [ ] Seed/lookup data migration or script
- [ ] Unit tests for business rules
- [ ] Integration tests for tenant isolation and permission enforcement
- [ ] Release notes entry
- [ ] Architecture docs updated if new patterns introduced

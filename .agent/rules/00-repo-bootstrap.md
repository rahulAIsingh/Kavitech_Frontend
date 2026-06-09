---
trigger: new_project
---

# 00 - Repository Bootstrap Rules

## Objective

When a new project repository is created, the first goal is **not** to jump directly into business screens.
The first goal is to establish the mandatory enterprise foundation so that future modules are built on a compliant base.

> AI ASSISTANT: Read `00-trigger-map.md` first. Load this file only when starting a brand-new project.

---

## Mandatory Bootstrap Order

### Phase 1 — Rules and Structure
- [ ] Copy the full rules pack into `.agent/rules/`
- [ ] Add `.agent/rules/project-overrides.md` if project-specific deviation is required
- [ ] Create initial solution/repo folder structure (see Minimum Repo Structure below)
- [ ] Create database project / migration strategy
- [ ] Create CI/CD skeleton
- [ ] Create observability skeleton
- [ ] Create initial seed and lookup strategy

### Phase 2 — Core Generic Modules (Tiered Order)

**AI ASSISTANT**: Use the tier classification below. Do NOT scaffold Tier B or C modules until Tier A is complete AND a business feature actually requires that module.

#### Tier A — Always scaffold BEFORE any feature work (no exception)
- [ ] Identity & Authentication
- [ ] Authorization / RBAC
- [ ] Multi-Tenancy Management
- [ ] Error Handling (global exception middleware, error response standard)
- [ ] Logging & Monitoring (structured logging, correlation ID, health checks)

#### Tier B — Scaffold when the FIRST feature that needs it is planned
- [ ] User Management
- [ ] Audit Logging & Activity History
- [ ] Notifications & Alerts
- [ ] Background Jobs / Scheduler
- [ ] Configuration & Feature Management

#### Tier C — Scaffold ONLY when a confirmed compliance or domain requirement exists
- [ ] GDPR / Privacy / Retention / Archiving
- [ ] File / Document Management
- [ ] Organization Structure
- [ ] Import / Export Framework
- [ ] Admin Console / Supportability
- [ ] Master Data Framework (when domain masters are identified)

### Phase 3 — Technical Skeleton (complete after Tier A modules)
- [ ] Authentication middleware / handlers
- [ ] Tenant resolution middleware (hostname → TenantId → auth mode)
- [ ] Permission evaluation framework
- [ ] Standard API response and error contracts (`ApiResponse<T>` and `ApiError`)
- [ ] EF Core DbContext baseline with tenant global query filters
- [ ] Audit interception / activity capture
- [ ] Config resolution service with tenant-aware caching
- [ ] Background job host
- [ ] File storage abstraction (when Tier C File module is needed)
- [ ] Notification abstraction (when Tier B Notification module is needed)
- [ ] Health check endpoints
- [ ] Structured logging / correlation IDs

### Phase 4 — Developer Safety Rails
- [ ] Linting / formatting
- [ ] Static analysis
- [ ] Unit test project
- [ ] Integration test project
- [ ] Security scan hooks
- [ ] Branch policy
- [ ] PR template
- [ ] Release checklist

---

## Minimum Repo Structure

```text
/src
  /BuildingBlocks
    /Application
    /Domain
    /Infrastructure
    /SharedKernel
  /Modules
    /Auth
    /Admin
    /Config
    /Audit
    /Notification
    /Files
    /Jobs
    /ReferenceData
    /<BusinessModules...>
  /Web
  /Mobile            # optional per project
/database
  /schema
  /programmable
  /seed
  /release
/tests
  /UnitTests
  /IntegrationTests
  /ApiTests
/docs
  /rules
  /architecture
  /release-notes
```

---

## AI Assistant Instructions

Any AI coding assistant operating inside the repository must follow this sequence:

1. Read `00-trigger-map.md` first
2. Read `project-overrides.md` if present
3. Confirm Tier A modules are complete before touching Tier B or C
4. Confirm Tier B/C modules are actually needed before scaffolding them
5. For every new module, also create:
   - API contract
   - Permission keys (format: `module.entity.action`)
   - Config keys (format: `MODULE_SETTING_NAME`)
   - Seed / lookup requirements
   - Migration changes
   - Audit events
   - Tests (at minimum one unit test for core business logic)
   - Release notes entry
6. **Never** hardcode: tenant behavior, auth modes, permission mappings, SMTP settings, branding, workflow states, or environment secrets

---

## Bootstrap Deliverables (must exist before major feature work)

- [ ] Architecture decision note (modular monolith vs service, reasoning)
- [ ] Tenant isolation decision (shared DB + TenantId is the default starting point)
- [ ] Authentication decision (Local / OIDC / AD / Hybrid)
- [ ] Configuration catalog (which settings are DB-driven vs env-driven vs secret-store)
- [ ] Permission model (role catalog, permission key naming convention)
- [ ] Audit event matrix (which actions generate audit records)
- [ ] Data classification / PII inventory
- [ ] Retention / archiving note
- [ ] Logging / monitoring note
- [ ] Release and rollback note

---

## Hard Stop Conditions

Business module development must pause if any of the below are unresolved:

- Tenant isolation approach unclear
- Login mode unclear
- Secrets handling unclear (where are they stored?)
- Audit approach missing
- Permission model missing
- No configuration ownership model
- No migration strategy
- No rollback approach
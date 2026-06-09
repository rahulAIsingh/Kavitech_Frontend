---
trigger: new_project, new_module
---

# 02 - Solution Architecture Rules

## Default house approach

Unless there is a strong reason otherwise, start with a **modular monolith** that is:
- domain-partitioned
- event-ready
- API-first
- integration-ready
- microservice-separable later

This avoids premature distribution while preserving future split options.

## Architecture layers

### Presentation
- Web UI (React)
- Mobile UI (React Native) where applicable
- Public/internal API surface

### Application
- use cases / handlers
- orchestration
- validation
- permission checks
- DTO mapping
- transaction coordination

### Domain
- entities
- value objects
- domain services
- domain rules
- domain events

### Infrastructure
- EF Core
- SQL Server access
- background jobs
- external integrations
- file storage
- cache
- messaging
- email/SMS/push
- secrets retrieval
- telemetry

## Module boundary rules

Each module should own:
- its use cases
- its DB objects
- its permission keys
- its config keys
- its events
- its UI routes/screens
- its tests

Cross-module access should happen through:
- application services
- integration events
- explicit query interfaces
- shared kernel contracts only where justified

## Shared building blocks

Use shared libraries only for:
- tenant context
- auth primitives
- permission evaluation
- audit primitives
- config resolution
- common exceptions
- logging/correlation
- result/error contracts
- file abstractions
- job abstractions

Do not put business-specific logic in shared layers.

## Tenant resolution pattern

Tenant resolution must be explicit and consistent. Acceptable sources:
- subdomain
- mapped host header
- JWT claims
- user-tenant mapping
- request header from trusted gateway
- selected tenant context after secure authentication

Not acceptable:
- query string tenant switching for normal operations
- UI-only tenant filtering with no backend enforcement
- trusting client-provided tenant identifiers without validation

## Eventing rules

Use domain or integration events for:
- audit publication
- notifications
- workflow transitions
- import completion
- archive / purge actions
- sync callbacks
- alert triggers

Use asynchronous processing for:
- bulk imports
- report generation
- notifications fan-out
- archival
- purge jobs
- large exports
- long-running integration calls

## Reporting architecture

- Operational transactions must not be degraded by reporting-heavy queries.
- Use separate read models, materialized views, staging tables, or reporting databases where needed.
- Reporting logic must remain timezone-aware and tenant-scoped.

## File/document architecture

Store file binaries in object storage / managed file storage where possible.
Database should store:
- metadata
- owner record reference
- checksum
- content type
- logical document type
- retention category
- storage pointer
- tenant segregation metadata

## Environment architecture expectations

Each environment must have:
- isolated configuration
- secret separation
- traceability
- backup awareness
- health monitoring
- deployment identity
- rollback path

## Architecture review gate

No project should move into heavy feature delivery unless these are explicitly decided:
- auth pattern
- tenant isolation model
- config model
- data retention model
- file storage model
- integration model
- reporting segregation model
- job scheduler model
- monitoring model
- release / rollback model

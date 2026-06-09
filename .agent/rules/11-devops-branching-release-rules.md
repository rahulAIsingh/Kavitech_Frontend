---
trigger: release, before_deploy
---

# 11 - DevOps, Branching, and Release Rules

> AI ASSISTANT: Load this file when preparing a release, a branch strategy, or a deployment.

---

## Branching Conventions

| Branch | Purpose |
|---|---|
| `main` | Production-aligned trunk. Protected. Requires PR + review. |
| `feature/<short-name>` | Feature work. Branch from `main`. Merge via PR. |
| `bugfix/<short-name>` | Bug fix (non-critical). Branch from `main`. |
| `hotfix/<short-name>` | Critical production fix. Branch from `main`, merge to `main` immediately. |
| `release/<version>` | Release candidate stabilization if needed. |

**Keep branches short-lived. Feature branches older than 5 days should be reviewed for scope creep.**

---

## Commit Rules

Every meaningful commit must be:
- Scoped to one coherent change (no "fixed everything" commits)
- Linked to task/work item ID in commit message
- Free of generated secrets, credentials, or test data
- Named descriptively: `feat(orders): add pagination to invoice list`

---

## Pull Request Requirements

Every PR description MUST include:

```markdown
## What changed
[Brief description]

## Why it changed
[Reason / task link]

## Cross-cutting impact
- DB impact: [migration included? Y/N — describe change]
- Config impact: [new config keys? Y/N — list them]
- Permission impact: [new permission keys? Y/N — list them]
- Audit impact: [new audit events? Y/N — list them]
- Security impact: [any security-sensitive change? Y/N — describe]

## Migration / rollback notes
[Can be rolled back? How?]

## Test evidence
[Screenshots, test run output, or manual test steps]
```

---

## Release Artifact Requirements

A release must be identifiable by:

```yaml
app_version: "1.4.2"
db_migration_level: "20260415_AddOrderPagination"
feature_flags_state: "EXPORT_V2=off, NEW_DASHBOARD=tenant-pilot"
environment: "production"
deployed_at_utc: "2026-04-16T05:00:00Z"
deployed_by: "release-pipeline / approver-name"
rollback_reference: "1.4.1 artifact on release/1.4.1 branch"
```

---

## Environment Rules

| Rule | Requirement |
|---|---|
| Secrets | Each environment has its own isolated secret store entries |
| Config | Environment differences managed via appsettings.{env}.json or env variables |
| Manual changes | Manual PROD changes are emergency-only and must be documented with rollback |
| DB | No unreviewed schema changes in PROD — use approved migration artifacts only |

---

## Pre-Deployment Hard Blockers (ALL must be YES before PROD deploy)

- [ ] Backup confirmed and tested for this environment
- [ ] Rollback path tested or reviewed with estimated rollback time
- [ ] Migration estimated for duration and lock/contention impact
- [ ] Secrets and certificates confirmed in secret store
- [ ] Monitoring confirmed healthy (health check endpoint responding)
- [ ] Feature flags reviewed and set correctly for PROD
- [ ] No known critical/high vulnerabilities unresolved

---

## Emergency Change Rule

Emergency production fixes MUST still record:

```markdown
**Emergency Change Record**
Reason:
Approver:
Deployed Artifact/Version:
Impacted Modules:
Rollback Path:
Retrospective Date: [within 5 business days]
```

---

## Observability at Deployment

Every deployment must emit on startup:
```csharp
_logger.LogInformation("Application starting. Version={Version}, Environment={Env}, DB={DbMigration}",
    AppVersion, EnvironmentName, CurrentDbMigration);
```

And confirm:
- Migration level logged
- Health check endpoint returns HTTP 200 within 30 seconds of start
- Critical dependency status logged (DB, secret store)

---

## Deployment Target Security Requirements

### Azure Deployments

- Use **Managed Identity** wherever possible to avoid credential management.
- Reference secrets from **Azure Key Vault** only — never inject into appsettings.
- Enforce **HTTPS-only** on App Service / API Management (disable HTTP).
- Restrict **SQL Server firewall** to application service IPs only — no public access.
- Enable **TDE** and **automated backups** on Azure SQL.
- Use **private endpoints** for storage and DB access where required by security posture.
- Enable **Azure Monitor** and **Application Insights** diagnostics and alerting.
- Configure **Key Vault soft-delete and purge protection** to prevent accidental key loss.

### VM / IIS Deployments

- Harden the operating system before deployment (disable unused services and features).
- Apply OS patches and security updates on a defined schedule.
- Disable all unused ports at the firewall and OS level.
- Configure **HTTPS binding only** in IIS — no HTTP bindings in production.
- Disable **directory browsing** in IIS.
- Run the application under a **least-privilege app pool identity** (not SYSTEM or Administrator).
- Restrict **RDP / SSH access** to approved IP ranges or VPN only — never open to the internet.
- Store secrets and connection strings **outside the web root** — not in `web.config` value fields.
- Enable backup and monitoring before go-live.

### Client-Hosted / On-Premise Deployments

For deployments where the client owns the infrastructure, define and document the responsibility split before go-live:

| Responsibility | Owner |
|---|---|
| SSL certificate renewal | Client / Project team |
| DNS management | Client / Project team |
| Firewall rules | Client |
| OS / server patching | Client |
| DB backup | Client / Project team |
| File storage backup | Client / Project team |
| Encryption key management | Client (with guidance from Project team) |
| User provisioning | Client |
| SSO / MFA configuration | Client / Project team |
| VAPT coordination | Project team + Client approval |
| Monitoring and alerting | Client / Project team |
| Incident escalation process | Agreed jointly before go-live |

---

## Client Credential Handover Rules

When handing over production access credentials or API keys to a client:

### Allowed Handover Channels Only

✅ Allowed:
- Secret manager invitation (e.g. Azure Key Vault access policy, AWS IAM)
- Secure password vault share (e.g. 1Password, Bitwarden Business)
- Encrypted handover file + password delivered via a **separate** secure channel
- Client-approved secure credential vault

❌ Never allowed:
- Plain email (even password-protected attachments are a risk)
- Teams or Slack chat message
- Word / Excel file with plaintext credentials
- Screenshot of credentials
- Repository commit or PR comment
- Shared document with public link

### What to Include in Client Handover Package

- Environment URLs (DEV, QA, UAT, PROD separately)
- Allowed user roles and access levels
- Admin account creation approach and first-login steps
- SSO / MFA configuration details
- API documentation and authentication flow (if applicable)
- Support escalation matrix and SLA
- Password reset process
- Data retention summary
- Backup / DR summary (what is backed up, how often, RTO/RPO)
- Known security responsibilities split (see client-hosted table above if applicable)

# GMT Hub Foundation Spec v1

Status: Draft for execution
Owner: Rafael (Mountain Investments, uSource, Meltel Consulting, Onyx Meridian)
Program: GMT Capital Group Master Hub

## 1) Purpose
Build a centralized control hub for GMT Capital Group that provides real-time visibility, operational control, and auditable financial reporting across subsidiaries/investments.

## 2) Scope (Current vs Future)

### Current build scope (Rafael-owned)
- Mountain Investments
- uSource
- Meltel Consulting
- Onyx Meridian

### Future expansion scope
- Ambassador Services
- Additional GMT entities/investments after approval

## 3) Core Principles
1. Segregation by default: business domains are isolated; no cross-tenant data leakage.
2. Ledger-first finance: money-impacting events recorded immutably and derived into balances/reports.
3. Approval controls: maker/checker for disbursements, adjustments, write-offs, and high-risk changes.
4. Auditability: every critical action has actor, timestamp, reason, before/after.
5. Migration-ready: infra and data model designed for later transfer to GMT servers.

## 4) Target Entity Model (Hierarchy)
- GMT Capital Group (parent)
  - Mountain Investments
    - Child entities (international modules)
  - uSource
  - Meltel Consulting
  - Onyx Meridian
  - (Future) Ambassador Services

### Required entity dimensions
- legal entity name / short code
- jurisdiction / tax class
- controlling owner and operator
- status (active/inactive/winding down)
- reporting currency + fx source
- data owner + access policy

## 5) Functional Modules

### A) Entity Management
- Entity registry and parent-child relationships
- Operating metadata (jurisdiction, counsel, key officers)
- Infrastructure profile per entity (systems, bank rails, counterparties)
- Activity monitor (events, exceptions, policy breaches)

### B) Consolidated Financial Reporting
- Group-level and entity-level dashboards
- Equity position and ownership rollups
- Capital deployment tracking (committed, deployed, available)
- Risk exposure views (counterparty, concentration, delinquency, liquidity)
- Drill-down to transaction and audit trail

### C) Mountain Investments Platform (initial modules)
Module 1: Entity & Structure Manager
- international child entity setup and governance metadata

Module 2: Capital Deployment & Exposure
- investment allocation, deployment lifecycle, exposure by geography/entity

Module 3: Performance & Risk Monitor
- KPI trends, exception alerts, risk scoring and watchlist

### D) Loan/Servicing Operations (from current repo track)
- application -> underwriting -> approval/denial -> funding
- borrowing base + line draws
- payment posting, waterfall, delinquency, late fees, statements

## 6) Data Inputs and Integration Points

### Priority data sources
- Loan servicing database (Supabase/Postgres)
- Banking/payment records (manual import + API connectors)
- Borrowing base certificates + collateral files
- Accounting exports (CSV/API)
- Entity metadata/documents (Google Drive initially)

### Integration contracts (v1)
- Ingestion jobs produce normalized records + ingestion audit logs
- Validation layer for schema and business rules
- Idempotency keys on all ingest + posting endpoints
- Dead-letter queue for malformed financial events

## 7) Security, Access, and Confidentiality
- RBAC roles: super_admin, finance_ops, servicing_ops, analyst, auditor, read_only
- Entity-scoped permissions (user can be limited to one or many entities)
- Sensitive actions require approval + reason codes
- Encryption at rest/in transit
- Session and access logging with anomaly alerts

### Hard boundary requirement
- JohnnyBucks/personal systems must remain physically and logically separate from GMT hub workloads/data.
- No mixed schemas, no shared credentials, no shared storage buckets.

## 8) Key Metrics (Minimum Reporting Pack)

### Group level
- NAV / total equity
- deployed vs undeployed capital
- portfolio concentration by entity/sector/region
- delinquency ratio / loss ratio / recovery ratio
- liquidity runway

### Entity level
- revenue, opex, margin
- cash in/out, working capital
- active exposures and risk flags
- covenant/threshold breaches

### Operations level
- approval SLA
- pending queue age
- failed ingest/posting counts
- reconciliation variance

## 9) Migration-to-GMT Server Readiness
Design now for eventual move:
- environment manifests (dev/stage/prod)
- secrets inventory and rotation plan
- data export/import playbooks
- migration runbooks with rollback checkpoints
- infra-as-code templates for reproducible deployment

## 10) Phased Delivery Plan

### Phase 0 (now): Foundation and controls
- finalize domain model and permission matrix
- establish event ledger + audit scaffolding
- define segregation boundaries and naming conventions

### Phase 1: Critical operations backbone
- loan application/approval/funding controls
- approval workflows + idempotency + audit
- baseline reporting cards and exception queues

### Phase 2: Mountain platform modules
- module 1/2/3 implementation
- group ingestion and consolidation pipelines

### Phase 3: Advanced reporting and migration prep
- full board-level reporting pack
- automated reconciliation and risk alerts
- GMT server migration rehearsal

## 11) Immediate Implementation Backlog (next 2 sprints)
1. Entity table hardening + relationship constraints
2. Ledger event schema and append-only write API
3. Approval workflow engine (maker/checker)
4. Audit trail middleware for financial actions
5. Financial ops dashboard v1 (group + entity tabs)
6. Data segregation guardrails in config/DB policies

## 12) Open Decisions Needed
- Canonical accounting source of truth (system + cadence)
- FX conversion source/provider and lock timing
- Risk scoring model ownership and governance
- Statement generation format and legal review requirements

---
This v1 document is the execution contract for architecture and delivery sequencing.

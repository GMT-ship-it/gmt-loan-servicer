# FinOps Rebuild Plan v1 (Loan Servicer)

## Objective
Harden the platform for high-trust financial operations with approval controls, auditability, and deterministic servicing logic.

## Priority Workflow Stack

### Phase 1 — Application → Approval → Funding
- Unified application intake validation
- Risk decision state machine (`submitted -> reviewing -> approved|denied`)
- Exception queue for manual review
- Approval packet + decision rationale capture
- Funding request with maker/checker approval
- Disbursement ledger event + immutable audit row

### Phase 2 — Borrowing Base + LOC Draws
- Borrowing base submission form + schema validation
- Eligibility/advance-rate calculator service
- Real-time available-to-draw computation
- Draw workflow (`requested -> approved|denied -> disbursed -> settled`)
- Auto balance/availability updates from ledger events

### Phase 3 — Payments + Servicing Core
- External payment posting UI (check/wire/ACH)
- Deterministic waterfall engine (fees -> interest -> principal; configurable)
- Delinquency aging buckets + late fee policy engine
- Daily accrual + monthly statement generation pipeline
- Reconciliation exports + exception report queue

## Cross-Cutting Controls (mandatory)
- Role-based access control by operation
- Maker/checker for money-impacting actions
- Idempotency keys for posting/disbursement/payment actions
- Immutable audit log with before/after snapshots
- Domain event ledger as source of truth
- Explicit state transitions (reject invalid state changes)

## Technical Notes (initial repo findings)
- Existing Supabase migrations/functions already include servicing capabilities and interest jobs.
- Existing UI surface includes admin/borrower/loan details and PMD modules.
- Baseline build passes, but bundle size is large and should be split in later optimization pass.

## Execution Sequence
1. Contract + schema alignment for Phase 1 entities/actions.
2. Implement state-machine + audit/idempotency helpers.
3. Build/patch admin review + approval UX.
4. Add disbursement approval and posting path.
5. Validate with seeded scenarios and edge-case tests.

## Definition of Done (Phase 1)
- Every approval/funding action requires authorized role and is auditable.
- Duplicate submissions do not double-post (idempotent).
- Invalid state transitions are blocked and user-visible.
- End-to-end happy path works: apply -> review -> approve -> fund.

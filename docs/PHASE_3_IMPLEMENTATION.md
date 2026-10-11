# Phase 3 workflow engine — implementation status

This branch is stacked on `feat/phase-2-core-entities`, not on `main`. Merge Phase 1, then Phase 2, then this branch (or retarget the PR after the earlier merges).

## Implemented

- Case owner, stage and stage-entry timestamp; case history is written in the same serializable database transaction as each stage update. A compare-and-update prevents stale stage writes.
- Staff-only case listing/reads and broker/admin case creation, objective fit evaluation and transitions. Tenant/landlord roles are denied.
- Supported transitions: INQUIRY → INTAKE → VOUCHER_REVIEW → DOCUMENT_COLLECT → READY → MATCHED, `needs_info`, `voucher_invalid`, `unit_lost`, and withdrawal. Guards check stored evidence. Unsupported downstream transitions fail closed.
- Objective fit snapshots use bedroom/rent constraints. Unknown or tenant-paid utilities return NEEDS_REVIEW rather than guessing allowance. No client ranking or protected-class scoring.
- An initial SQL migration covers the current schema. It is **not applied to a database yet**.

## Not implemented / do not use with real client data

- No document ingestion, verification workflow, requirement templates, or program-specific utility schedule engine. No endpoint currently verifies checklist items, so READY cannot normally be reached. This is intentional fail-closed behavior, not a completed end-to-end placement flow.
- No showing, lease, agency-response or inspection evidence model; transitions after MATCHED are blocked.
- No privileged override endpoint: arbitrary stage jumps would bypass evidence. Add narrow exceptions only after an atomic elevated audit design and policy tests exist.
- No stall worker, ownership-reassignment sweep, or automatic tasks.
- The Phase 1 global audit interceptor logs asynchronously and can swallow failures. CaseStageHistory is transactional, but the general hash-chained AuditLog is not guaranteed atomic or tamper-proof across concurrent writers. Database INSERT-only grants are not configured.
- Existing Phase 1/2 PII is plaintext; comments in schema are not encryption. Existing authentication/session scaffolding and prior authorization e2e tests still require security review. Do not call the application production-ready.

## Verification

Run `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm typecheck`, `pnpm -r build`, and `pnpm --filter @vhp/api test -- --runInBand`. The unit tests exercise FSM and fit logic. Database integration tests and migration application need PostgreSQL and a dedicated test database; none was available on this host during development.

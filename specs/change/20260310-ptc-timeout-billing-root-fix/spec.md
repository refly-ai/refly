---
id: 20260310-ptc-timeout-billing-root-fix
name: Ptc Timeout Billing Root Fix
status: implemented
created: '2026-03-10'
---

## Overview

In PTC mode, `execute_code` can fail after a 60s timeout, while child tool calls started inside the sandbox may still finish and trigger billing. This causes user-facing issues: credits charged after timeout, repeated charges after retries, and inconsistency between tool cards and billing records.

This spec targets a root-cause fix: move PTC child-call billing from "bill on child completion" to "settle after parent terminal state". Child calls are billable only when the parent `execute_code` call ends in success. If the parent fails, times out, or is cancelled, child calls are marked as non-billable.

Scope is limited to PTC billing eligibility and settlement timing consistency. It does not change tool capabilities, model behavior, or non-PTC execution paths.

Success criteria:
- No actual credit deduction for child PTC calls when the parent call fails, times out, or is cancelled.
- No duplicate billing across retries of the same user task.
- Consistent and auditable alignment between displayed tool executions and billable calls.

## Research

- Existing System
  - PTC child calls persist to `tool_call_results` with `type='ptc'` and `ptc_call_id=<parent execute_code callId>`.
  - Child billing is triggered on child success in three places: PTC Composio path, PTC Legacy path, and dynamic post-handler path.
  - Parent `execute_code` terminal status is persisted separately by `skill-invoker` (`completed`/`failed`) and is not consulted by current billing paths.
  - `credit_usages` records child billing by `tool_call_id`, so parent-child correlation requires joining through `tool_call_results.ptc_call_id`.

- Available Approaches
  - Add parent-status gate directly in child billing path (simple, but risks under-billing successful runs if parent still executing at child completion).
  - Move all PTC child billing to parent terminal settlement (correct semantics, requires deferred payload handling).
  - Keep immediate billing and introduce compensating refunds on parent failure (higher complexity and accounting risk).

- Constraints
  - Must avoid deadlock: child request cannot wait for parent completion because parent is waiting for child response.
  - Must keep non-PTC billing behavior unchanged.
  - Must be idempotent across retries and repeated settlement attempts.
  - Prefer minimal change without schema migration for this iteration.

- Key References
  - `apps/api/src/modules/tool/ptc/tool-execution.service.ts:339`
  - `apps/api/src/modules/tool/ptc/tool-execution.service.ts:749`
  - `apps/api/src/modules/tool/handlers/post/dynamic-post.service.ts:93`
  - `apps/api/src/modules/skill/skill-invoker.service.ts:1221`
  - `apps/api/src/modules/tool/billing/billing.service.ts:345`
  - `apps/api/prisma/schema.prisma:1888`

## Design

- Architecture Overview
  - Introduce PTC-deferred settlement in `BillingService`: when a billing request is from a PTC child call (`type='ptc'` with `ptc_call_id`), do not charge immediately.
  - Persist deferred charge payload in Redis keyed by parent `execute_code` call ID.
  - On parent terminal event in `SkillInvokerService`:
    - Parent `completed` => settle deferred child charges.
    - Parent `failed` => discard deferred child charges.
  - Keep non-PTC paths unchanged.

- Flow
  ```text
  PTC child success
    -> BillingService sees child call type=ptc
    -> enqueue deferred charge under parent call id
    -> return without credit deduction

  Parent execute_code terminal
    -> if completed: BillingService settles all queued child charges (idempotent)
    -> if failed: BillingService discards queued child charges
  ```

- Implementation Steps
  1. Add deferred billing payload model and Redis queue helpers in `BillingService`.
  2. Add `settleOrDiscardDeferredPtcBilling(parentCallId, parentSucceeded)` in `BillingService`.
  3. Update `processBilling` and `processComposioBilling` to route PTC child calls to deferred queue.
  4. Wire `SkillInvokerService` parent terminal hooks for `execute_code` to call settlement/discard.
  5. Add/adjust tests for deferred behavior and idempotency.

- Pseudocode
  ```text
  processBilling/processComposioBilling:
    compute final cost
    if toolCallId belongs to ptc child with parentCallId:
      enqueue(parentCallId, chargePayload)
      return success (deferred)
    else:
      charge now

  on execute_code terminal:
    if success: settle(parentCallId)
    else: discard(parentCallId)
  ```

- Files To Modify
  - `apps/api/src/modules/tool/billing/billing.service.ts`
  - `apps/api/src/modules/tool/billing/billing.service.spec.ts`
  - `apps/api/src/modules/skill/skill-invoker.service.ts`
  - `apps/api/src/modules/skill/skill.module.ts`

- Edge Cases
  - Duplicate settlement trigger: prevent double charge via existing billing idempotency and per-entry dedupe.
  - Parent missing/unexpected state: keep deferred entries until TTL or discard safely with warning.
  - Child success after parent failure: deferred entry will be discarded on parent-failure settlement.

## Plan

- [x] Phase 1: Deferred billing infrastructure
  - [x] Add PTC-child detection and deferred payload queue in `BillingService`
  - [x] Add deferred settlement/discard entrypoints in `BillingService`
  - [x] Reuse existing accumulator/idempotency when settling deferred charges
- [x] Phase 2: Parent terminal integration
  - [x] Inject billing service into skill invoker path
  - [x] On `execute_code` success, settle deferred child charges
  - [x] On `execute_code` failure/timeout/error, discard deferred child charges
- [x] Phase 3: Testing and verification
  - [x] Skip deferred-PTC unit tests per follow-up request
  - [x] Run relevant API unit tests
  - [x] Run Refly CLI workflow on `c-ff6ssw5b44rze1y0a0dsxdsl` and verify DB billing records

## Implementation

- Files Modified
  - `apps/api/src/modules/tool/billing/billing.service.ts`
    - Added PTC child-call detection (`type='ptc'` + `ptc_call_id`) and deferred billing queueing in Redis.
    - Added `settleOrDiscardDeferredPtcBilling(parentCallId, parentSucceeded)` for parent-terminal settlement.
    - Refactored immediate charging into shared settlement logic with existing accumulator and idempotency.
    - Added DB guard (`credit_usages` lookup by `tool_call_id`) before deferred settlement charge.
  - `apps/api/src/modules/skill/skill-invoker.service.ts`
    - On `execute_code` terminal events, call deferred billing settlement/discard.
  - `apps/api/src/modules/skill/skill.module.ts`
    - Imported `BillingModule` to provide `BillingService` in `SkillModule` context.
  - `apps/api/src/modules/tool/billing/billing.service.spec.ts`
    - Removed deferred-PTC unit test cases per follow-up request.

- Testing Results
  - Unit tests passed:
    - `pnpm --filter @refly/api test -- billing.service.spec.ts`
  - CLI + DB verification passed:
    - Workflow run: `we-ggfeeh3n4nh7vhtmpjp1sfma` on `c-ff6ssw5b44rze1y0a0dsxdsl`
    - In this run, `fal` node had 6 completed PTC child calls whose parents were `failed` (timeout path), and billed count for those calls is `0`.
  - Re-verified after implementation update:
    - Workflow run: `we-nq53ghfp6m887tuvb4kostlz` on `c-ff6ssw5b44rze1y0a0dsxdsl`
    - For `ar-mlh3zmesrq41q8aipi8e8h87` version `8`, there are 4 completed PTC child calls (`fal_image.flux_text_to_image`) whose parent `execute_code` calls are `failed`, and billed count is `0`.
  - Test Records (sanitized)
    - Unit test command/result:
      - `pnpm --filter @refly/api test -- billing.service.spec.ts`
      - `1` suite passed, `19` tests passed, `0` failed.
    - Workflow run command/result:
      - `refly workflow run c-ff6ssw5b44rze1y0a0dsxdsl`
      - runId: `we-***stlz` (full: `we-nq53ghfp6m887tuvb4kostlz`).
    - DB verification (read-only SQL):
      - target result: `ar-***8h87` (full: `ar-mlh3zmesrq41q8aipi8e8h87`), `version=8`.
      - parent `execute_code` failed count: `4`.
      - child PTC (`fal_image.flux_text_to_image`) completed count: `4`.
      - billed `credit_usages` rows for those child call ids: `0`.

- Deviations
  - No schema migration was introduced; deferred payload is stored in Redis with TTL, and settlement is triggered by parent terminal events.

## Notes

<!-- Optional: Alternatives considered, open questions, etc. -->

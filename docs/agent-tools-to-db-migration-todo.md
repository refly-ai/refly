# Agent Tools -> DB Migration TODO

> **Owner:** TBD  
> **Date:** 2026-02-17  
> **Status:** Draft

## Goal

Migrate tool definitions currently maintained in `packages/agent-tools` to database-driven inventory/method records, while preserving runtime behavior and billing.

## Scope

- In scope:
  - Move non-built-in toolsets from static code to DB-backed `toolset_inventory` + `tool_methods`
  - Keep tool metadata aligned with current definitions (key/domain/labels/descriptions/tools/auth)
  - Ensure billing compatibility (Composio provider billing + dynamic tool billing + promotions)
- Out of scope:
  - Built-in tools (`builtin/*`)
  - `apify-13f` migration (explicitly excluded by product policy)

## TODO Checklist

### 1. Inventory Mapping

- [ ] Finalize source of truth list from `packages/agent-tools/src/inventory.ts`
- [ ] Classify each toolset by DB type:
  - [ ] `external_oauth` (Composio OAuth)
  - [ ] `regular` (credentials/config-based)
- [ ] Confirm migration candidate keys (exclude `apify-13f`)
- [ ] Confirm naming normalization (`packages/agent-tools`, not `packages/agent-tool`)

### 2. DB Schema / Constraints

- [ ] Verify `toolset_inventory` fields fully cover required metadata
- [ ] Verify `tool_methods` supports all method-level descriptions
- [ ] Add/verify provider billing table migration (`tool_provider_billing`)
- [ ] Add/verify promotion table migration (`tool_billing_promotion`)
- [ ] Ensure unique/active constraints are present:
  - [ ] unique inventory key
  - [ ] one active provider billing row per provider

### 3. Data Migration SQL

- [ ] Create migration SQL to upsert toolsets into `toolset_inventory`
- [ ] Create migration SQL to upsert methods into `tool_methods`
- [ ] Backfill `credit_billing` defaults for `external_oauth` toolsets (`_default: standard`)
- [ ] Seed baseline `tool_provider_billing` for Composio plan
- [ ] Add idempotent `ON CONFLICT` behavior for all inserts
- [ ] Add rollback-safe transaction boundaries (`BEGIN/COMMIT`)

### 4. Service Layer Changes

- [ ] Ensure `ToolInventoryService` loads from DB first-class and merges safely
- [ ] Ensure auth pattern generation from DB `type` remains correct
- [ ] Ensure tool instantiation logic still works for:
  - [ ] SDK-backed regular tools
  - [ ] Composio OAuth tools (class may be undefined, runtime via Composio)
- [ ] Remove any hardcoded assumptions that static inventory is complete

### 5. Billing Integration

- [ ] Ensure Composio billing uses provider rates + tier map (standard/premium)
- [ ] Ensure discounts apply before charge accumulation
- [ ] Ensure promotion rules apply to both:
  - [ ] Composio (`provider_key`/`toolset_key`)
  - [ ] Dynamic tools (`inventory_key`)
- [ ] Keep backward compatibility for existing free/legacy paths during transition

### 6. Validation / Tests

- [ ] Add unit tests for inventory parsing and auth pattern generation
- [ ] Add unit tests for billing path selection (legacy vs provider-based)
- [ ] Add integration tests for representative toolsets:
  - [ ] one `external_oauth` toolset (e.g. twitter)
  - [ ] one `regular` credentials toolset (e.g. perplexity/jina)
- [ ] Verify no regression in tool listing APIs (`listInventoryKeys`, CLI list)
- [ ] Verify idempotent rerun of migration SQL

### 7. Rollout Plan

- [ ] Stage rollout behind feature flag (read-from-db strict mode)
- [ ] Deploy migration to staging, run smoke tests
- [ ] Compare pre/post inventory outputs for parity
- [ ] Enable in production with monitoring
- [ ] Keep quick rollback switch (fallback to static merge path)

### 8. Observability / Ops

- [ ] Add logs for missing inventory key/method mismatches
- [ ] Add metrics for DB-backed toolset load counts and failures
- [ ] Add alert for missing active provider billing config
- [ ] Add migration runbook for plan updates and promotion changes

## Acceptance Criteria

- Tool discovery and execution behavior is unchanged for migrated toolsets.
- No hardcoded static-only dependency remains for migrated inventory.
- Billing amounts are correct for standard/premium + discount scenarios.
- Migration scripts are idempotent and safe to re-run.
- Production rollout can be toggled/rolled back without downtime.


---
id: 20260228-auto-model-routing-provider-item-upgrade
name: Auto Model Routing Provider Item Upgrade
status: implemented
created: '2026-02-28'
---

## Overview

When upgrading A to B in the production environment, the `modelId`/`name` in the same `provider_items` record was modified directly. Subsequently, Copilot's Auto routing failed to match the expected rules for a period of time, degrading to a fallback and defaulting to `C`.

Observed phenomena:
- Routing results showed three stages over time: `rule_based(A)` -> `fallback_first_available(C)` -> `rule_based(B)`.
- In affected requests, the original model was Auto, and the fallback stage failed to hit Copilot's default rules.
- After adjusting the Copilot default model configuration from "by modelId" to "by provider item id", routing returned to normal.

Core Issue: The production environment continuously upgrades model versions, and the `modelId` of the same `provider_item` may change periodically. When Auto routing rules or default configurations have a hard binding to `modelId`, rule mismatches and unexpected fallbacks can easily occur during the upgrade window.

## Research

Reference spec: `specs/current/auto-model/AUTO_MODEL.md`

### Existing System

**ModelMap construction** (`auto-model-router.service.ts:664-677`):
- `buildModelMap()` indexes available LLM items keyed by `config.modelId` only
- Excludes reasoning models (`capabilities.reasoning === true`)
- No `itemId` indexing — map cannot look up by `provider_items.item_id`

**Rule target schema** (`auto-model-router.service.ts:55-67`, `RoutingTarget` interface):
- `model?: string` — fixed routing to a single model, looked up via `modelMap.get(target.model)`
- `models?: string[]` — random selection from array, each entry looked up via `modelMap.get(modelId)`
- `weights?: Array<{ model: string; weight: number }>` — weighted random, each `.model` looked up via `modelMap.get(model)`
- All three field types contain `modelId` values (not `itemId`)

**Target resolution** (`auto-model-router.service.ts:277-298`, `selectModelFromTarget()`):
- All lookups: `modelMap.get(target.model)` — pure `modelId` lookup, returns `null` if `modelId` changed

**Default model resolution** (`provider.service.ts:1129-1136`, `findDefaultProviderItem()`):
- Global env-var default already supports **dual lookup**: `item.itemId === globalModelId || config.modelId === globalModelId`
- User preference–based default uses `itemId` only (from stored preferences)
- Admin override uses `itemId` only

**Rule cache** (`auto-model-router.service.ts:313-535`, `RuleCache` class):
- In-memory cache keyed by scene, 5-minute TTL, 3-minute background refresh
- Development mode (`NODE_ENV=development`) bypasses cache

**Routing result persistence** (`auto-model-router.service.ts:800-825`):
- Records `selected_item_id` and `selected_model_id` separately — `itemId` is already tracked

### Available Approaches

- **Approach A — Dual-index the model map**: Update `buildModelMap()` to also index each item by `item.itemId` in addition to `config.modelId`. No schema change; existing `model`/`models`/`weights` fields in rules can store either a `modelId` or an `itemId`, and both will resolve correctly.

- **Approach B — Add explicit `itemId` fields to `RoutingTarget`**: Extend the interface with separate `itemId`, `itemIds`, `itemWeights` fields. Update `selectModelFromTarget()` to check new fields first. New rules use item IDs; old rules with `model`/`models`/`weights` (modelId-based) remain supported unchanged.

- **Approach C — Semantic dual-lookup in `selectModelFromTarget()`**: Keep `RoutingTarget` unchanged; update all `modelMap.get(id)` calls to check both maps (one by `modelId`, one by `itemId`) in sequence. Same effective behavior as A but without changing map construction.

- **Approach D — DB migration**: Migrate all existing rule targets from `modelId` values to `itemId` values. Update code to build and use an `itemId`-only map. Requires coordination across DB data and code; breaks rules that reference models without `itemId`.

### Constraints

- **Backward compatibility**: Existing rules in production store `modelId` values in the `target` JSON. Any fix must not break rules that already use `modelId` targets.
- **No `RoutingTarget` schema in DB**: The `target` column is a free-form JSON blob. Schema changes are additive only; old rules can coexist with new ones.
- **Cache invalidation not required**: Rule changes take effect within 5 minutes (or immediately in dev mode).
- **`findDefaultProviderItem()` already resilient**: The copilot/agent default model already resolves by either `itemId` or `modelId` (line 1135). The issue is isolated to rule-based routing.

### Key References

- `apps/api/src/modules/provider/auto-model-router.service.ts:664` — `buildModelMap()`: only indexes by `config.modelId`
- `apps/api/src/modules/provider/auto-model-router.service.ts:277` — `selectModelFromTarget()`: all lookups are `modelMap.get(modelId)`
- `apps/api/src/modules/provider/auto-model-router.service.ts:55` — `RoutingTarget` interface definition
- `apps/api/src/modules/provider/provider.service.ts:1129` — `findDefaultProviderItem()`: dual `itemId`/`modelId` lookup (already resilient)
- `packages/utils/src/auto-model.ts:14` — `AUTO_MODEL_ROUTING_PRIORITY`: hardcoded `modelId` list (legacy fallback)
- `specs/current/auto-model/AUTO_MODEL.md` — Full system architecture reference

## Design

### Approach: Dual-Index Model Map (Approach A)

Extend `buildModelMap()` to index each available LLM item by **both** `config.modelId` and `item.itemId`. All six existing `modelMap.get(id)` call sites benefit automatically — no other code changes required.

**Why this approach:**
- Minimal blast radius: one added line in one private method
- Zero breaking changes: existing rules with `modelId` values continue to work unchanged
- New rules in DB can immediately use stable `itemId` values (e.g., `pi-abc123`)
- No `RoutingTarget` schema migration needed; old and new rules coexist in the same table
- Namespace disjoint: `modelId` values (`B`) and `itemId` values (`pi-abc123`) cannot collide

### Data Flow (After Fix)

```
buildModelMap(llmItems)
  for each item:
    parse config.modelId
    if config.modelId → map.set(config.modelId, item)   ← existing (keep)
    map.set(item.itemId, item)                           ← new (add)

selectModelFromTarget(target, modelMap)
  modelMap.get(target.model)   ← resolves whether target.model is a modelId OR itemId
```

### Affected Files

- `apps/api/src/modules/provider/auto-model-router.service.ts`
  - `buildModelMap()` (line 664): add `modelMap.set(item.itemId, item)` after the `config.modelId` line
  - Update JSDoc comment: change description from "modelId -> ProviderItemModel" to "modelId or itemId -> ProviderItemModel"

No other files need modification.

### Call Sites That Benefit (No Changes Needed)

| Method | Line | Uses |
|--------|------|------|
| `selectModelFromTarget` fixed routing | ~283 | `modelMap.get(target.model)` |
| `selectRandomModel` | ~222 | `modelMap.get(selectedModelId)` |
| `selectWeightedModel` | ~244 | `modelMap.has(item.model)`, `modelMap.get(item.model)` |
| `routeByTools` | ~733 | `modelMap.get(targetModelId)` |
| `routeByRandomSelection` | ~753 | `modelMap.get(selectedCandidate)` |
| `routeByBuiltInPriorityList` | ~767 | `modelMap.get(candidateModelId)` |

### Scope

- **In scope**: Rule-based routing (the path that caused the incident). The fix incidentally also makes tool-based, random, and priority-list tiers support `itemId` lookups.
- **Out of scope**: `AUTO_MODEL_ROUTING_PRIORITY` hardcoded list (legacy fallback, rarely hit in production); `findDefaultProviderItem()` is already resilient.

### DB Rule Update (Post-Deploy Ops)

After deploying the code change, update production routing rules to use `itemId` values instead of `modelId` values in `target` JSON. This is a data-only change — no code deploy needed for it.

Pseudocode for updated rule target:
```
Old: { "model": "A" }
New: { "model": "pi-<stable-item-id>" }
```

## Plan

- [x] Add `modelMap.set(item.itemId, item)` in `buildModelMap()`
- [x] Update JSDoc to reflect dual-index behavior

## Implementation

**Files modified:**
- `apps/api/src/modules/provider/auto-model-router.service.ts`
  - `buildModelMap()` (~line 664): added `modelMap.set(item.itemId, item)` after the `config.modelId` line; updated JSDoc comment to "modelId or itemId -> ProviderItemModel"

**Deviations from design:** None.

## Verification

### Migration SQL

`migration.sql` — three passes covering all `RoutingTarget` field types (`model`, `models`, `weights`). Each pass joins `provider_items` on `config->>'modelId'` and replaces matching values with `item_id`. Rules already using `itemId` (prefixed `pi-`) are skipped.

### Steps

1. Restored production-like rule data to local DB (6 rules, all with `modelId`-based targets)
2. **Baseline E2E**: confirmed `rule_based` routing worked with `modelId` targets
3. Ran `migration-local.sql` — all rule targets updated to `itemId` values
4. **Post-migration E2E**: re-ran same scenes

### Results

- **Rules after migration** — all targets replaced with `itemId`
- **Routing results (post-migration E2E)**: Both scenes resolved via `rule_based` with the correct priority-11 rule, selecting the same provider item as before migration. Dual-index lookup confirmed working.

## Notes

**Alternatives considered:**
- Approach B (new `itemId` fields in `RoutingTarget`): cleaner semantics but adds interface complexity and requires two parallel field sets in every rule going forward.
- Approach C (two separate maps): same behavior as A but passes two maps through the call stack — unnecessary complexity.
- Approach D (itemId-only + migration): cleanest long-term but breaks all existing rules during migration window.

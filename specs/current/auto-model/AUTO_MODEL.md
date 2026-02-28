# Auto Model & Routing

## Design Principle

Auto Model Routing is a **virtual model layer** that decouples the model a user selects from the model that actually executes the request. The user always sees "Auto" in the UI; the system silently routes to the best real LLM based on rules, scene, toolset, and user context.

**Why Auto Routing?**
- Lets Refly optimize cost without exposing model details to users
- Enables per-scene, per-condition routing without user reconfiguration
- Keeps UI stable while backend models are upgraded or rotated
- Provides a trial-period experience hook for new users

## Virtual Provider & Item

Auto model is a real `provider_item` backed by a special system provider, so it participates in the existing model query pipeline without special-casing.

| Field | Value |
|-------|-------|
| `providers.provider_id` | `pr-system` |
| `providers.provider_key` | `system` |
| `provider_items.item_id` | `pi-asnj62w0h0acxi34lkfg4ijn` |
| `provider_items.name` | `Auto` |
| `config.modelId` | `auto` |
| `config.tooltip` | `Smart Routing` |
| `config.contextLimit` | `200000` |
| `config.capabilities.vision` | `true` |
| `credit_billing.inputCost` | `80` credits/1M tokens |
| `credit_billing.outputCost` | `400` credits/1M tokens |
| UI position | First in list (name `Auto` sorts before all others) |

The `isAutoModel()` utility (`packages/utils/src/auto-model.ts`) checks `config.modelId === 'auto'` to identify this item throughout the codebase.

## Default Model Config

Environment variables control the default model per scene:

| Env Var | Scene | Note |
|---------|-------|------|
| `DEFAULT_MODEL_AGENT` | `agent` | Set to `auto` (or the Auto item ID) to default new Agent nodes to auto model |
| `DEFAULT_MODEL_COPILOT` | `copilot` | Set to `auto` (or the Auto item ID) to default Copilot to auto model |
| `DEFAULT_MODEL_CHAT` | `chat` | Deprecated, do NOT set to `Auto` |

`findDefaultProviderItem()` resolves the default in this priority order:
1. Admin override (`defaultModelOverride` in user preferences)
2. User-saved preference (`defaultModel` in user preferences)
3. Global env-var default (matched by `itemId` OR `modelId`)
4. First available item in user's LLM list

## Module Map

| File | Responsibility |
|------|---------------|
| `apps/api/src/modules/provider/auto-model-router.service.ts` | Core routing engine: rule cache, rule matching, tool-based routing, fallback chain, result persistence |
| `apps/api/src/modules/provider/auto-model-trial.service.ts` | Tracks each user's first N Auto model invocations for the trial-period condition |
| `apps/api/src/modules/provider/provider.service.ts` | `prepareModelProviderMap()`, `findDefaultProviderItem()` — supplies provider items to routing |
| `apps/api/src/modules/skill/skill.service.ts` | Routing invocation point: builds `RoutingContext`, calls `AutoModelRoutingService.route()`, injects `routedData` into config |
| `apps/api/src/modules/skill/skill-invoker.service.ts` | Reads `routedData` for token usage tracking and billing |
| `packages/utils/src/auto-model.ts` | `isAutoModel()`, `AUTO_MODEL_ID`, `AUTO_MODEL_ROUTING_PRIORITY`, env-var readers |
| `packages/utils/src/models.ts` | `getModelSceneFromMode()` — maps `AgentMode` to scene string |

## Invocation Chain

```
User submits task (with Auto model selected)
  ↓
skill.service.ts: skillInvokePreCheck()
  1. Fetch llmItems (user's available LLM provider items)
  2. autoModelTrialService.checkAndUpdateTrialStatus(uid) → inAutoModelTrial
  3. Build RoutingContext { llmItems, userId, actionResultId, mode, inputPrompt, toolsets, inAutoModelTrial }
  4. providerService.prepareModelProviderMap(user, param.modelItemId)
     → resolves originalProviderItem for each scene
  5. param.modelItemId is preserved (Auto itemId) for UI display
  6. autoModelRoutingService.route(originalProviderItem, routingContext)
     → returns routedProviderItem (the real model)
  7. Inject routedData = { isRouted: true, originalItemId, originalModelId: 'auto' }
     into routedProviderItem.config
  ↓
skill-invoker.service.ts: invokes LLM with routedProviderItem
  - Token usage records include routedData for billing calculation
  ↓
Billing: uses Auto model's credit rate (80/400), not the real model's rate
  ↓
action_results.provider_item_id = Auto itemId  → frontend shows "Auto"
action_results.model_name = real model ID       → Langfuse tracking
auto_model_routing_results row written          → observability
```

## Routing Engine

`AutoModelRoutingService.route()` implements a 5-tier priority chain:

```
1. Rule-based routing         ← DB rules, matched by scene + conditions
2. Tool-based routing         ← env var overrides for specific toolset keys
3. Random selection           ← AUTO_MODEL_ROUTING_RANDOM_LIST env var
4. Built-in priority list     ← AUTO_MODEL_ROUTING_PRIORITY hardcoded list
5. First available model      ← context.llmItems[0]
```

If the input is not an Auto model (`isAutoModel()` returns false), the item is returned unchanged (no routing).

### Priority 1: Rule-Based Routing (Primary)

Rules are loaded from `auto_model_routing_rules` table, filtered by `scene` and `enabled=true`, ordered by `priority DESC`.

**Rule matching** (all defined conditions must pass — AND logic):
- `condition.toolsetInventoryKeys`: any active toolset's key must appear in the list
- `condition.inAutoModelTrial`: user must be within their first N Auto model invocations

**Rule target** selects the destination model (priority within target):
1. `target.model` — fixed single model ID (string)
2. `target.models` — random selection from array
3. `target.weights` — weighted random from `[{ model, weight }]`

All target model IDs are matched against a `modelMap` built from `context.llmItems`. Reasoning models (`capabilities.reasoning = true`) are excluded from the map.

**Rule cache**: In-memory cache keyed by scene, 5-minute TTL with 3-minute background refresh. Development mode (`NODE_ENV=development`) bypasses cache entirely.

### Priority 2: Tool-Based Routing (Deprecated)

Controlled entirely by environment variables. Only applies when `mode === 'node_agent'` (scene `agent`).

| Env Var | Description |
|---------|-------------|
| `AUTO_MODEL_ROUTING_TOOL_BASED_ENABLED` | `true` to enable |
| `AUTO_MODEL_ROUTING_TOOL_BASED_TARGET_TOOLS` | Comma-separated toolset inventory keys that trigger the matched model |
| `AUTO_MODEL_ROUTING_TOOL_BASED_MATCHED_MODEL_ID` | Model ID used when any target tool is present |
| `AUTO_MODEL_ROUTING_TOOL_BASED_UNMATCHED_MODEL_ID` | Model ID used when no target tool is present |

### Priority 3: Random Selection (Deprecated)

`AUTO_MODEL_ROUTING_RANDOM_LIST` — comma-separated model IDs. A random one is selected each call.

### Priority 4: Built-In Priority List (Deprecated)

`AUTO_MODEL_ROUTING_PRIORITY` in `packages/utils/src/auto-model.ts`:
```
global.anthropic.claude-opus-4-5-20251101-v1:0   ← primary
global.anthropic.claude-sonnet-4-5-20250929-v1:0  ← fallback 1
us.anthropic.claude-sonnet-4-5-20250929-v1:0      ← fallback 2
```
First model found in the user's available items wins.

### Priority 5: First Available (Final Fallback)

`context.llmItems[0]` — always succeeds unless the user has zero LLM items.

## Auto Model Trial

`AutoModelTrialService` gives new users a "trial" experience: their first N Auto invocations can be routed to a more powerful model via a rule with `inAutoModelTrial: true` condition.

- Counter stored in Redis with 30-day TTL; DB is queried only on cache miss
- Threshold controlled by `AUTO_MODEL_TRIAL_COUNT` env var (default: `20`)
- Counter is incremented fire-and-forget after every Auto invocation
- On Redis error, defaults to `inTrial = false` (safe degradation)

## Scene Mapping

`getModelSceneFromMode(mode)` maps `AgentMode` → scene string:

| mode | scene |
|------|-------|
| `copilot_agent` | `copilot` |
| `node_agent` | `agent` |
| anything else | `chat` |

Scene is used to:
1. Filter routing rules from DB
2. Select which entry in `modelProviderMap` gets routed (only the primary scene model is routed; auxiliary models — titleGeneration, queryAnalysis, image, video, audio — are never routed)

## Display & Billing Separation

**Key invariant**: `param.modelItemId` is never modified — it always holds the Auto item ID.

| Field | Value | Purpose |
|-------|-------|---------|
| `action_results.provider_item_id` | Auto item ID | Frontend display — always shows "Auto" |
| `action_results.model_name` | Real model ID | Langfuse tracking, observability |
| `routedData.originalItemId` | Auto item ID | Used at billing time to fetch Auto's credit rate |
| `routedData.originalModelId` | `'auto'` | Langfuse tag to distinguish routed traffic |
| `routedData.isRouted` | `true` | Billing branch trigger |

**Billing**: When `routedData.isRouted` is true, billing uses the **Auto model's** `creditBilling` (80/400 per 1M tokens), not the real model's rate. Token counts come from the real model's actual usage.

## Database Tables

### `auto_model_routing_rules`

Stores routing rules. Managed via DB (no code deployment needed to change rules).

| Column | Type | Description |
|--------|------|-------------|
| `rule_id` | String | Unique rule ID |
| `rule_name` | String | Human-readable name |
| `scene` | String | `"copilot"` or `"agent"` |
| `condition` | JSON | Matching conditions (AND logic). Empty `{}` matches all. |
| `target` | JSON | Target model selection config |
| `priority` | Int | Higher = evaluated first |
| `enabled` | Boolean | Soft disable without deletion |

**Condition schema**:
```json
{
  "toolsetInventoryKeys": ["fal_image", "fal_video"],
  "inAutoModelTrial": true
}
```

**Target schema** (priority within target: model > models > weights):
```json
{ "model": "claude-sonnet-4-5-20250929" }
{ "models": ["claude-sonnet-4-5", "gemini-flash"] }
{ "weights": [{ "model": "claude-haiku", "weight": 70 }, { "model": "gemini-flash", "weight": 30 }] }
```

**Local DB state**: No rules configured (table is empty). All routing currently falls through to env-var fallbacks.

**Inspection query** — lists enabled rules with human-readable model names (handles all three target types):

```sql
WITH weight_labels AS (
  SELECT
    r.pk,
    string_agg(
      COALESCE(pi_item.name, pi_model.name, elem->>'model')
        || ' (' || (elem->>'weight') || ')',
      ', ' ORDER BY (elem->>'weight')::int DESC
    ) AS label
  FROM refly.auto_model_routing_rules r,
    jsonb_array_elements(r.target::jsonb->'weights') AS elem
  LEFT JOIN refly.provider_items pi_item
    ON pi_item.item_id = elem->>'model'
  LEFT JOIN refly.provider_items pi_model
    ON pi_model.config::jsonb->>'modelId' = elem->>'model'
    AND pi_model.deleted_at IS NULL
  WHERE r.target::jsonb ? 'weights'
  GROUP BY r.pk
),
models_labels AS (
  SELECT
    r.pk,
    string_agg(
      COALESCE(pi_item.name, pi_model.name, elem#>>'{}'),
      ', '
    ) AS label
  FROM refly.auto_model_routing_rules r,
    jsonb_array_elements(r.target::jsonb->'models') AS elem
  LEFT JOIN refly.provider_items pi_item
    ON pi_item.item_id = elem#>>'{}'
  LEFT JOIN refly.provider_items pi_model
    ON pi_model.config::jsonb->>'modelId' = elem#>>'{}'
    AND pi_model.deleted_at IS NULL
  WHERE r.target::jsonb ? 'models'
  GROUP BY r.pk
)
SELECT
  r.rule_id,
  r.rule_name,
  r.scene,
  r.priority,
  r.enabled,
  r.condition,
  CASE
    WHEN r.target::jsonb ? 'model' THEN
      COALESCE(pi_item.name, pi_model.name, r.target::jsonb->>'model')
    WHEN r.target::jsonb ? 'weights' THEN wl.label
    WHEN r.target::jsonb ? 'models'  THEN ml.label
  END AS target_model
FROM refly.auto_model_routing_rules r
LEFT JOIN refly.provider_items pi_item
  ON pi_item.item_id = r.target::jsonb->>'model'
LEFT JOIN refly.provider_items pi_model
  ON pi_model.config::jsonb->>'modelId' = r.target::jsonb->>'model'
  AND pi_model.deleted_at IS NULL
LEFT JOIN weight_labels wl ON wl.pk = r.pk
LEFT JOIN models_labels ml ON ml.pk = r.pk
WHERE r.enabled = true
ORDER BY r.scene, r.priority DESC;
```

### `auto_model_routing_results`

One record per Auto model invocation. Written async (non-blocking).

| Column | Description |
|--------|-------------|
| `routing_result_id` | Unique result ID (prefix `rrt-`) |
| `user_id` | User who triggered the invocation |
| `action_result_id` | Links to `action_results` for full chain trace |
| `action_result_version` | Action result version |
| `scene` | `"copilot"` or `"agent"` |
| `routing_strategy` | Strategy used (see below) |
| `matched_rule_id` / `matched_rule_name` | Rule that matched (rule_based only) |
| `original_item_id` / `original_model_id` | Auto item ID + `"auto"` |
| `selected_item_id` / `selected_model_id` | Actual routed model |
| `created_at` | Timestamp |

**Routing strategy values**:
- `rule_based` — matched a DB rule
- `tool_based` — matched env-var tool-based config
- `fallback_random_selection` — random from `AUTO_MODEL_ROUTING_RANDOM_LIST`
- `fallback_built_in_priority` — matched `AUTO_MODEL_ROUTING_PRIORITY` list
- `fallback_first_available` — took `llmItems[0]`

Unique constraint: `(action_result_id, action_result_version)` — one routing decision per execution.

## Environment Variables Summary

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_MODEL_AGENT` | — | Default item ID or model ID for agent scene |
| `DEFAULT_MODEL_COPILOT` | `DEFAULT_MODEL_CHAT` | Default for copilot scene |
| `DEFAULT_MODEL_CHAT` | — | Base chat default |
| `AUTO_MODEL_TRIAL_COUNT` | `20` | Number of first N invocations considered "trial" |
| `AUTO_MODEL_ROUTING_RANDOM_LIST` | — | Comma-separated model IDs for random fallback |
| `AUTO_MODEL_ROUTING_TOOL_BASED_ENABLED` | `false` | Enable tool-based routing |
| `AUTO_MODEL_ROUTING_TOOL_BASED_TARGET_TOOLS` | — | Toolset keys that trigger matched model |
| `AUTO_MODEL_ROUTING_TOOL_BASED_MATCHED_MODEL_ID` | — | Model when target tool present |
| `AUTO_MODEL_ROUTING_TOOL_BASED_UNMATCHED_MODEL_ID` | — | Model when target tool absent |

## Current Implementation Status (as of 2026-02-28)

| Feature | Status |
|---------|--------|
| Virtual Auto provider + provider_item in DB | ✅ Complete |
| `isAutoModel()` detection utility | ✅ Complete |
| `prepareModelProviderMap()` integration | ✅ Complete |
| `param.modelItemId` preserved for display | ✅ Complete |
| Rule-based routing engine + cache | ✅ Complete |
| Tool-based routing (env-var controlled) | ✅ Complete |
| Random selection fallback | ✅ Complete |
| Built-in priority list fallback | ✅ Complete |
| Auto model trial service (Redis counter) | ✅ Complete |
| `auto_model_routing_results` persistence | ✅ Complete |
| `routedData` injection for billing | ✅ Complete |
| Billing uses Auto credit rate (not real model rate) | ✅ Complete |
| DB routing rules configured (production) | ✅ Managed via DB |
| DB routing rules configured (local dev) | ⚠️ Table empty — falls through to env-var fallbacks |
| Rule target uses `itemId` (upgrade-resilient) | ❌ Currently `modelId` — fragile during upgrades |
| Semantic routing | ❌ Not implemented (medium-term roadmap) |
| ML-based routing | ❌ Not implemented (long-term roadmap) |
| Cascade routing / retry on failure | ❌ Not implemented |

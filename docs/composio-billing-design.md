# Composio Billing Fix — Design Document

> **Author:** Colin
> **Date:** 2026-02-17
> **Status:** Draft
> **Branch:** feat/tool/dynamic-fee

## Context

Composio tools are currently billed at a hardcoded default of **3 credits/call** (`composio.service.ts:381`), which is **~83x higher** than the actual upstream cost ($0.000299/call × 120 credits/USD = 0.036 credits). Additionally, there's no centralized config for Composio plan rates, and the credit system is integer-based (`Int` in Prisma) while a single call costs < 1 credit. This document describes the design to address all three issues.

### Problems Identified

| # | Problem | Severity | Root Cause |
|---|---------|----------|------------|
| 1 | All Composio tools default to 3 credits/call | High | Hardcoded magic number in `composio.service.ts:381` |
| 2 | No centralized provider-level pricing config | Medium | Plan rate embedded in per-action prices |
| 3 | Single call costs 0.036 credits but credit system is integer-based | High | `credit_usage.amount` is `Int` in Prisma |

### Composio Pricing Reference

| Plan | Standard Rate (per 1K calls) | Premium Rate (per 1K calls) |
|------|------------------------------|-----------------------------|
| Ridiculously Cheap ($29/mo) | $0.299 | $0.897 |
| Serious Business ($229/mo) | $0.249 | $0.747 |
| Enterprise | Custom | Custom |

**Premium tools include:** Composio Search, Perplexity, Exa, SerpAPI, E2B, Firecrawl, AI/ML inference, Document processing & OCR.

**Standard tools include:** Twitter, Slack, GitHub, Gmail, and most integration tools.

---

## Solution Overview

Three new mechanisms working together:

1. **`tool_provider_billing` table** — centralized Composio plan config (change one row on plan upgrade)
2. **Per-action tier in `toolset_inventory.credit_billing`** — each action tagged as `standard` or `premium`
3. **Redis-based credit accumulator** — tracks fractional costs, flushes whole credits when accumulated ≥ 1

### Delivery Milestones

- **M1 (current PR scope):** provider billing config + tier resolution + micro-credit accumulator + idempotency
- **M2 (follow-up PR):** discount rules engine (`tool_billing_promotion`) and migration of `FREE_TOOLSET_KEYS`

`FREE_TOOLSET_KEYS` remains the active free-tier strategy in M1.

### Pricing Formula (deterministic)

```
microCredits = round((planRate / 1000) × USD_TO_CREDITS_RATE × margin × 1_000_000)
credits = microCredits / 1_000_000
```

| Tier | Calculation | Credits/Call |
|------|-------------|-------------|
| Standard | (0.299 / 1000) × 120 × 1.0 | **0.036** |
| Premium | (0.897 / 1000) × 120 × 1.0 | **0.108** |

- `USD_TO_CREDITS_RATE` = 120 (configurable via env var)
- `margin` = 1.0 (pass-through, no markup; configurable per provider)
- `MICRO_CREDIT_SCALE` = 1,000,000 (integer arithmetic for deterministic billing)

### Architecture Diagram

```
┌─────────────────────────────┐     ┌────────────────────────────┐
│  tool_provider_billing      │     │  toolset_inventory         │
│                             │     │                            │
│  providerKey: "composio"    │     │  key: "twitter"            │
│  plan: "ridiculously_cheap" │     │  credit_billing:           │
│  standardRatePer1K: 0.299   │     │    { "_default":           │
│  premiumRatePer1K:  0.897   │     │      { "tier": "standard"} │
│  margin: 1.0                │     │    }                       │
│                             │     │                            │
│  ← Change once on upgrade   │     │  ← Per-action tier tags    │
└──────────────┬──────────────┘     └──────────────┬─────────────┘
               │                                    │
               └──────────┬─────────────────────────┘
                          ▼
              ┌───────────────────────────────┐
              │  BillingService               │
              │  calculateComposioCreditCost()│
              │  fractionalCost = 0.036       │
              │  applyDiscountRules()         │
              └──────────────┬────────────────┘
                             ▼
              ┌───────────────────────────────┐
              │  Redis Accumulator            │
              │  credit_accumulator:{uid}:... │
              │                               │
              │  Call 1:  +discountedCost     │
              │  Call 2:  +discountedCost     │
              │  ...                          │
              │  Call N:  reaches >= 1.0      │
              │  → Flush 1 credit, keep 0.008 │
              └──────────────┬────────────────┘
                             ▼
              ┌───────────────────────────────┐
              │  Existing Credit System (Int) │
              │  syncToolCreditUsage(1)       │
              │  No schema change needed      │
              └───────────────────────────────┘
```

---

## Phase 1: Database Schema

### 1.1 Add `ToolProviderBilling` model to Prisma schema

**File:** `apps/api/prisma/schema.prisma` (after `ToolBilling` model, ~line 1787)

```prisma
model ToolProviderBilling {
  pk                String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  providerKey       String   @map("provider_key")
  plan              String   @map("plan")
  standardRatePer1K Decimal  @map("standard_rate_per_1k") @db.Decimal(12, 6)
  premiumRatePer1K  Decimal  @map("premium_rate_per_1k") @db.Decimal(12, 6)
  margin            Decimal  @default(1.0) @map("margin") @db.Decimal(12, 6)
  active            Boolean  @default(true) @map("active")
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz()

  @@unique([providerKey, plan])
  @@index([providerKey, active], map: "idx_provider_billing_active")
  @@map("tool_provider_billing")
}
```

**Design rationale:**
- Only one row per provider is `active = true` at a time
- On plan upgrade: insert new row with `active = true`, set old to `active = false`
- `Decimal` is intentional to avoid floating-point drift in billing calculations
- `margin = 1.0` default means pass-through pricing (no markup)
- Partial unique index `uk_provider_one_active_plan` (migration SQL) is mandatory and managed via raw SQL

### 1.2 Create migration SQL (full)

**New file:** `apps/api/prisma/migrations/YYYYMMDD_composio_provider_billing/migration.sql`

```sql
BEGIN;

-- 1) Create provider-level billing table
CREATE TABLE IF NOT EXISTS tool_provider_billing (
  pk UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key TEXT NOT NULL,
  plan TEXT NOT NULL,
  standard_rate_per_1k NUMERIC(12, 6) NOT NULL,
  premium_rate_per_1k NUMERIC(12, 6) NOT NULL,
  margin NUMERIC(12, 6) NOT NULL DEFAULT 1.0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tool_provider_billing_unique_plan UNIQUE (provider_key, plan)
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_provider_billing_active
  ON tool_provider_billing (provider_key, active)
  WHERE active = true;

-- Enforce "at most one active row per provider"
CREATE UNIQUE INDEX IF NOT EXISTS uk_provider_one_active_plan
  ON tool_provider_billing (provider_key)
  WHERE active = true;

-- 3) Seed initial Composio plan (Ridiculously Cheap)
INSERT INTO tool_provider_billing (
  provider_key, plan, standard_rate_per_1k, premium_rate_per_1k, margin, active
)
VALUES ('composio', 'ridiculously_cheap', 0.299, 0.897, 1.0, true)
ON CONFLICT (provider_key, plan)
DO UPDATE SET
  standard_rate_per_1k = EXCLUDED.standard_rate_per_1k,
  premium_rate_per_1k = EXCLUDED.premium_rate_per_1k,
  margin = EXCLUDED.margin;

-- 4) Upsert Composio OAuth toolsets from packages/agent-tools (exclude apify-13f)
-- Type mapping in this codebase:
-- - OAuth integrations use type='external_oauth'
INSERT INTO toolset_inventory (
  key,
  name,
  domain,
  label_dict,
  description_dict,
  type,
  adapter_type,
  enabled,
  credit_billing
)
VALUES
  (
    'github',
    'GitHub',
    'https://github.com',
    '{"en":"GitHub","zh-CN":"GitHub"}',
    '{"en":"Interact with GitHub API to manage repositories, issues, pull requests, and more.","zh-CN":"与 GitHub API 交互，管理仓库、议题、拉取请求等。"}',
    'external_oauth',
    'http',
    true,
    '{"_default":{"tier":"standard"}}'
  ),
  (
    'gmail',
    'Gmail',
    'https://docs.google.com',
    '{"en":"Gmail","zh-CN":"Gmail"}',
    '{"en":"Access Gmail via Composio to list, read, forward, draft, delete, and label messages while also managing contacts, profiles, and mailbox history.","zh-CN":"通过 Composio 访问 Gmail，支持列出、读取、转发、草拟、删除和标记邮件，并管理联系人、资料和邮箱历史记录。"}',
    'external_oauth',
    'http',
    true,
    '{"_default":{"tier":"standard"}}'
  ),
  (
    'googledocs',
    'Google Docs',
    'https://docs.google.com',
    '{"en":"Google Docs","zh-CN":"Google 文档"}',
    '{"en":"Access and manage Google Docs documents. Create, read, update, export, and manage Google Docs.","zh-CN":"访问和管理 Google 文档。创建、读取、更新、导出和管理 Google 文档。"}',
    'external_oauth',
    'http',
    true,
    '{"_default":{"tier":"standard"}}'
  ),
  (
    'googledrive',
    'Google Drive',
    'https://drive.google.com',
    '{"en":"Google Drive","zh-CN":"Google 云端硬盘"}',
    '{"en":"Access and manage files in Google Drive. Upload, download, list files, manage permissions, and more.","zh-CN":"访问和管理 Google 云端硬盘中的文件。上传、下载、列出文件、管理权限等。"}',
    'external_oauth',
    'http',
    true,
    '{"_default":{"tier":"standard"}}'
  ),
  (
    'googlesheets',
    'Google Sheets',
    'https://sheets.google.com',
    '{"en":"Google Sheets","zh-CN":"Google 表格"}',
    '{"en":"Access and manage Google Sheets spreadsheets. Create, read, update spreadsheets and worksheets.","zh-CN":"访问和管理 Google 表格。创建、读取、更新表格和工作表。"}',
    'external_oauth',
    'http',
    true,
    '{"_default":{"tier":"standard"}}'
  ),
  (
    'twitter',
    'Twitter',
    'https://twitter.com',
    '{"en":"Twitter","zh-CN":"推特"}',
    '{"en":"Interact with Twitter API to post tweets, search content, manage followers, and more.","zh-CN":"与Twitter API交互，发布推文、搜索内容、管理关注者等。"}',
    'external_oauth',
    'http',
    true,
    '{"_default":{"tier":"standard"}}'
  ),
  (
    'notion',
    'Notion',
    'https://notion.so',
    '{"en":"Notion","zh-CN":"Notion"}',
    '{"en":"Access and manage pages, databases, and content in Notion. Create, read, update, and organize your workspace.","zh-CN":"访问和管理 Notion 中的页面、数据库和内容。创建、读取、更新和组织您的工作空间。"}',
    'external_oauth',
    'http',
    true,
    '{"_default":{"tier":"standard"}}'
  ),
  (
    'reddit',
    'Reddit',
    'https://reddit.com',
    '{"en":"Reddit","zh-CN":"Reddit"}',
    '{"en":"Interact with Reddit API to create posts, manage comments, search content, and more.","zh-CN":"与 Reddit API 交互，创建帖子、管理评论、搜索内容等。"}',
    'external_oauth',
    'http',
    true,
    '{"_default":{"tier":"standard"}}'
  )
ON CONFLICT (key)
DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  label_dict = EXCLUDED.label_dict,
  description_dict = EXCLUDED.description_dict,
  type = EXCLUDED.type,
  adapter_type = EXCLUDED.adapter_type,
  enabled = EXCLUDED.enabled,
  credit_billing = EXCLUDED.credit_billing,
  updated_at = NOW();

-- 5) Ensure all existing external_oauth inventories have default standard tier
-- (safe when you have already inserted Composio OAuth toolsets locally)
UPDATE toolset_inventory
SET credit_billing = '{"_default":{"tier":"standard"}}',
    updated_at = NOW()
WHERE type = 'external_oauth'
  AND deleted_at IS NULL
  AND (credit_billing IS NULL OR credit_billing = '');

-- 6) Comments
COMMENT ON TABLE tool_provider_billing IS 'Provider-level billing config for third-party tool providers';
COMMENT ON COLUMN tool_provider_billing.standard_rate_per_1k IS 'Standard tier rate per 1000 actions in USD';
COMMENT ON COLUMN tool_provider_billing.premium_rate_per_1k IS 'Premium tier rate per 1000 actions in USD';
COMMENT ON COLUMN tool_provider_billing.margin IS 'Margin multiplier (1.0 = pass-through, no markup)';

COMMIT;
```

### 1.3 Notes for inventory migration

- Use `external_oauth` (not `oauth`) for Composio OAuth integrations in `toolset_inventory.type`.
- `apify-13f` is intentionally excluded by product policy.
- `jina` and `perplexity` are credentials-based (`regular`) toolsets and are intentionally excluded from this Composio OAuth migration scope.
- For already inserted Composio rows, keep the key list as-is and let step (5) backfill missing `credit_billing`.

### 1.4 Plan upgrade operation (future reference, transactional)

```sql
BEGIN;

-- Lock provider rows to avoid race during switch
SELECT 1
FROM tool_provider_billing
WHERE provider_key = 'composio'
FOR UPDATE;

UPDATE tool_provider_billing
SET active = false, updated_at = NOW()
WHERE provider_key = 'composio' AND active = true;

INSERT INTO tool_provider_billing (
  provider_key, plan, standard_rate_per_1k, premium_rate_per_1k, margin, active
)
VALUES ('composio', 'serious_business', 0.249, 0.747, 1.0, true)
ON CONFLICT (provider_key, plan)
DO UPDATE SET
  standard_rate_per_1k = EXCLUDED.standard_rate_per_1k,
  premium_rate_per_1k = EXCLUDED.premium_rate_per_1k,
  margin = EXCLUDED.margin,
  active = true,
  updated_at = NOW();

COMMIT;
-- All Composio tools auto-adjust within cache TTL or explicit cache refresh.
```

---

## Phase 2: OpenAPI Schema & Types

### 2.1 Add `creditBillingMap` to `ToolCreationContext`

**File:** `packages/openapi-schema/schema.yml` (~line 10215, after `toolsetName`)

```yaml
        creditBillingMap:
          type: object
          description: Per-action tier config for provider billing
          additionalProperties:
            type: object
            properties:
              tier:
                type: string
                enum: [standard, premium]
            required: [tier]
```

### 2.2 Regenerate types

Run the OpenAPI codegen to update `types.gen.ts`. The generated type will be:

```typescript
creditBillingMap?: Record<string, { tier: 'standard' | 'premium' }>;
```

---

## Phase 3: Provider Billing Cache & Redis Accumulator

### 3.1 Add types to `billing.dto.ts`

**File:** `apps/api/src/modules/tool/billing/billing.dto.ts`

```typescript
/**
 * Provider billing configuration loaded from database
 */
export interface ProviderBillingConfig {
  providerKey: string;
  plan: string;
  standardRatePer1K: number;
  premiumRatePer1K: number;
  margin: number;
}

/**
 * Options for processing Composio billing with accumulator
 */
export interface ProcessComposioBillingOptions {
  uid: string;
  toolName: string;
  toolsetKey: string;
  /** Fractional credit cost (e.g., 0.036) */
  fractionalCreditCost: number;
  /** Original cost before any discount */
  originalFractionalCost: number;
  resultId?: string;
  version?: number;
}
```

### 3.2 Extend `BillingService`

**File:** `apps/api/src/modules/tool/billing/billing.service.ts`

**Constructor changes:**
- Inject `RedisService` (already exported from `CommonModule` which is imported by `BillingModule`)
- Add `providerBillingCache: SingleFlightCache<Map<string, ProviderBillingConfig>>` (5-min TTL)

**Decimal conversion note (required):**

Prisma returns `Decimal` objects for `NUMERIC` columns. Convert explicitly when loading cache:

```typescript
configMap.set(record.providerKey, {
  providerKey: record.providerKey,
  plan: record.plan,
  standardRatePer1K: Number(record.standardRatePer1K),
  premiumRatePer1K: Number(record.premiumRatePer1K),
  margin: Number(record.margin),
});
```

**New public methods:**

| Method | Purpose |
|--------|---------|
| `getProviderBillingConfig(providerKey)` | Cached O(1) lookup from `tool_provider_billing` |
| `calculateComposioCreditCost(config, tier)` | Returns integer micro-credits using deterministic formula |
| `processComposioBilling(options)` | Checks FREE_TOOLSET_KEYS, then accumulates via Redis |

**New private methods:**

| Method | Purpose |
|--------|---------|
| `loadProviderBillingConfigs()` | Loads active configs from DB into Map |
| `accumulateAndFlush(uid, providerKey, microCredits, idempotencyKey)` | Atomic Redis Lua + idempotency guard |

### 3.3 Redis Accumulator Design

```
Key format:    credit_accumulator:{uid}:composio
Idempotency:   credit_accumulator_idempotency:{uid}:composio
TTL:           24 hours (safety expiry for abandoned accumulators)
Operation:     INCRBY (integer micro-credits), atomic via Lua
Flush logic:   When accumulated >= 1_000_000, flush floor(accumulated / 1_000_000) credits
```

**Concurrency safety:**
- Lua script performs increment + flush decision atomically
- Idempotency key (`toolCallId` or `resultId:version:toolName`) prevents duplicate charge on retries
- Double-flush overcharge is not acceptable; design target is exactly-once billing per call
- Redis restart may lose pending remainder; bounded to <1 credit and auditable via logs

**Lua pseudocode (M1 required):**

```lua
-- KEYS[1] = credit_accumulator:{uid}:composio
-- KEYS[2] = credit_accumulator_idempotency:{uid}:composio
-- ARGV[1] = microCredits (integer)
-- ARGV[2] = idempotencyKey (string)
-- ARGV[3] = ttlSeconds (e.g. 86400)

if redis.call('SISMEMBER', KEYS[2], ARGV[2]) == 1 then
  local existing = tonumber(redis.call('GET', KEYS[1]) or '0')
  return {0, existing}
end

local newTotal = redis.call('INCRBY', KEYS[1], tonumber(ARGV[1]))
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))

redis.call('SADD', KEYS[2], ARGV[2])
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))

local MICRO_SCALE = 1000000
local flushCredits = math.floor(newTotal / MICRO_SCALE)
if flushCredits > 0 then
  redis.call('DECRBY', KEYS[1], flushCredits * MICRO_SCALE)
end

local remainder = newTotal - (flushCredits * MICRO_SCALE)
return {flushCredits, remainder}
```

**Flow per tool call:**
```
1. Execute Lua script with `microCredits` + `idempotencyKey`
2. Script returns `flushCredits` and `newRemainderMicroCredits`
3. If `flushCredits > 0`: `syncToolCreditUsage(uid, flushCredits)` once
4. If `flushCredits = 0`: no credit deduction (still accumulating)
```

### 3.4 Discount Rules Engine (M2, deferred)

To support evolving pricing campaigns (for example first-month free, Google Docs half-price), discount logic should be data-driven and shared by all billing paths. This section is deferred to M2.

#### Rule model

Add a new table:

```sql
CREATE TABLE IF NOT EXISTS tool_billing_promotion (
  pk UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key TEXT,                         -- e.g. 'composio' (nullable for global rules)
  inventory_key TEXT,                        -- dynamic tool inventory key (e.g. 'fal_image'), nullable
  toolset_key TEXT,                          -- oauth/config toolset key (e.g. 'googledocs'), nullable
  tool_name TEXT,                            -- nullable for toolset-level rules
  user_segment TEXT,                         -- nullable (e.g. 'refly_plus')
  rule_type TEXT NOT NULL,                   -- 'percentage_off' | 'fixed_off_credits' | 'override_price' | 'free'
  rule_value NUMERIC(12, 6),                 -- percentage or fixed value; null for 'free'
  priority INT NOT NULL DEFAULT 100,         -- lower number = higher priority
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_billing_promotion_lookup
  ON tool_billing_promotion (
    provider_key, inventory_key, toolset_key, tool_name, enabled, start_at, end_at
  );
```

#### Billing pipeline order

1. Resolve base cost:
   - Composio: provider plan + tier (`standard`/`premium`)
   - Dynamic tool: existing `tool_billing` rule result
2. Resolve applicable promotion rules by scope/time/user (`provider_key`/`inventory_key`/`toolset_key`/`tool_name`)
3. Apply highest-priority rule (or explicit stacking policy)
4. Clamp final cost to `>= 0`
5. If final cost is `0`, skip accumulator/credit deduction
6. If final cost `> 0`, proceed with existing charge flow

#### Rule examples

```sql
-- Example A: Google Docs half price
INSERT INTO tool_billing_promotion
  (provider_key, toolset_key, rule_type, rule_value, priority, start_at, end_at, enabled)
VALUES
  ('composio', 'googledocs', 'percentage_off', 0.5, 50, NOW(), NULL, true);

-- Example B: First month free for twitter (segment-based)
INSERT INTO tool_billing_promotion
  (provider_key, toolset_key, user_segment, rule_type, priority, start_at, end_at, enabled)
VALUES
  ('composio', 'twitter', 'new_user_first_30d', 'free', 10, NOW(), NULL, true);

-- Example C: Dynamic tool discount (Fal Image 20% off)
INSERT INTO tool_billing_promotion
  (inventory_key, rule_type, rule_value, priority, start_at, end_at, enabled)
VALUES
  ('fal_image', 'percentage_off', 0.2, 40, NOW(), NULL, true);
```

#### Backward compatibility

- Existing `FREE_TOOLSET_KEYS` logic can remain as an initial compatibility layer.
- Existing dynamic billing (`tool_billing`) remains unchanged for base-price calculation.
- Recommended migration path: move hardcoded free/discount rules into `tool_billing_promotion`, then keep code logic generic.

---

## Phase 4: Fix Composio Service

### 4.1 Replace `parseFloat` with JSON parsing + tier resolution

**File:** `apps/api/src/modules/tool/composio/composio.service.ts` (lines 371-394)

**Current code (broken):**
```typescript
const creditCost = inventory?.creditBilling
  ? Number.parseFloat(inventory.creditBilling) : 3;
```

**New logic:**
```
1. Try JSON.parse(creditBilling)
2. If object has 'tier' properties → new format:
   - Set creditBillingMap = parsed object
   - Set creditCost = 0 (sentinel for "use provider billing")
3. If not → legacy format:
   - parseFloat() as before (backward compatible)
4. If no creditBilling:
   - Use legacy behavior (`3`) in code path
   - Operational requirement: migration step 1.2(5) must backfill all Composio `external_oauth` rows with `_default` tier, so Composio should not rely on null here
```

### 4.2 Pass `creditBillingMap` into `ToolCreationContext`

The `toolCreateContext` object gets the new optional field:
```typescript
const toolCreateContext: ToolCreationContext = {
  connectedAccountId,
  authType,
  creditCost,
  creditBillingMap,  // NEW: per-action tier map
  toolsetType: toolset.type,
  toolsetKey: toolset.toolset?.key ?? '',
  toolsetName: inventory?.name ?? toolset.name,
};
```

### 4.3 Pass `creditBillingMap` into `ComposioPostHandlerInput`

In `createStructuredTool()` (~line 679), add `creditBillingMap` to the post-handler input.

---

## Phase 5: Update Post-Handler

### 5.1 Extend `ComposioPostHandlerInput`

**File:** `apps/api/src/modules/tool/handlers/post/post.interface.ts`

```typescript
export interface ComposioPostHandlerInput extends PostHandlerInput {
  toolsetName?: string;
  creditCost?: number;
  creditBillingMap?: Record<string, { tier: 'standard' | 'premium' }>;  // NEW
  fileNameTitle?: string;
}
```

### 5.2 Update `ComposioToolPostHandlerService.process()`

**File:** `apps/api/src/modules/tool/handlers/post/composio-post.service.ts` (lines 212-232)

Branch billing logic:
```
If creditBillingMap exists AND creditCost === 0:
  → New provider billing path (processProviderBilling)
Else:
  → Legacy flat-rate billing (unchanged, backward compatible)
```

### 5.3 Add `processProviderBilling()` method

New private method:
1. Resolve action tier from `creditBillingMap[toolName]` or `creditBillingMap['_default']`
2. Get provider config via `billingService.getProviderBillingConfig('composio')`
3. Calculate fractional cost via `billingService.calculateComposioCreditCost(config, tier)`
4. Delegate to `billingService.processComposioBilling()` (accumulator path)
5. If provider config is missing: fail-closed (no charge) + error log + alert; do not fall back to legacy 3 credits

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| **M1 Scope (this PR)** |  |  |
| `apps/api/prisma/schema.prisma` | ADD model | `ToolProviderBilling` model |
| `apps/api/prisma/migrations/.../migration.sql` | NEW file | Migration + seed data |
| `packages/openapi-schema/schema.yml` | MODIFY | Add `creditBillingMap` to `ToolCreationContext` |
| `packages/openapi-schema/src/types.gen.ts` | REGENERATE | Auto-generated from schema.yml |
| `apps/api/src/modules/tool/billing/billing.dto.ts` | MODIFY | Add `ProviderBillingConfig`, `ProcessComposioBillingOptions` |
| `apps/api/src/modules/tool/billing/billing.service.ts` | MODIFY | Provider cache, accumulator, `processComposioBilling()` |
| `apps/api/src/modules/tool/composio/composio.service.ts` | MODIFY | Fix `parseFloat` → JSON.parse + tier resolution |
| `apps/api/src/modules/tool/handlers/post/post.interface.ts` | MODIFY | Add `creditBillingMap` to `ComposioPostHandlerInput` |
| `apps/api/src/modules/tool/handlers/post/composio-post.service.ts` | MODIFY | Add provider billing path + `processProviderBilling()` |
| **M2 Scope (follow-up)** |  |  |
| `apps/api/prisma/schema.prisma` | ADD model | `ToolBillingPromotion` model |
| `apps/api/prisma/migrations/.../migration.sql` | NEW file | Promotion table migration |
| `apps/api/src/modules/tool/billing/billing.service.ts` | MODIFY | Promotion matching + application |

---

## Backward Compatibility

| Scenario | Behavior |
|----------|----------|
| Existing toolsets with numeric `creditBilling` (e.g., `fal_audio`) | `JSON.parse()` succeeds, no `tier` property found → falls back to `parseFloat()` → works as before |
| Composio OAuth toolsets with no `creditBilling` (null) | Treated as migration/data issue; migration backfill should prevent this state |
| Non-Composio toolsets with no `creditBilling` (null) | Defaults to 3 credits → legacy behavior preserved |
| Non-Composio toolsets | Completely unaffected — they use `ToolBilling` table / `billing-calculation.ts` path |
| `FREE_TOOLSET_KEYS` (twitter, instagram, etc.) | `processComposioBilling` checks this before accumulation → still free for qualifying Refly Plus subscribers |

---

## Edge Cases

| Case | Handling |
|------|----------|
| Redis restart / data loss | Users lose at most 0.97 credits of accumulated charges (~$0.008). Acceptable. |
| User deletion | Redis keys auto-expire via 24h TTL. Orphaned keys are harmless. |
| Concurrent calls | Lua + idempotency guarantees no duplicate charge for same idempotency key. |
| Provider config missing | Fail-closed (`0` charge) with error log + alert; no legacy 3-credit fallback. |
| Unknown action name | Uses `_default` tier from `creditBillingMap`. |

---

## Verification Plan

Runtime verification is the primary acceptance method. Unit tests are secondary.

### A. Required Runtime Evidence

Each test case must provide:

1. Request evidence: API/tool call input and returned `resultId`/`version`
2. Server log evidence: billing decision logs for the same `uid` + `toolsetKey` + `toolName` + `resultId`
3. DB evidence: `tool_call_results` and `credit_usages` records consistent with expected charge

### B. Log / DB Query Templates

```bash
# Example log search (adapt path/container to environment)
rg -n "Billing processed|dynamic billing|legacy billing|discount|provider billing|composio" /var/log/refly/api*.log

# Example: if running in Docker
docker logs <api-container> 2>&1 | rg "Billing processed|dynamic billing|legacy billing|discount|provider billing|composio"
```

```sql
-- Find tool execution evidence
SELECT result_id, version, uid, toolset_id, tool_name, status, created_at
FROM tool_call_results
WHERE uid = :uid
ORDER BY created_at DESC
LIMIT 50;

-- Find credit usage evidence for same result/version
SELECT usage_id, uid, amount, due_amount, usage_type, action_result_id, version, description, created_at
FROM credit_usages
WHERE uid = :uid
  AND action_result_id = :result_id
  AND version = :version
ORDER BY created_at DESC;

-- Provider plan evidence
SELECT provider_key, plan, standard_rate_per_1k, premium_rate_per_1k, margin, active
FROM tool_provider_billing
WHERE provider_key = 'composio'
ORDER BY updated_at DESC;

-- Toolset tier config evidence
SELECT key, type, credit_billing, updated_at
FROM toolset_inventory
WHERE key IN ('twitter','googledocs','googledrive','gmail','github','reddit','notion');

-- Promotion evidence
SELECT provider_key, inventory_key, toolset_key, tool_name, user_segment, rule_type, rule_value, priority, enabled, start_at, end_at
FROM tool_billing_promotion
WHERE enabled = true
ORDER BY priority ASC, updated_at DESC;
```

### C. Runtime Test Matrix (log + DB validated)

| ID | Scenario | Trigger | Required Log Evidence | Required DB Evidence |
|----|----------|---------|-----------------------|----------------------|
| RT-001 | Composio standard billing | Call Twitter standard action | shows provider-billing path + resolved tier `standard` + computed base/final cost | `tool_call_results` row exists; `credit_usages.amount` reflects fractional accumulation behavior (no flat 3 credit per call) |
| RT-002 | Composio premium billing | Call premium-tagged Composio action | shows tier `premium` and higher base cost than standard | credit usage growth rate matches premium formula |
| RT-003 | Unknown action tier fallback | Call action not explicitly mapped | log shows `_default` tier fallback | billed as `_default` tier, not error path |
| RT-004 | First-month free (M1 path) | Eligible user calls free campaign toolset | log shows `FREE_TOOLSET_KEYS`/free-access path and final cost `0` | `tool_call_results` exists; no new `credit_usages` charge for that result |
| RT-005 | Toolset half-price (M2) | `googledocs` action with promotion | log shows promotion rule applied | `credit_usages.amount` equals discounted outcome |
| RT-006 | Dynamic tool discount (M2) | Call dynamic tool (e.g. `fal_image`) with promotion | log shows dynamic billing base then promotion | charge amount reduced vs base dynamic cost |
| RT-007 | Legacy compatibility numeric billing | Run tool with numeric `credit_billing` | log shows legacy path selected | charged amount equals legacy calculation |
| RT-008 | Missing provider config | Temporarily disable active composio config in test env | error log indicates fail-closed billing path + alert emission | no credit usage charge row for that result |
| RT-009 | Plan switch + cache refresh | Switch active plan to `serious_business`; wait TTL/refresh | log shows plan/config reload | subsequent charges use new rate values |
| RT-010 | Accumulator threshold flush | Execute repeated standard calls crossing 1 credit | logs show accumulator increment and flush event | single integer charge recorded when threshold crossed; remainder retained |
| RT-011 | Concurrency around threshold | Fire concurrent requests near threshold | logs show no duplicate flush anomalies beyond policy | no unexpected extra duplicate `credit_usages` entries for same threshold event |
| RT-012 | Migration idempotency | Run migration twice in staging | migration logs show no duplicate key errors | toolset/provider/promotion tables remain consistent and deduplicated |

### D. Coverage Mapping to Changed Functions

| Function / Area | Covered By |
|-----------------|------------|
| `getProviderBillingConfig` + cache behavior | RT-009 + provider table query |
| `calculateComposioCreditCost` | RT-001/RT-002 (cost evidence in logs + DB outcome) |
| `processComposioBilling` | RT-001/RT-004/RT-008/RT-010 |
| `accumulateAndFlush` | RT-010/RT-011 |
| `composio.service` JSON parse and legacy fallback | RT-001/RT-007 |
| `composio-post.service` branch logic | RT-001/RT-007/RT-008 |
| Discount engine (`tool_billing_promotion`) | RT-005/RT-006 (M2) |
| Dynamic billing path integration | RT-006 (M2) |

### E. Optional Fast Unit Tests (secondary)

Keep targeted unit tests for formula math and pure helpers, but do not treat them as release sign-off without runtime log+DB evidence above.

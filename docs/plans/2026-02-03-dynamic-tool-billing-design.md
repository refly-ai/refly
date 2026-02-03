# Dynamic Tool Billing Design

**Date:** 2026-02-03
**Status:** Design Approved
**Author:** System Design

## Overview

This document describes the design for a new dynamic billing service that enables more accurate cost calculation for tool execution, reducing overall billing costs through field-level granular pricing.

### Motivation

Current billing system (`ToolMethod.billing`) limitations:
- Only supports simple per-call or per-quantity pricing
- Cannot handle multiple billable fields per tool
- No support for tiered pricing based on field values
- Difficult to bill composite operations (text + images + audio)
- Limited to top-level field access

### Goals

- **Field-level billing**: Calculate costs based on individual request/response fields
- **Tiered pricing**: Different prices for different field values (e.g., image resolution)
- **Multiple categories**: Support text (tokens), image (count), audio (duration), video (future)
- **Array aggregation**: Sum/count items in array fields
- **Multiplier support**: Apply quantity multipliers to base prices
- **Backward compatible**: Fallback to existing `ToolMethod.billing` on errors
- **Performance**: Cached configuration with minimal DB queries

---

## Database Schema

### New `ToolBilling` Table

```prisma
model ToolBilling {
  pk           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  inventoryKey String   @map("inventory_key")
  methodName   String   @map("method_name")
  billingRules Json     @map("billing_rules")  // BillingRule[]
  enabled      Boolean  @default(true)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@unique([inventoryKey, methodName])
  @@index([inventoryKey, methodName], map: "idx_tool_billing_lookup", where: { enabled: true })
  @@map("tool_billing")
}
```

### Migration SQL

```sql
CREATE TABLE IF NOT EXISTS tool_billing (
  pk UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_key TEXT NOT NULL,
  method_name TEXT NOT NULL,
  billing_rules JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tool_billing_unique_method UNIQUE (inventory_key, method_name)
);

CREATE INDEX idx_tool_billing_lookup
  ON tool_billing (inventory_key, method_name)
  WHERE enabled = true;

COMMENT ON TABLE tool_billing IS 'Dynamic billing configuration for tool methods with field-level pricing rules';
```

---

## BillingRule Structure

### TypeScript Interface

```typescript
interface BillingRule {
  // Field identification
  fieldPath: string;              // dataPath format: "prompt", "images[*]", "config.resolution"
  phase: 'input' | 'output';      // Extract from request or response

  // Billing type (additive vs multiplier)
  category?: 'text' | 'image' | 'audio' | 'video';  // Required if NOT multiplier
  isMultiplier?: boolean;         // If true, multiply category totals instead of adding
  applyTo?: string;               // Which category to multiply (required if isMultiplier)

  // Pricing configuration
  pricingTiers?: Array<{
    value: string | number;       // Match this value for tier pricing
    creditsPerUnit: number;       // Credits for this tier
  }>;
  defaultCreditsPerUnit?: number; // Fallback if no tier matches (or base price)
}
```

### Category Calculation Methods

| Category | Unit Calculation | Example |
|----------|------------------|---------|
| **text** | Tokens per million (using `countToken()`) | 1500 tokens → 0.0015 units |
| **image** | Count (array length or 1) | 3 images → 3 units |
| **audio** | Duration in seconds | 12.5s → 12.5 units |
| **video** | TBD (future implementation) | - |

### Field Path Format

Uses **dataPath** notation (aligned with existing `schema-utils.ts`):
- Simple field: `"prompt"`
- Nested field: `"config.resolution"`
- Array items: `"images[*]"`
- Nested array: `"contents[0].parts[*].text"`

---

## Calculation Logic

### High-Level Flow

```
1. Lookup ToolBilling by (inventoryKey, methodName) from cache
2. If not found OR disabled → fallback to ToolMethod.billing
3. For each billing rule:
   a. Select schema (request_schema or response_schema) based on phase
   b. Validate field exists in schema
   c. Extract value from input/output data using fieldPath
   d. Calculate units based on category
   e. Match pricing tier or use default
   f. Accumulate credits by category
4. Apply multipliers to category totals
5. Sum all categories and return Math.ceil(total)
6. On any error → throw to trigger fallback
```

### Array Aggregation

For array fields like `images[*]` or `parts[*].text`:

| Category | Aggregation Method |
|----------|-------------------|
| text | Concatenate all text values, count tokens once |
| image | Count array length |
| audio | Sum all duration values |

### Multiplier Logic

Multipliers apply **after** category totals are calculated:

```typescript
// Example: num_images=2, image category total=18 credits
// Step 1: Calculate base image price → 18 credits
// Step 2: Apply multiplier → 18 × 2 = 36 credits
```

### Implementation

```typescript
export async function calculateCreditsFromRules(
  rules: BillingRule[],
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  requestSchema: string,
  responseSchema: string,
): Promise<number> {
  // Separate additive rules and multipliers
  const additiveRules = rules.filter(r => !r.isMultiplier);
  const multiplierRules = rules.filter(r => r.isMultiplier);

  // Step 1: Calculate base credits by category
  const creditsByCategory: Record<string, number> = {};

  for (const rule of additiveRules) {
    // Select schema
    const schemaJson = rule.phase === 'input' ? requestSchema : responseSchema;
    const schema = JSON.parse(schemaJson);

    // Validate field exists in schema
    const fieldType = getFieldTypeFromSchema(schema, rule.fieldPath);
    if (!fieldType) {
      throw new Error(`Field ${rule.fieldPath} not found in ${rule.phase} schema`);
    }

    // Extract value
    const source = rule.phase === 'input' ? input : output;
    const value = extractAndAggregateValue(source, rule.fieldPath, rule.category);

    if (value === undefined || value === null) {
      continue; // Skip missing fields
    }

    // Calculate units
    const units = calculateUnits(value, rule.category);

    // Get credits per unit (tier or default)
    let creditsPerUnit = rule.defaultCreditsPerUnit;
    if (rule.pricingTiers?.length > 0) {
      const tier = rule.pricingTiers.find(t => t.value === value);
      if (tier) {
        creditsPerUnit = tier.creditsPerUnit;
      }
    }

    // Add to category total
    const credits = units * creditsPerUnit;
    creditsByCategory[rule.category] = (creditsByCategory[rule.category] || 0) + credits;
  }

  // Step 2: Apply multipliers
  for (const multiplier of multiplierRules) {
    const source = multiplier.phase === 'input' ? input : output;
    const value = get(source, multiplier.fieldPath);

    if (value !== undefined && value !== null) {
      const multiplierValue = Number(value);
      if (creditsByCategory[multiplier.applyTo]) {
        creditsByCategory[multiplier.applyTo] *= multiplierValue;
      }
    }
  }

  // Step 3: Sum all categories
  const totalCredits = Object.values(creditsByCategory).reduce((sum, c) => sum + c, 0);

  return Math.ceil(totalCredits);
}

function calculateUnits(value: unknown, category: string): number {
  switch (category) {
    case 'text':
      const tokens = countToken(String(value));
      return tokens / 1_000_000; // Per million tokens

    case 'image':
      return Array.isArray(value) ? value.length : 1;

    case 'audio':
      if (Array.isArray(value)) {
        return value.reduce((sum, v) => sum + Number(v), 0);
      }
      return Number(value);

    case 'video':
      return 0; // Future implementation
  }
}

function extractAndAggregateValue(
  data: Record<string, unknown>,
  fieldPath: string,
  category: string,
): unknown {
  // Handle array paths: "contents[0].parts[*].text"
  const arrayMatch = fieldPath.match(/^(.+)\[\*\]\.(.+)$/);

  if (arrayMatch) {
    const [, basePath, fieldName] = arrayMatch;
    const arrayData = get(data, basePath);

    if (!Array.isArray(arrayData)) {
      return null;
    }

    // Extract field from all array items
    const values = arrayData
      .map(item => get(item, fieldName))
      .filter(v => v !== undefined && v !== null);

    if (values.length === 0) {
      return null;
    }

    // Aggregate based on category
    if (category === 'text') {
      return values.join(' '); // Concatenate for token counting
    } else if (category === 'image' || category === 'audio') {
      return values; // Return array for counting/summing
    }
  }

  // Non-array path: simple get
  return get(data, fieldPath);
}

function getFieldTypeFromSchema(schema: any, fieldPath: string): string | null {
  // Convert dataPath to schema path
  const pathParts = fieldPath.split('.');

  let current = schema;

  for (const part of pathParts) {
    // Handle array notation: "images[*]"
    if (part.endsWith('[*]')) {
      const fieldName = part.slice(0, -3);
      current = current.properties?.[fieldName];
      if (!current) return null;
      current = current.items;
      if (!current) return null;
    } else {
      current = current.properties?.[part];
      if (!current) return null;
    }
  }

  return current.type || null;
}
```

---

## Caching Strategy

### SingleFlightCache Pattern

Aligned with existing `ToolInventoryService` pattern:

```typescript
@Injectable()
export class ToolBillingService {
  private readonly logger = new Logger(ToolBillingService.name);
  private billingCache: SingleFlightCache<Map<string, BillingRule[]>>;

  constructor(private readonly prisma: PrismaService) {
    // 5-minute TTL (same as inventory cache)
    this.billingCache = new SingleFlightCache(
      this.loadAllBillingConfigs.bind(this),
      { ttl: 5 * 60 * 1000 }
    );
  }

  private async loadAllBillingConfigs(): Promise<Map<string, BillingRule[]>> {
    const billingMap = new Map<string, BillingRule[]>();

    const records = await this.prisma.toolBilling.findMany({
      where: { enabled: true },
      select: {
        inventoryKey: true,
        methodName: true,
        billingRules: true,
      },
    });

    for (const record of records) {
      const key = `${record.inventoryKey}:${record.methodName}`;
      billingMap.set(key, record.billingRules as BillingRule[]);
    }

    this.logger.log(`Loaded ${billingMap.size} tool billing configs`);
    return billingMap;
  }

  async getBillingRules(
    inventoryKey: string,
    methodName: string,
  ): Promise<BillingRule[] | undefined> {
    try {
      const billingMap = await this.billingCache.get();
      return billingMap.get(`${inventoryKey}:${methodName}`);
    } catch (error) {
      this.logger.error(`Failed to get billing rules: ${error.message}`);
      return undefined; // Triggers fallback
    }
  }

  async refresh(): Promise<void> {
    this.logger.log('Refreshing tool billing cache');
    const billingMap = await this.loadAllBillingConfigs();
    this.billingCache.set(billingMap);
  }
}
```

### Benefits

- **Single DB query** loads all billing configs on startup
- **O(1) lookup** per tool execution (in-memory Map)
- **Single-flight deduplication** prevents concurrent load stampedes
- **No Redis dependency** - simpler infrastructure
- **5-minute TTL** - balances freshness vs load

---

## Service Integration

### BillingService Update

```typescript
@Injectable()
export class BillingService {
  constructor(
    private readonly toolBillingService: ToolBillingService,
    // ... existing dependencies
  ) {}

  async processBilling(params: ProcessBillingParams): Promise<number> {
    const { inventoryKey, methodName, input, output, requestSchema, responseSchema } = params;

    try {
      // 1. Try new ToolBilling rules first
      const rules = await this.toolBillingService.getBillingRules(inventoryKey, methodName);

      if (rules && rules.length > 0) {
        this.logger.debug(`Using ToolBilling rules for ${inventoryKey}:${methodName}`);
        return await calculateCreditsFromRules(
          rules,
          input,
          output,
          requestSchema,
          responseSchema
        );
      }
    } catch (error) {
      // Any error → log and fall through to legacy billing
      this.logger.warn(
        `ToolBilling calculation failed for ${inventoryKey}:${methodName}, ` +
        `falling back to legacy: ${error.message}`
      );
    }

    // 2. Fallback to legacy ToolMethod.billing
    if (params.billingConfig?.enabled) {
      this.logger.debug(`Using legacy billing for ${inventoryKey}:${methodName}`);
      return calculateCredits(params.billingConfig, input);
    }

    // 3. Default
    return 1;
  }
}
```

### Fallback Strategy

**Trigger fallback on ANY error:**
- `ToolBilling` record not found
- Schema validation fails
- Field extraction fails
- Calculation throws exception
- Cache lookup fails

**Production stability over strict errors** - better to charge old price than fail billing.

---

## Audio Buffer Duration Extraction

### TODO: Fish Audio Support

For tools that return audio buffers (like `fish_audio`), duration must be extracted from binary data.

**Implementation in `resource.service.ts`:**

```typescript
import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

interface MediaMetadata {
  duration?: number;
  format?: string;
  bitrate?: number;
}

private async extractAudioMetadata(buffer: Buffer): Promise<MediaMetadata> {
  let tempFilePath: string | null = null;

  try {
    // Write buffer to temp file
    const timestamp = Date.now();
    tempFilePath = path.join(os.tmpdir(), `audio-metadata-${timestamp}.tmp`);
    await fs.writeFile(tempFilePath, buffer);

    // Run ffprobe
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format "${tempFilePath}"`
    );

    const metadata = JSON.parse(stdout);
    const duration = parseFloat(metadata.format?.duration || '0');

    return {
      duration: duration > 0 ? duration : undefined,
      format: metadata.format?.format_name,
      bitrate: parseInt(metadata.format?.bit_rate || '0') / 1000,
    };

  } catch (error) {
    this.logger.warn(`Failed to extract audio metadata: ${error.message}`);
    return {};

  } finally {
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => {});
    }
  }
}

private async uploadBufferResource(...): Promise<DriveFile & { metadata?: MediaMetadata }> {
  // ... existing code ...

  // Extract audio metadata if audio file
  let mediaMetadata: MediaMetadata | undefined;
  if (mimetype?.startsWith('audio/')) {
    mediaMetadata = await this.extractAudioMetadata(buffer);
    this.logger.debug(
      `Extracted audio metadata for ${filename}: duration=${mediaMetadata.duration}s`
    );
  }

  // ... upload and create drive file ...

  return {
    ...driveFile,
    ...(mediaMetadata?.duration ? { metadata: mediaMetadata } : {}),
  };
}
```

**Response structure update:**

```typescript
// In persistOutputResources()
if (Buffer.isBuffer(response.data)) {
  const uploadResult = await this.writeResource(response.data, fileNameTitle, undefined);
  if (uploadResult) {
    return {
      ...response,
      data: {
        ...uploadResult,
        // Extract duration to top level for billing
        ...(uploadResult.metadata?.duration
          ? { duration_seconds: uploadResult.metadata.duration }
          : {}
        ),
      },
      files: [uploadResult],
    };
  }
}
```

**Dependencies:**
- Add `ffmpeg`/`ffprobe` to Docker image
- Add to local dev setup instructions

---

## Configuration Examples

### Example 1: Nano Banana Pro (Image Generation)

**Request Schema Fields:**
- `contents[0].parts[*].text` - Text prompts
- `contents[0].parts[*].inline_data` - Reference images
- `generationConfig.imageConfig.imageSize` - Resolution tier ("1K", "2K", "4K")

**ToolBilling Configuration:**

```json
{
  "inventoryKey": "nano_banana_pro",
  "methodName": "generate",
  "enabled": true,
  "billingRules": [
    {
      "fieldPath": "generationConfig.imageConfig.imageSize",
      "phase": "input",
      "category": "image",
      "pricingTiers": [
        { "value": "1K", "creditsPerUnit": 10 },
        { "value": "2K", "creditsPerUnit": 20 },
        { "value": "4K", "creditsPerUnit": 40 }
      ],
      "defaultCreditsPerUnit": 10
    },
    {
      "fieldPath": "contents[0].parts[*].text",
      "phase": "input",
      "category": "text",
      "defaultCreditsPerUnit": 5
    },
    {
      "fieldPath": "contents[0].parts[*].inline_data",
      "phase": "input",
      "category": "image",
      "defaultCreditsPerUnit": 3
    }
  ]
}
```

**Example Calculation:**

Input:
```json
{
  "contents": [{
    "parts": [
      { "text": "Generate a sunset" },
      { "text": "with mountains" },
      { "inline_data": { "data": "df-abc123" } },
      { "inline_data": { "data": "df-xyz789" } }
    ]
  }],
  "generationConfig": { "imageConfig": { "imageSize": "2K" } }
}
```

Calculation:
- imageSize="2K" tier → 1 × 20 = **20 credits**
- text (concatenated 6 tokens) → (6/1M) × 5 ≈ **0 credits**
- inline_data count (2 images) → 2 × 3 = **6 credits**
- **Total: 26 credits**

---

### Example 2: FAL Image (Flux Pro)

**Request Schema Fields:**
- `prompt` - Text prompt
- `image_size` - Resolution enum
- `num_images` - Quantity multiplier

**ToolBilling Configuration:**

```json
{
  "inventoryKey": "fal_image",
  "methodName": "flux_pro",
  "enabled": true,
  "billingRules": [
    {
      "fieldPath": "prompt",
      "phase": "input",
      "category": "text",
      "defaultCreditsPerUnit": 2
    },
    {
      "fieldPath": "image_size",
      "phase": "input",
      "category": "image",
      "pricingTiers": [
        { "value": "square", "creditsPerUnit": 10 },
        { "value": "square_hd", "creditsPerUnit": 15 },
        { "value": "portrait_4_3", "creditsPerUnit": 12 },
        { "value": "landscape_4_3", "creditsPerUnit": 12 },
        { "value": "landscape_16_9", "creditsPerUnit": 18 }
      ],
      "defaultCreditsPerUnit": 10
    },
    {
      "fieldPath": "num_images",
      "phase": "input",
      "isMultiplier": true,
      "applyTo": "image"
    }
  ]
}
```

**Example Calculation:**

Input:
```json
{
  "prompt": "A futuristic cityscape at sunset with flying cars",
  "image_size": "landscape_16_9",
  "num_images": 2
}
```

Calculation:
- prompt (9 tokens) → (9/1M) × 2 ≈ **0 credits**
- image_size="landscape_16_9" tier → 1 × 18 = **18 credits**
- num_images multiplier → 18 × 2 = **36 credits**
- **Total: 36 credits**

---

### Example 3: FAL Audio (Text-to-Speech)

**ToolBilling Configuration:**

```json
{
  "inventoryKey": "fal_audio",
  "methodName": "text_to_speech",
  "enabled": true,
  "billingRules": [
    {
      "fieldPath": "text",
      "phase": "input",
      "category": "text",
      "defaultCreditsPerUnit": 3
    },
    {
      "fieldPath": "model",
      "phase": "input",
      "category": "audio",
      "pricingTiers": [
        { "value": "tts-1", "creditsPerUnit": 5 },
        { "value": "tts-1-hd", "creditsPerUnit": 10 }
      ],
      "defaultCreditsPerUnit": 5
    },
    {
      "fieldPath": "duration_seconds",
      "phase": "output",
      "category": "audio",
      "defaultCreditsPerUnit": 2
    }
  ]
}
```

**Example Calculation:**

Input: `{ "text": "Welcome to our platform...", "model": "tts-1-hd" }`
Output: `{ "audio_url": "https://...", "duration_seconds": 12.5 }`

Calculation:
- text (25 tokens) → (25/1M) × 3 ≈ **0 credits**
- model="tts-1-hd" tier → 1 × 10 = **10 credits**
- duration_seconds (output) → 12.5 × 2 = **25 credits**
- **Total: 35 credits**

---

### Example 4: Fish Audio (Buffer Response)

**TODO: Requires ffprobe integration**

```json
{
  "inventoryKey": "fish_audio",
  "methodName": "text_to_speech",
  "enabled": true,
  "billingRules": [
    {
      "fieldPath": "text",
      "phase": "input",
      "category": "text",
      "defaultCreditsPerUnit": 3
    },
    {
      "fieldPath": "duration_seconds",
      "phase": "output",
      "category": "audio",
      "defaultCreditsPerUnit": 2
    }
  ]
}
```

Flow:
1. Fish audio returns audio buffer
2. `uploadBufferResource()` extracts duration using ffprobe
3. Response includes `duration_seconds: 12.5`
4. Billing calculates: 12.5 × 2 = 25 credits

---

## Migration Strategy

### Phase 1: Deploy Schema (Week 1)

**Actions:**
- Run Prisma migration to create `tool_billing` table
- Deploy code with `ToolBillingService` (no data yet)
- All tools continue using legacy `ToolMethod.billing`

**Validation:**
- Verify table created successfully
- Confirm cache initialization works
- No production impact

---

### Phase 2: Configure High-Priority Tools (Week 2)

**Actions:**
- Add `ToolBilling` records for:
  - `nano_banana_pro:generate`
  - `fal_image:flux_pro`
  - `fal_audio:text_to_speech`
- Monitor logs for calculation errors
- Compare credit amounts with legacy billing

**Validation:**
- Check billing calculation logs
- Verify no fallback errors
- Confirm credit amounts are accurate

---

### Phase 3: Gradual Migration (Weeks 3-4)

**Actions:**
- Migrate remaining tools with custom billing needs
- Keep `ToolMethod.billing` as fallback for 30 days
- Monitor error rates and fallback usage metrics

**Metrics to track:**
- Fallback usage percentage
- Calculation error rate
- Average credit difference (new vs old)

---

### Phase 4: Deprecation (Month 2+)

**Actions:**
- Once stable (< 1% fallback usage), mark `ToolMethod.billing` as deprecated
- Add warning logs for tools still using legacy billing
- Plan removal of legacy code in future version

---

## Implementation Checklist

### Core Infrastructure

- [ ] Create Prisma migration for `tool_billing` table
- [ ] Add `BillingRule` TypeScript interface to `@refly/openapi-schema`
- [ ] Implement `ToolBillingService` with SingleFlightCache
- [ ] Add `calculateCreditsFromRules()` to `/apps/api/src/modules/tool/utils/billing.ts`
- [ ] Add `extractAndAggregateValue()` helper function
- [ ] Add `getFieldTypeFromSchema()` helper function
- [ ] Add `calculateUnits()` helper function
- [ ] Update `BillingService.processBilling()` with new logic and fallback
- [ ] Add proper error logging for debugging

### Audio Buffer Support (TODO)

- [ ] Add `ffmpeg`/`ffprobe` to Docker image dependencies
- [ ] Add `ffprobe` to local dev setup documentation
- [ ] Implement `extractAudioMetadata()` in `resource.service.ts`
- [ ] Update `uploadBufferResource()` to call `extractAudioMetadata()` for audio files
- [ ] Add `duration_seconds` to response structure in `persistOutputResources()`
- [ ] Test with fish_audio tool

### Initial Configuration Data

- [ ] Create seed migration for Nano Banana Pro billing config
- [ ] Create seed migration for FAL Image billing config
- [ ] Create seed migration for FAL Audio billing config
- [ ] Create seed migration for Fish Audio billing config (after ffprobe support)

### Testing

- [ ] Unit tests for `calculateUnits()` (all categories)
- [ ] Unit tests for `extractAndAggregateValue()` (arrays, nested paths)
- [ ] Unit tests for `getFieldTypeFromSchema()` (nested fields, arrays)
- [ ] Unit tests for `calculateCreditsFromRules()` (tiered pricing)
- [ ] Unit tests for multiplier logic
- [ ] Integration test: Nano Banana with multiple fields
- [ ] Integration test: FAL Image with multiplier
- [ ] Integration test: Audio with duration
- [ ] Integration test: Fallback scenarios
- [ ] Integration test: Schema validation errors

### Monitoring & Validation

- [ ] Add metrics for billing calculation paths (new vs fallback)
- [ ] Add logging for fallback triggers
- [ ] Add alerts for high fallback rates
- [ ] Monitor credit amount changes after rollout
- [ ] Create admin dashboard for billing config verification

### Documentation

- [ ] Update API documentation with new billing structure
- [ ] Document `BillingRule` schema for toolset developers
- [ ] Create runbook for debugging billing issues
- [ ] Add examples to developer guide

---

## Key Design Decisions

### 1. Why separate table vs JSON field in ToolMethod?

**Decision:** Separate `ToolBilling` table

**Rationale:**
- Cleaner separation of concerns
- Easier to query/audit billing configs
- Can version/track changes independently
- Doesn't bloat existing `ToolMethod` table

### 2. Why SingleFlightCache vs Redis?

**Decision:** SingleFlightCache (in-memory)

**Rationale:**
- Aligned with existing `ToolInventoryService` pattern
- Simpler infrastructure (no Redis dependency)
- Single DB query loads all configs
- 5-minute TTL balances freshness vs load
- Billing configs change infrequently

### 3. Why fallback on any error vs fail fast?

**Decision:** Fallback on any error

**Rationale:**
- Production stability over strict correctness
- Better to charge old price than fail billing entirely
- Gradual migration path with safety net
- Errors get logged for investigation

### 4. Why schema validation vs direct data access?

**Decision:** Schema validation first

**Rationale:**
- Ensures field actually exists in contract
- Provides type information for validation
- Fails fast if schema changes break billing
- Aligns with existing schema-utils patterns

### 5. Why multipliers as separate flag vs separate rule type?

**Decision:** `isMultiplier` flag on BillingRule

**Rationale:**
- Single unified structure
- Easier to serialize/deserialize
- Simpler admin UX (one rule list)
- Clear separation in calculation logic

---

## Future Enhancements

### Video Category Support

**When needed:**
- Add video duration extraction (similar to audio)
- Support multiple billing factors (resolution × duration)
- Handle tier combinations (e.g., 4K + 60s)

### Conditional Rules

**Example use case:** Different prices based on user subscription tier

```typescript
interface BillingRule {
  // ... existing fields ...
  conditions?: {
    subscriptionTier?: string;
    userRegion?: string;
  };
}
```

### Usage Analytics

**Track per-tool profitability:**
- Actual cost from provider APIs
- Revenue from credit charges
- Profit margin per tool/method

### Dynamic Pricing Adjustments

**Based on real-time factors:**
- Provider API cost changes
- Peak/off-peak pricing
- User loyalty discounts

---

## Appendix: Related Files

### Key Implementation Files

| File | Purpose |
|------|---------|
| `/apps/api/prisma/schema.prisma` | Database schema definition |
| `/apps/api/src/modules/tool/billing/tool-billing.service.ts` | New billing service |
| `/apps/api/src/modules/tool/billing/billing.service.ts` | Integration point |
| `/apps/api/src/modules/tool/utils/billing.ts` | Calculation utilities |
| `/apps/api/src/modules/tool/utils/schema-utils.ts` | Schema traversal |
| `/apps/api/src/modules/tool/resource.service.ts` | Buffer processing |
| `/packages/openapi-schema/src/types.gen.ts` | Type definitions |

### Reference Architecture

| Pattern | Example |
|---------|---------|
| SingleFlightCache | `ToolInventoryService:34-44` |
| Schema traversal | `schema-utils.ts:jsonPointerToDataPath` |
| Resource field collection | `schema-utils.ts:collectResourceFields` |
| Buffer upload | `resource.service.ts:uploadBufferResource` |
| Post-execution handlers | `handler-post.ts:createBasePostHandler` |

---

## Questions & Answers

**Q: What happens if billing calculation takes too long?**
A: Falls back to legacy billing. Can add timeout to calculation if needed.

**Q: Can we change billing rules without code deploy?**
A: Yes, update database directly. Changes take effect within 5 minutes (cache TTL).

**Q: How to handle tools with both input and output billing?**
A: Add multiple rules - some with `phase: "input"`, others with `phase: "output"`.

**Q: What if a field is optional in schema but required for billing?**
A: Calculation skips missing fields. Use `defaultCreditsPerUnit: 0` if free when absent.

**Q: Can one field have multiple pricing dimensions?**
A: Not in current design. Would need separate rules or multi-dimensional tiers.

---

**End of Design Document**

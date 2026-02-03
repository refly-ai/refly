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

Using discriminated union for type safety:

```typescript
/**
 * Additive billing rule - charges based on field value
 */
type AdditiveBillingRule = {
  fieldPath: string;              // dataPath format: "prompt", "images[*]", "config.resolution"
  phase: 'input' | 'output';
  category: 'text' | 'image' | 'audio' | 'video';  // Required
  isMultiplier?: false;           // Explicitly false or undefined
  pricingTiers?: Array<{
    value: string | number;       // Match this value for tier pricing (scalar fields only)
    creditsPerUnit: number;       // Credits for this tier
  }>;
  defaultCreditsPerUnit: number;  // Required - fallback when no tier matches
};

/**
 * Multiplier rule - multiplies category total by field value
 */
type MultiplierBillingRule = {
  fieldPath: string;
  phase: 'input' | 'output';
  isMultiplier: true;             // Required and true
  applyTo: 'text' | 'image' | 'audio' | 'video';  // Category to multiply
  // No category, pricingTiers, or defaultCreditsPerUnit
};

/**
 * Billing rule - either additive or multiplier
 */
type BillingRule = AdditiveBillingRule | MultiplierBillingRule;
```

**Runtime validation:**
- `pricingTiers` forbidden on aggregated fields (containing `[*]`)
- `defaultCreditsPerUnit` required on all additive rules
- Multiplier value must be finite, non-NaN, non-negative number
- Array fields limited to 1000 items for DoS protection

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

**Schema support note:** `getFieldTypeFromSchema()` only supports `properties` + `items`
traversal. Schemas using `$ref`, `oneOf`, or `allOf` are unsupported and should
fail fast with clear errors.

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
5. Sum all categories and return Math.floor(total + 0.5)
6. On any error → throw to trigger fallback
```

### Core Pseudocode

```text
function processBilling(params):
  rules = toolBillingService.getRules(params.inventoryKey, params.methodName)
  if rules empty:
    return legacyBilling(params)

  try:
    total = calculateCreditsFromRules(rules, params)
    return total
  catch:
    return legacyBilling(params)

function calculateCreditsFromRules(rules, params):
  additive = rules where isMultiplier != true
  multipliers = rules where isMultiplier == true

  creditsByCategory = {}

  for rule in additive:
    schema = rule.phase == "input" ? params.requestSchema : params.responseSchema
    if !schemaHasField(schema, rule.fieldPath):
      throw Error("field missing")
    if rule.pricingTiers and isAggregatedPath(rule.fieldPath):
      throw Error("tiers not allowed on aggregated fields")

    value = extractValue(params, rule)
    if value is null:
      continue

    units = calculateUnits(value, rule.category)
    price = matchTier(rule.pricingTiers, value) ?? rule.defaultCreditsPerUnit
    if price is null:
      throw Error("missing defaultCreditsPerUnit")

    creditsByCategory[rule.category] += units * price

  for m in multipliers:
    if !schemaHasField(schemaFor(m), m.fieldPath):
      throw Error("field missing")
    mult = number(getValue(params, m))
    if mult is not null and creditsByCategory[m.applyTo] exists:
      creditsByCategory[m.applyTo] *= mult

  total = sum(creditsByCategory.values)
  return floor(total + 0.5)  // half-up rounding
```

### Array Aggregation

For array fields like `images[*]` or `parts[*].text`:

| Category | Aggregation Method |
|----------|-------------------|
| text | Concatenate all text values, count tokens once |
| image | Count array length |
| audio | Sum all duration values |

**Note:** `pricingTiers` must not be used on aggregated fields. Tiers are only valid for
scalar values (e.g., resolution, model name). Aggregated values should use
`defaultCreditsPerUnit` only.

### Multiplier Logic

Multipliers apply **after** category totals are calculated:

```typescript
// Example: num_images=2, image category total=18 credits
// Step 1: Calculate base image price → 18 credits
// Step 2: Apply multiplier → 18 × 2 = 36 credits
```

**Multiple multipliers on same category:**

When multiple multipliers target the same category, they apply sequentially:

```typescript
// Example:
// Base image price: 10 credits
// num_images=2, quality_factor=1.5
// Result: 10 × 2 × 1.5 = 30 credits
```

**Multiplier validation rules:**
- Must be finite, non-NaN number
- Must be non-negative (≥ 0)
- Zero multiplier results in free execution (logged as warning)
- Fractional multipliers allowed (e.g., 1.5, 0.5)
- If target category has no credits, multiplier is silently skipped

### Rounding Policy

Round to nearest integer using **half-up** rounding:

```typescript
// Examples: 0.0001 -> 0, 0.5 -> 1, 1.01 -> 1, 1.51 -> 2
return Math.floor(totalCredits + 0.5);
```

This avoids charging 1 credit for tiny fractional usage while still rounding
meaningfully for larger totals.

### Implementation

```typescript
interface ProcessBillingParams {
  inventoryKey: string;
  methodName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  requestSchema: string;
  responseSchema: string;
  billingConfig?: BillingConfig;
}

export async function calculateCreditsFromRules(
  rules: BillingRule[],
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  requestSchema: string,
  responseSchema: string,
  logger?: Logger,  // Optional for audit logging
): Promise<number> {
  // Separate additive rules and multipliers
  const additiveRules = rules.filter(r => !r.isMultiplier) as AdditiveBillingRule[];
  const multiplierRules = rules.filter(r => r.isMultiplier) as MultiplierBillingRule[];

  // Step 1: Calculate base credits by category
  const creditsByCategory: Record<string, number> = {};
  const auditLog: any[] = []; // For debugging

  for (const rule of additiveRules) {
    // Select schema
    const schemaJson = rule.phase === 'input' ? requestSchema : responseSchema;
    const schema = JSON.parse(schemaJson);

    // Validate field exists in schema
    const fieldType = getFieldTypeFromSchema(schema, rule.fieldPath);
    if (!fieldType) {
      throw new Error(`Field ${rule.fieldPath} not found in ${rule.phase} schema`);
    }

    // Validate no tiers on aggregated fields
    const isAggregated = rule.fieldPath.includes('[*]');
    if (rule.pricingTiers?.length > 0 && isAggregated) {
      throw new Error(
        `pricingTiers not allowed on aggregated field: ${rule.fieldPath}. ` +
        `Use defaultCreditsPerUnit only.`
      );
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

    // Audit logging
    auditLog.push({
      fieldPath: rule.fieldPath,
      phase: rule.phase,
      category: rule.category,
      units,
      creditsPerUnit,
      credits,
    });
  }

  // Step 2: Apply multipliers
  for (const multiplier of multiplierRules) {
    // Validate field exists in schema
    const schemaJson = multiplier.phase === 'input' ? requestSchema : responseSchema;
    const schema = JSON.parse(schemaJson);
    const fieldType = getFieldTypeFromSchema(schema, multiplier.fieldPath);
    if (!fieldType) {
      throw new Error(`Multiplier field ${multiplier.fieldPath} not found in ${multiplier.phase} schema`);
    }

    const source = multiplier.phase === 'input' ? input : output;
    const value = get(source, multiplier.fieldPath);

    if (value !== undefined && value !== null) {
      const multiplierValue = Number(value);

      // Validate multiplier value
      if (!isFinite(multiplierValue) || isNaN(multiplierValue)) {
        throw new Error(
          `Invalid multiplier value for ${multiplier.fieldPath}: ${value} (must be finite number)`
        );
      }
      if (multiplierValue < 0) {
        throw new Error(
          `Negative multiplier not allowed for ${multiplier.fieldPath}: ${multiplierValue}`
        );
      }
      if (multiplierValue === 0) {
        logger?.warn(
          `Zero multiplier on ${multiplier.fieldPath} results in free execution`
        );
      }

      // Apply multiplier only if category has credits
      if (creditsByCategory[multiplier.applyTo] !== undefined) {
        const before = creditsByCategory[multiplier.applyTo];
        creditsByCategory[multiplier.applyTo] *= multiplierValue;

        auditLog.push({
          fieldPath: multiplier.fieldPath,
          type: 'multiplier',
          applyTo: multiplier.applyTo,
          multiplierValue,
          before,
          after: creditsByCategory[multiplier.applyTo],
        });
      }
      // Silently skip if category not present (no additive rules for it)
    }
  }

  // Step 3: Sum all categories
  const totalCredits = Object.values(creditsByCategory).reduce((sum, c) => sum + c, 0);

  // Half-up rounding
  const finalCredits = Math.floor(totalCredits + 0.5);

  // Debug logging for audit trail
  if (logger) {
    logger.debug({
      creditsByCategory,
      totalCredits,
      finalCredits,
      auditLog,
    });
  }

  return finalCredits;
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
      throw new Error('Video billing not yet implemented');
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

    // DoS protection: limit array size
    const MAX_ARRAY_SIZE = 1000;
    if (arrayData.length > MAX_ARRAY_SIZE) {
      throw new Error(
        `Array too large for billing calculation: ${arrayData.length} items ` +
        `(max ${MAX_ARRAY_SIZE})`
      );
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
    // Handle array notation: "images[*]" or "contents[0]"
    const arrayMatch = part.match(/^(.+)\[(\*|\d+)\]$/);
    if (arrayMatch) {
      const fieldName = arrayMatch[1];
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
- **Change propagation** - DB updates may take up to TTL to apply; use `refresh()` for immediate updates

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
          responseSchema,
          this.logger  // Pass logger for audit trail
        );
      }
    } catch (error) {
      // Any error → log and fall through to legacy billing
      this.logger.warn(
        `ToolBilling calculation failed for ${inventoryKey}:${methodName}, ` +
        `falling back to legacy: ${error.message}`,
        { error, inventoryKey, methodName }
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

**ProcessBillingParams (for clarity)**

```typescript
interface ProcessBillingParams {
  inventoryKey: string;
  methodName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  requestSchema: string;
  responseSchema: string;
  billingConfig?: BillingConfig; // Legacy fallback
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

### Structured Logging (Fallback & Errors)

Include these fields in warning logs for easy monitoring and debugging:
- `inventoryKey`, `methodName`
- `error.type`, `error.message`
- `fallback_reason`
- `new_credits_attempted`, `legacy_credits_used`

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
- **Total: 26 credits** (half-up rounding)

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
- **Total: 36 credits** (half-up rounding)

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
- **Total: 35 credits** (half-up rounding)

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

**Note:** Fish Audio billing should not be enabled in production until ffprobe
integration is implemented or a temporary duration estimation strategy is defined.

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

### Rollback Strategy

If production issues are detected:
- Disable all dynamic configs: `UPDATE tool_billing SET enabled = false`
- All tools immediately fall back to legacy billing
- Revert code deploy if errors persist

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
- [ ] Performance test: large multi-part text inputs (token counting)

### Detailed Test Checklist

**Unit: dataPath parsing & schema validation**
- [ ] `contents[0].parts[*].text` resolves in schema (numeric index + wildcard mix)
- [ ] `contents[*].parts[0].text` resolves in schema
- [ ] `images[*]` resolves to array item type
- [ ] Missing field returns null and triggers fallback
- [ ] Unsupported schema structures (`$ref`, `oneOf`, `allOf`) explicitly reject with clear error

**Unit: value extraction & aggregation**
- [ ] `contents[0].parts[*].text` concatenates text in order
- [ ] `images[*]` returns array for counting
- [ ] `audio_durations[*]` returns array for summing
- [ ] Empty array returns null (skips rule)
- [ ] Null/undefined values in array are filtered out
- [ ] Array with >1000 items throws DoS protection error
- [ ] Array with exactly 1000 items works correctly

**Unit: tier pricing & defaults**
- [ ] Tier matches exact scalar value and overrides default
- [ ] Tier miss falls back to `defaultCreditsPerUnit`
- [ ] Missing `defaultCreditsPerUnit` throws and forces fallback
- [ ] Tier on aggregated field (with `[*]`) throws validation error
- [ ] Tier on scalar field works correctly

**Unit: multiplier rules**
- [ ] Multiplier uses numeric conversion and multiplies category total
- [ ] Non-numeric multiplier value (NaN) throws validation error
- [ ] Infinite multiplier value throws validation error
- [ ] Negative multiplier throws validation error
- [ ] Zero multiplier works but logs warning
- [ ] Fractional multiplier (1.5) works correctly
- [ ] Multiplier on missing category (no additive rules) silently skips
- [ ] Multiplier field missing in schema throws and forces fallback

**Unit: rounding policy**
- [ ] totalCredits = 0 returns 0
- [ ] totalCredits = 0.0001 returns 0
- [ ] totalCredits = 0.49 returns 0
- [ ] totalCredits = 0.5 returns 1
- [ ] totalCredits = 1.0 returns 1
- [ ] totalCredits = 1.01 returns 1
- [ ] totalCredits = 1.51 returns 2

**Integration: rule combinations**
- [ ] text + image + audio additive rules combined correctly
- [ ] Additive rules then multiplier applied in correct order
- [ ] Multiple multipliers on same category applied sequentially
- [ ] Multiple categories with independent multipliers do not cross-affect

**Integration: fallback paths**
- [ ] No ToolBilling record → legacy billing
- [ ] ToolBilling disabled → legacy billing
- [ ] Schema validation failure → legacy billing
- [ ] Extraction failure (bad path) → legacy billing
- [ ] Calculation error (NaN) → legacy billing

**Integration: tool-specific examples**
- [ ] Nano Banana Pro config (text + image_size tier + inline images)
- [ ] FAL Image config (image_size tier + num_images multiplier)
- [ ] FAL Audio config (model tier + duration_seconds output)
- [ ] Fish Audio buffer flow (duration extracted → output field billing)

**Monitoring/validation smoke checks**
- [ ] New vs legacy credit delta logged for seeded tools
- [ ] Fallback rate per `inventoryKey:methodName` emitted
- [ ] High fallback rate triggers alert in staging

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

### 6. Why half-up rounding?

**Decision:** Round to the nearest integer using **half-up** rounding.

**Rationale:**
- Avoids charging 1 credit for tiny fractional usage
- Keeps pricing predictable at whole-credit granularity
- Simple to reason about and document

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

## Risks & Mitigations

### ✅ Mitigated in Design

1. **~~Tier matching on aggregated fields~~ - FIXED**
   - **Mitigation:** Runtime validation throws error if `pricingTiers` used on fields containing `[*]`

2. **~~Multiplier rules bypass schema validation~~ - FIXED**
   - **Mitigation:** Multiplier fields validated against schema; throws if missing

3. **~~Missing `defaultCreditsPerUnit` yields `NaN`~~ - FIXED**
   - **Mitigation:** TypeScript requires it on `AdditiveBillingRule`; runtime throws if undefined

4. **~~Optional `category` causes hidden errors~~ - FIXED**
   - **Mitigation:** TypeScript requires `category` on `AdditiveBillingRule`; runtime validates presence

5. **~~`video` category silently returns 0~~ - FIXED**
   - **Mitigation:** Throws error when `video` category used (not yet implemented)

6. **~~NaN/Infinite multiplier values~~ - FIXED**
   - **Mitigation:** Runtime validates multiplier is finite, non-NaN number; throws otherwise

7. **~~Negative multiplier values~~ - FIXED**
   - **Mitigation:** Runtime validates multiplier ≥ 0; throws on negative values

8. **~~Large array DoS attack~~ - FIXED**
   - **Mitigation:** Array size limited to 1000 items; throws on larger arrays

### ⚠️ Known Limitations

9. **Zero multiplier results in free execution**
   - **Risk:** `num_images=0` → 0 credits charged
   - **Mitigation:** Logged as warning for audit trail; may be intentional behavior

10. **`contents[0]` numeric index behavior**
   - **Risk:** `[0]` and `[*]` both map to `.items` in schema validation; behavior differs in extraction
   - **Mitigation:** Lodash `get()` handles both correctly; tested in integration tests

11. **Half-up rounding allows free tiny usage**
   - **Risk:** Very small usage (< 0.5 credits) rounds to 0
   - **Mitigation:** Documented behavior; acceptable for negligible costs

12. **Schema parser doesn't support `$ref`/`oneOf`/`allOf`**
   - **Risk:** Valid fields appear missing; config falls back
   - **Mitigation:** Documented limitation; fail fast with clear error message

13. **Multiplier silently skips if category absent**
   - **Risk:** Multiplier on category with no additive rules does nothing
   - **Mitigation:** Intentional design; allows flexible config without errors

14. **No transaction safety for concurrent billing**
   - **Risk:** Multiple concurrent calls might race on cache load
   - **Mitigation:** SingleFlightCache prevents stampede; single load shared by concurrent calls

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

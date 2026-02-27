/**
 * Dynamic Tool Billing - Core Calculation Logic
 *
 * Implements field-level granular pricing for tool execution with:
 * - Text billing (token-based with USD pricing)
 * - Image billing (count-based with tiered pricing)
 * - Audio billing (duration-based)
 * - Array aggregation and multiplier rules
 */

import { Logger } from '@nestjs/common';
import { get } from 'lodash';
import { countToken } from '@refly/utils/token';
import type {
  ToolBillingConfig,
  AdditiveBillingRule,
  MultiplierBillingRule,
  BillingCategory,
} from '@refly/openapi-schema';

/**
 * USD to Credits conversion rate
 * Configurable via USD_TO_CREDITS_RATE environment variable (default: 120)
 */
const USD_TO_CREDITS_RATE = (() => {
  const rate = Number(process.env.USD_TO_CREDITS_RATE);
  if (!process.env.USD_TO_CREDITS_RATE || !Number.isFinite(rate) || rate <= 0) {
    return 120; // Default rate
  }
  return rate;
})();

/**
 * Strict decimal-only regex for numeric coercion in tier matching.
 * Matches: "10", "10.5", "-3.14", "0.001"
 * Rejects: "0x1A", "", "true", " ", "1e5"
 */
const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

/**
 * Compare a runtime value against a tier value with strict-decimal-only coercion.
 *
 * Covers:
 * - string↔number: "10" matches 10 and vice versa (decimal strings only)
 * - string↔boolean: "true" matches true, "false" matches false
 * - No hex, empty string, or whitespace false positives
 */
function matchesTierValue(runtimeValue: unknown, tierValue: string | number | boolean): boolean {
  // Exact match first (handles same-type comparisons)
  if (runtimeValue === tierValue) return true;

  const rv = typeof runtimeValue === 'string' ? runtimeValue.trim() : runtimeValue;
  const tv = tierValue;

  // string ↔ number coercion (decimal-only)
  if (typeof rv === 'string' && typeof tv === 'number') {
    return DECIMAL_RE.test(rv) && Number(rv) === tv;
  }
  if (typeof rv === 'number' && typeof tv === 'string') {
    return DECIMAL_RE.test(tv.trim()) && rv === Number(tv.trim());
  }

  // string ↔ boolean coercion
  if (typeof rv === 'string' && typeof tv === 'boolean') {
    if (rv === 'true') return tv === true;
    if (rv === 'false') return tv === false;
    return false;
  }
  if (typeof rv === 'boolean' && typeof tv === 'string') {
    if (tv === 'true') return rv === true;
    if (tv === 'false') return rv === false;
    return false;
  }

  return false;
}

/**
 * Calculate credits from billing rules
 *
 * @param config - Tool billing configuration with rules and optional token pricing
 * @param input - Tool execution input data
 * @param output - Tool execution output data
 * @param requestSchema - Request schema as JSON string
 * @param responseSchema - Response schema as JSON string
 * @param logger - Optional logger for audit trail
 * @returns Total credits as raw float (rounding occurs at accumulator flush time)
 * @throws Error on validation failures (triggers fallback to legacy billing)
 */
export async function calculateCreditsFromRules(
  config: ToolBillingConfig,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  requestSchema: string,
  responseSchema: string,
  logger?: Logger,
): Promise<number> {
  const { rules, tokenPricing } = config;

  // Separate additive rules and multipliers
  const additiveRules = rules.filter((r) => !r.isMultiplier) as AdditiveBillingRule[];
  const multiplierRules = rules.filter((r) => r.isMultiplier) as MultiplierBillingRule[];

  // Step 1: Calculate base credits by category
  const creditsByCategory: Record<BillingCategory, number> = {
    text: 0,
    image: 0,
    audio: 0,
    video: 0,
  };
  const auditLog: any[] = []; // For debugging

  for (const rule of additiveRules) {
    // Select schema
    const schemaJson = rule.phase === 'input' ? requestSchema : responseSchema;
    let schema: any;
    try {
      schema = JSON.parse(schemaJson);
    } catch (error) {
      throw new Error(`Invalid ${rule.phase} schema JSON: ${error.message}`);
    }

    // Validate field exists in schema
    const fieldType = getFieldTypeFromSchema(schema, rule.fieldPath);
    if (!fieldType) {
      throw new Error(`Field ${rule.fieldPath} not found in ${rule.phase} schema`);
    }

    // Validate unitField exists in the correct phase schema (fail-closed)
    if (rule.unitField) {
      // Normalize unitPhase the same way extraction does
      const effectiveUnitPhase =
        rule.unitPhase === 'input' || rule.unitPhase === 'output' ? rule.unitPhase : rule.phase;
      const unitSchemaJson = effectiveUnitPhase === 'input' ? requestSchema : responseSchema;
      // Only parse the unit phase schema if it's different from the already-parsed one
      let unitSchema: any;
      if (unitSchemaJson === schemaJson) {
        unitSchema = schema;
      } else {
        try {
          unitSchema = JSON.parse(unitSchemaJson);
        } catch (error) {
          throw new Error(
            `Invalid ${effectiveUnitPhase} schema JSON for unitField: ${error.message}`,
          );
        }
      }
      const unitFieldType = getFieldTypeFromSchema(unitSchema, rule.unitField);
      if (!unitFieldType) {
        throw new Error(
          `unitField "${rule.unitField}" not found in ${effectiveUnitPhase} schema ` +
            `(rule fieldPath: ${rule.fieldPath})`,
        );
      }
    }

    // Validate no tiers on aggregated fields
    const isAggregated = rule.fieldPath.includes('[*]');
    if (rule.pricingTiers && rule.pricingTiers.length > 0 && isAggregated) {
      throw new Error(
        `pricingTiers not allowed on aggregated field: ${rule.fieldPath}. Use defaultCreditsPerUnit only.`,
      );
    }

    // Extract value for tier matching (from fieldPath)
    const source = rule.phase === 'input' ? input : output;
    const value = extractAndAggregateValue(source, rule.fieldPath, rule.category);

    // Get credits per unit (tier or default)
    // For boolean pricing tiers, value is used to match tier
    let creditsPerUnit = rule.defaultCreditsPerUnit;
    if (
      rule.pricingTiers &&
      rule.pricingTiers.length > 0 &&
      value !== undefined &&
      value !== null
    ) {
      const tier = rule.pricingTiers.find((t) => matchesTierValue(value, t.value));
      if (tier) {
        creditsPerUnit = tier.creditsPerUnit;
      }
    }

    // Extract value for unit calculation (from unitField or fieldPath)
    let unitValue: any;
    if (rule.unitField) {
      // Use unitField to get units (e.g., duration from separate field)
      const unitSource =
        rule.unitPhase === 'input' ? input : rule.unitPhase === 'output' ? output : source;
      unitValue = extractAndAggregateValue(unitSource, rule.unitField, rule.category);
    } else {
      // Use fieldPath value for units (default behavior)
      unitValue = value;
    }

    // Handle missing fields: charge default × 1
    let units: number;
    if (unitValue === undefined || unitValue === null) {
      units = 1;
    } else {
      units = calculateUnits(unitValue, rule.category, rule.unitMode);
    }

    // Calculate credits (with tokenPricing conversion if applicable)
    let credits: number;
    if (tokenPricing && rule.category === 'text') {
      // USD-based pricing: (tokens / 1M) × pricePer1MUsd × USD_TO_CREDITS_RATE
      const pricePer1MUsd =
        rule.phase === 'input' ? tokenPricing.inputPer1MUsd : tokenPricing.outputPer1MUsd;

      if (pricePer1MUsd === undefined || pricePer1MUsd === null) {
        throw new Error(
          `Missing tokenPricing.${rule.phase === 'input' ? 'inputPer1MUsd' : 'outputPer1MUsd'} ` +
            `for ${rule.phase} phase text billing`,
        );
      }

      credits = units * pricePer1MUsd * USD_TO_CREDITS_RATE;
    } else {
      // Standard credit-based pricing
      credits = units * creditsPerUnit;
    }

    // Per-rule finite validation — fail with actionable context
    if (!Number.isFinite(credits)) {
      throw new Error(
        `Non-finite credits computed for rule (fieldPath: ${rule.fieldPath}, ` +
          `unitField: ${rule.unitField || 'N/A'}, category: ${rule.category}, ` +
          `units: ${units}, creditsPerUnit: ${creditsPerUnit}): ${credits}`,
      );
    }

    // Add to category total
    creditsByCategory[rule.category] = (creditsByCategory[rule.category] || 0) + credits;

    // Audit logging
    auditLog.push({
      fieldPath: rule.fieldPath,
      phase: rule.phase,
      category: rule.category,
      ...(rule.unitField && { unitField: rule.unitField, unitPhase: rule.unitPhase || rule.phase }),
      tierValue: value, // Value used for tier matching
      units,
      creditsPerUnit,
      credits,
    });
  }

  // Step 2: Apply multipliers
  for (const multiplier of multiplierRules) {
    // Validate field exists in schema
    const schemaJson = multiplier.phase === 'input' ? requestSchema : responseSchema;
    let schema: any;
    try {
      schema = JSON.parse(schemaJson);
    } catch (error) {
      throw new Error(`Invalid ${multiplier.phase} schema JSON: ${error.message}`);
    }

    const fieldType = getFieldTypeFromSchema(schema, multiplier.fieldPath);
    if (!fieldType) {
      throw new Error(
        `Multiplier field ${multiplier.fieldPath} not found in ${multiplier.phase} schema`,
      );
    }

    const source = multiplier.phase === 'input' ? input : output;
    const value = get(source, multiplier.fieldPath);

    if (value !== undefined && value !== null) {
      const multiplierValue = Number(value);

      // Validate multiplier value
      if (!Number.isFinite(multiplierValue) || Number.isNaN(multiplierValue)) {
        throw new Error(
          `Invalid multiplier value for ${multiplier.fieldPath}: ${value} (must be finite number)`,
        );
      }
      if (multiplierValue < 0) {
        throw new Error(
          `Negative multiplier not allowed for ${multiplier.fieldPath}: ${multiplierValue}`,
        );
      }
      if (multiplierValue === 0) {
        logger?.warn(`Zero multiplier on ${multiplier.fieldPath} results in free execution`);
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

  // Debug logging for audit trail
  if (logger) {
    logger.debug({
      message: 'Billing calculation complete',
      config: {
        inventoryKey: config.inventoryKey,
        methodName: config.methodName,
      },
      creditsByCategory,
      totalCredits,
      auditLog,
    });
  }

  // Return raw float for micro-credit accumulator precision.
  // Rounding to integer happens at flush time in the accumulator.
  return totalCredits;
}

/**
 * Calculate units from a value based on category
 *
 * @param value - Extracted field value
 * @param category - Billing category
 * @returns Number of units
 */
function calculateUnits(value: unknown, category: BillingCategory, unitMode?: string): number {
  switch (category) {
    case 'text': {
      if (unitMode === 'utf8_bytes') {
        return Buffer.byteLength(String(value), 'utf-8') / 1_000_000;
      }
      const tokens = countToken(String(value));
      return tokens / 1_000_000; // Per million tokens
    }

    case 'image':
      if (Array.isArray(value)) {
        return value.length;
      }
      if (typeof value === 'number') {
        return value; // Explicit count (e.g., num_images field)
      }
      return 1; // Single image

    case 'audio':
      if (Array.isArray(value)) {
        return value.reduce((sum, v) => sum + Number(v), 0);
      }
      return Number(value);

    case 'video':
      if (Array.isArray(value)) {
        return value.reduce((sum, v) => sum + Number(v), 0);
      }
      return Number(value);

    default:
      throw new Error(`Unknown billing category: ${category}`);
  }
}

/**
 * Extract and aggregate value from data using field path
 *
 * Supports:
 * - Simple paths: "prompt"
 * - Nested paths: "config.resolution"
 * - Array aggregation: "images[*]", "contents[0].parts[*].text"
 *
 * @param data - Source data (input or output)
 * @param fieldPath - Data path in dot notation
 * @param category - Billing category (affects aggregation strategy)
 * @returns Extracted value (string, number, array, or null)
 */
function extractAndAggregateValue(
  data: Record<string, unknown>,
  fieldPath: string,
  category: BillingCategory,
): unknown {
  // Handle array paths with [*] notation
  const arrayMatch = fieldPath.match(/^(.+)\[\*\](?:\.(.+))?$/);

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
          `(max ${MAX_ARRAY_SIZE})`,
      );
    }

    // If no field name after [*], return the array itself
    if (!fieldName) {
      return arrayData;
    }

    // Extract field from all array items
    const values = arrayData
      .map((item) => get(item, fieldName))
      .filter((v) => v !== undefined && v !== null);

    if (values.length === 0) {
      return null;
    }

    // Aggregate based on category
    if (category === 'text') {
      return values.join(' '); // Concatenate for token counting
    } else if (category === 'image' || category === 'audio' || category === 'video') {
      return values; // Return array for counting/summing
    }

    return values;
  }

  // Non-array path: simple get
  return get(data, fieldPath);
}

/**
 * Determine the effective type of a JSON schema node.
 *
 * Handles:
 * - Standard `type` string
 * - `type` arrays (e.g., `["string", "null"]` → returns non-null type or `'union'`)
 * - `const` / `enum`-only nodes (infers type from value)
 * - Nodes with only `oneOf`/`anyOf` (returns `'composite'`)
 *
 * @returns The type string, `'composite'`, `'union'`, or `null` if undetermined.
 */
function getSchemaNodeType(node: any): string | null {
  if (!node || typeof node !== 'object') return null;

  // Standard type field
  if (typeof node.type === 'string') return node.type;

  // Type array — e.g., ["string", "null"]
  if (Array.isArray(node.type)) {
    const nonNull = node.type.filter((t: string) => t !== 'null');
    if (nonNull.length === 1) return nonNull[0];
    if (nonNull.length > 1) return 'union';
    return 'null';
  }

  // const-only node
  if (node.const !== undefined) return typeof node.const;

  // enum-only node — infer from first value
  if (Array.isArray(node.enum) && node.enum.length > 0) {
    return typeof node.enum[0];
  }

  // Composite keywords present
  if (node.oneOf || node.anyOf) return 'composite';

  return null;
}

/**
 * Normalize a path token — strip array brackets.
 * "images[*]" → { fieldName: "images", isArray: true }
 * "config"   → { fieldName: "config", isArray: false }
 */
function parsePathToken(token: string): { fieldName: string; isArray: boolean } {
  const m = token.match(/^(.+)\[(\*|\d+)\]$/);
  if (m) return { fieldName: m[1], isArray: true };
  return { fieldName: token, isArray: false };
}

/**
 * Resolve a composite (`oneOf`/`anyOf`) schema node by selecting the branch
 * that can satisfy the remaining field path.
 *
 * Uses path-aware resolution: iterates ALL branches and picks the first one
 * whose sub-tree contains the remaining path. This avoids the bug where
 * `.find()` would stop at the first array-like branch even if it doesn't
 * satisfy the full path.
 *
 * @returns The resolved branch schema, or `null` if no branch matches.
 */
function resolveCompositeForPath(node: any, remainingTokens: string[]): any {
  const options: any[] = node.oneOf || node.anyOf;
  if (!options || options.length === 0) return null;

  // If no remaining path, pick the first non-null branch
  if (remainingTokens.length === 0) {
    const nonNull = options.filter(
      (opt: any) =>
        !(
          opt.type === 'null' ||
          (Array.isArray(opt.type) && opt.type.length === 1 && opt.type[0] === 'null')
        ),
    );
    return nonNull.length > 0 ? nonNull[0] : options[0];
  }

  // Path-aware: find the branch that can resolve the remaining path
  for (const branch of options) {
    if (canResolvePath(branch, remainingTokens)) {
      return branch;
    }
  }

  // Fallback: first non-null branch (may still fail downstream)
  const nonNull = options.filter(
    (opt: any) =>
      !(
        opt.type === 'null' ||
        (Array.isArray(opt.type) && opt.type.length === 1 && opt.type[0] === 'null')
      ),
  );
  return nonNull.length > 0 ? nonNull[0] : null;
}

/**
 * Check whether a schema node can resolve the given path tokens.
 * Used by `resolveCompositeForPath` to pick the correct branch.
 */
function canResolvePath(node: any, tokens: string[]): boolean {
  if (!node || typeof node !== 'object') return false;
  if (tokens.length === 0) return true;

  // Resolve nested composites first
  if (node.oneOf || node.anyOf) {
    const opts: any[] = node.oneOf || node.anyOf;
    return opts.some((opt: any) => canResolvePath(opt, tokens));
  }

  const [head, ...tail] = tokens;
  const { fieldName, isArray } = parsePathToken(head);

  // Property access
  const prop = node.properties?.[fieldName];
  if (!prop) return false;

  if (isArray) {
    // Need to descend into items — but prop may be composite (nullable array)
    const arrayNode = prop;
    if (arrayNode.oneOf || arrayNode.anyOf) {
      const opts: any[] = arrayNode.oneOf || arrayNode.anyOf;
      // Find an array branch whose items can resolve the tail
      return opts.some((opt: any) => {
        if (opt.items) return canResolvePath(opt.items, tail);
        return false;
      });
    }
    if (!arrayNode.items) return false;
    return canResolvePath(arrayNode.items, tail);
  }

  // Non-array: descend into the property
  return canResolvePath(prop, tail);
}

/**
 * Get field type from JSON schema
 *
 * Supports:
 * - properties traversal
 * - items traversal for arrays
 * - Array notation: field[*], field[0]
 * - oneOf / anyOf composites (path-aware branch selection)
 * - Nullable types via type arrays (e.g., ["string", "null"])
 *
 * Does NOT support:
 * - $ref (fail fast with null)
 * - allOf (fail fast with null)
 *
 * @param schema - JSON schema object
 * @param fieldPath - Field path in dot notation
 * @returns Field type (string, number, array, object, etc.) or null if not found
 */
export function getFieldTypeFromSchema(schema: any, fieldPath: string): string | null {
  if (!schema || !fieldPath) {
    return null;
  }

  // Fail fast on $ref and allOf — unsupported
  if (schema.$ref || schema.allOf) {
    return null;
  }

  const pathParts = fieldPath.split('.');
  let current = schema;

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    const remainingTokens = pathParts.slice(i + 1);

    // Resolve composite before property descent
    if (current.oneOf || current.anyOf) {
      current = resolveCompositeForPath(current, [part, ...remainingTokens]);
      if (!current) return null;
    }

    // Fail fast on unsupported constructs at any level
    if (current.$ref || current.allOf) {
      return null;
    }

    const { fieldName, isArray } = parsePathToken(part);

    // Property access
    current = current.properties?.[fieldName];
    if (!current) return null;

    // Resolve composite on the property itself (e.g., nullable array)
    if (current.oneOf || current.anyOf) {
      if (isArray) {
        // For array tokens we need a branch with `items` (an array branch).
        // resolveCompositeForPath picks by property presence in remaining tokens,
        // which would incorrectly prefer an object branch when both object and
        // array branches expose the same property names (e.g. oneOf: [
        //   {type:'object', properties:{duration:{type:'number'}}},
        //   {type:'array', items:{properties:{duration:{type:'number'}}}}
        // ]).  That leaves current.items undefined after this block → null return.
        // Instead, find explicitly the first branch that has items AND whose items
        // satisfy the remaining path.
        const options: any[] = current.oneOf || current.anyOf;
        const arrayBranch = options.find((opt: any) => {
          if (!opt.items) return false;
          return remainingTokens.length === 0 || canResolvePath(opt.items, remainingTokens);
        });
        if (!arrayBranch) return null;
        current = arrayBranch;
      } else if (remainingTokens.length > 0) {
        // For non-array with remaining path, resolve for remaining path
        current = resolveCompositeForPath(current, remainingTokens);
        if (!current) return null;
      }
      // If no remaining path and not array, let it fall through to type resolution at end
    }

    if (isArray) {
      // Move to items schema for array
      current = current.items;
      if (!current) return null;
    }
  }

  // Final node: resolve composite if needed
  if (current.oneOf || current.anyOf) {
    const resolved = resolveCompositeForPath(current, []);
    if (resolved) current = resolved;
  }

  return getSchemaNodeType(current);
}

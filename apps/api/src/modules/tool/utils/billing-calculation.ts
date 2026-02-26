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
      const tier = rule.pricingTiers.find((t) => t.value === value);
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
    } else if (category === 'image' || category === 'audio') {
      return values; // Return array for counting/summing
    }

    return values;
  }

  // Non-array path: simple get
  return get(data, fieldPath);
}

/**
 * Get field type from JSON schema
 *
 * Supports:
 * - properties traversal
 * - items traversal for arrays
 * - Array notation: field[*], field[0]
 *
 * Does NOT support:
 * - $ref, oneOf, allOf (fail fast with null)
 *
 * @param schema - JSON schema object
 * @param fieldPath - Field path in dot notation
 * @returns Field type (string, number, array, object, etc.) or null if not found
 */
export function getFieldTypeFromSchema(schema: any, fieldPath: string): string | null {
  if (!schema || !fieldPath) {
    return null;
  }

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

      // Move to items schema for array
      current = current.items;
      if (!current) return null;
    } else {
      // Regular property access
      current = current.properties?.[part];
      if (!current) return null;
    }
  }

  return current.type || null;
}

/**
 * Dynamic Tool Billing Type Definitions
 *
 * These types define the structure for field-level billing rules
 * that enable granular pricing based on tool input/output data.
 */

/**
 * Billing category - determines how units are calculated
 */
export type BillingCategory = 'text' | 'image' | 'audio' | 'video';

/**
 * Phase in tool execution
 */
export type BillingPhase = 'input' | 'output';

/**
 * Pricing tier - different prices for different field values
 */
export interface PricingTier {
  /** Value to match (scalar fields only, now supports boolean) */
  value: string | number | boolean;
  /** Credits per unit for this tier */
  creditsPerUnit: number;
}

/**
 * Additive billing rule - charges based on field value
 *
 * Calculates credits by:
 * 1. Extracting value from input/output using fieldPath
 * 2. Converting to units based on category (tokens, count, duration)
 * 3. Matching pricing tier or using default
 * 4. Accumulating credits by category
 *
 * @example Basic usage
 * {
 *   fieldPath: "prompt",
 *   phase: "input",
 *   category: "text",
 *   defaultCreditsPerUnit: 0.002
 * }
 *
 * @example Boolean pricing tier (price depends on boolean flag)
 * {
 *   fieldPath: "generate_audio",
 *   phase: "input",
 *   category: "video",
 *   unitField: "duration",
 *   unitPhase: "input",
 *   pricingTiers: [
 *     { value: false, creditsPerUnit: 26.88 },
 *     { value: true, creditsPerUnit: 33.6 }
 *   ],
 *   defaultCreditsPerUnit: 33.6
 * }
 */
export interface AdditiveBillingRule {
  /** Data path to field (e.g., "prompt", "images[*]", "config.resolution") */
  fieldPath: string;

  /** Whether to extract from input or output data */
  phase: BillingPhase;

  /** How to calculate units from the field value */
  category: BillingCategory;

  /** Must be false or undefined for additive rules */
  isMultiplier?: false;

  /** Optional tier-based pricing (forbidden on aggregated fields with [*]) */
  pricingTiers?: PricingTier[];

  /** Required - fallback when no tier matches or for aggregated fields */
  defaultCreditsPerUnit: number;

  /**
   * Optional field to extract units from (instead of fieldPath)
   *
   * When specified:
   * - fieldPath is used to match pricing tier (e.g., boolean flag)
   * - unitField is used to calculate units (e.g., duration in seconds)
   *
   * @example
   * fieldPath: "generate_audio" → matches tier to get price
   * unitField: "duration" → gets units (5 seconds)
   * Result: 5 seconds × price = total credits
   */
  unitField?: string;

  /**
   * Phase to extract unitField from (defaults to same as phase)
   */
  unitPhase?: BillingPhase;

  /**
   * How to measure units for the text category.
   * - 'tokens' (default): count tokens via countToken()
   * - 'utf8_bytes': count UTF-8 byte length via Buffer.byteLength()
   * Only applicable when category is 'text'.
   */
  unitMode?: 'tokens' | 'utf8_bytes';
}

/**
 * Multiplier billing rule - multiplies category total by field value
 *
 * Applies a quantity multiplier to accumulated credits for a category.
 * Used for fields like "num_outputs" that scale the base cost.
 *
 * @example
 * {
 *   fieldPath: "num_outputs",
 *   phase: "input",
 *   isMultiplier: true,
 *   applyTo: "image"
 * }
 */
export interface MultiplierBillingRule {
  /** Data path to multiplier field */
  fieldPath: string;

  /** Whether to extract from input or output data */
  phase: BillingPhase;

  /** Must be true for multiplier rules */
  isMultiplier: true;

  /** Which category's total to multiply */
  applyTo: BillingCategory;

  // These fields are NOT allowed on multiplier rules:
  // - category
  // - pricingTiers
  // - defaultCreditsPerUnit
}

/**
 * Billing rule - discriminated union of additive and multiplier rules
 *
 * Discriminator: isMultiplier field
 * - undefined or false → AdditiveBillingRule
 * - true → MultiplierBillingRule
 */
export type BillingRule = AdditiveBillingRule | MultiplierBillingRule;

/**
 * Token pricing configuration for USD-based billing
 *
 * Converts token counts to credits using:
 * credits = (tokens / 1_000_000) * pricePer1MUsd * 120
 */
export interface TokenPricing {
  /** USD price per 1 million input tokens */
  inputPer1MUsd: number;

  /** USD price per 1 million output tokens */
  outputPer1MUsd: number;
}

/**
 * Complete billing configuration for a tool method
 *
 * Loaded from database and cached in ToolBillingService
 */
export interface ToolBillingConfig {
  /** Inventory key (e.g., 'nano_banana_pro') */
  inventoryKey: string;

  /** Method name (e.g., 'generate') */
  methodName: string;

  /** Array of billing rules to evaluate */
  rules: BillingRule[];

  /** Optional USD-based token pricing */
  tokenPricing?: TokenPricing;

  /** Whether this config is active */
  enabled: boolean;
}

/**
 * Type guard - check if rule is additive
 */
export function isAdditiveBillingRule(rule: BillingRule): rule is AdditiveBillingRule {
  return !rule.isMultiplier;
}

/**
 * Type guard - check if rule is multiplier
 */
export function isMultiplierBillingRule(rule: BillingRule): rule is MultiplierBillingRule {
  return rule.isMultiplier === true;
}

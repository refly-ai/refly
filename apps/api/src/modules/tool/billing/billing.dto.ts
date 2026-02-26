/**
 * Billing DTOs
 * Data transfer objects for billing service
 */

import type { BillingConfig } from '@refly/openapi-schema';

/**
 * Options for processing billing
 */
export interface ProcessBillingOptions {
  /** User ID */
  uid: string;
  /** Tool name */
  toolName: string;
  /** Toolset key */
  toolsetKey: string;

  /**
   * Actual amount to deduct (after discount)
   * For Composio and other pre-calculated scenarios
   * If provided, billingConfig will be ignored
   */
  discountedPrice?: number;

  /**
   * Original price before discount
   */
  originalPrice?: number;

  /**
   * Billing configuration (for dynamic-tooling scenarios)
   * Used with params to calculate credit cost
   */
  billingConfig?: BillingConfig;

  /**
   * Request parameters for credit calculation
   * Required when using billingConfig
   */
  params?: Record<string, unknown>;

  /**
   * Tool execution input data (for dynamic billing)
   */
  input?: Record<string, unknown>;

  /**
   * Tool execution output data (for dynamic billing)
   */
  output?: Record<string, unknown>;

  /**
   * Request schema as JSON string (for dynamic billing)
   */
  requestSchema?: string;

  /**
   * Response schema as JSON string (for dynamic billing)
   */
  responseSchema?: string;

  /**
   * Result ID from context (optional, falls back to context if not provided)
   */
  resultId?: string;

  /**
   * Result version from context (optional, falls back to context if not provided)
   */
  version?: number;

  /**
   * Tool call ID (for PTC mode, must be explicitly provided)
   */
  toolCallId?: string;
}

/**
 * Result of billing processing
 */
export interface ProcessBillingResult {
  /** Whether billing was processed successfully */
  success: boolean;
  /** Effective cost for this call after discount (may be fractional) */
  discountedPrice: number;
  /** Original price before discount */
  originalPrice?: number;
  /** Actual integer credits flushed/deducted this call (accumulator-based paths) */
  flushedCredits?: number;
  /** Error message if processing failed */
  error?: string;
}

export interface ProviderBillingConfig {
  providerKey: string;
  plan: string;
  standardRatePer1K: number;
  premiumRatePer1K: number;
  margin: number;
}

export interface ProcessComposioBillingOptions {
  uid: string;
  toolName: string;
  toolsetKey: string;
  /** Fractional credit cost (e.g., 0.036 for standard tier) */
  fractionalCreditCost: number;
  /** Original cost before any discount */
  originalFractionalCost: number;
  resultId?: string;
  version?: number;
  toolCallId?: string;
  idempotencyKey?: string;
}

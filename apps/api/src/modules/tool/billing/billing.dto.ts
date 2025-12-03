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
}

/**
 * Result of billing processing
 */
export interface ProcessBillingResult {
  /** Whether billing was processed successfully */
  success: boolean;
  /** Actual amount deducted (after discount) */
  discountedPrice: number;
  /** Original price before discount */
  originalPrice?: number;
  /** Error message if processing failed */
  error?: string;
}

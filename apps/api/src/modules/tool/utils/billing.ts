/**
 * Billing utilities
 * Handles credit calculation for tool usage
 */

import type { BillingConfig } from '@refly/openapi-schema';
import { BillingType } from '../constant';

/**
 * Calculate credits based on billing configuration and input
 * @param config - Billing configuration
 * @param input - Request input parameters
 * @returns Number of credits to charge
 */
export function calculateCredits(config: BillingConfig, input: Record<string, unknown>): number {
  if (!config.enabled) {
    return 0;
  }

  let credits = 0;

  switch (config.type) {
    case BillingType.PER_CALL:
      // Fixed cost per call
      credits = config.creditsPerCall || 0;
      break;

    case BillingType.PER_QUANTITY: {
      // Variable cost based on quantity
      if (!config.quantityField || !config.creditsPerUnit) {
        throw new Error('quantityField and creditsPerUnit are required for PER_QUANTITY billing');
      }

      const value = input[config.quantityField];

      if (typeof value === 'string') {
        // For text: calculate based on character count (per 1000 characters)
        const units = Math.ceil(value.length / 1000);
        credits = units * config.creditsPerUnit;
      } else if (typeof value === 'number') {
        // For numbers: direct multiplication
        credits = value * config.creditsPerUnit;
      } else {
        throw new Error(`Unsupported quantity field type: ${typeof value}`);
      }
      break;
    }

    default:
      throw new Error(`Unsupported billing type: ${config.type}`);
  }

  // Apply maximum credits limit
  if (config.maxCredits && credits > config.maxCredits) {
    credits = config.maxCredits;
  }

  return Math.ceil(credits);
}

/**
 * Validate billing configuration
 * @param config - Billing configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateBillingConfig(config: BillingConfig): void {
  if (!config.enabled) {
    return;
  }

  switch (config.type) {
    case BillingType.PER_CALL:
      if (!config.creditsPerCall || config.creditsPerCall <= 0) {
        throw new Error('creditsPerCall must be a positive number for PER_CALL billing');
      }
      break;

    case BillingType.PER_QUANTITY:
      if (!config.quantityField) {
        throw new Error('quantityField is required for PER_QUANTITY billing');
      }
      if (!config.creditsPerUnit || config.creditsPerUnit <= 0) {
        throw new Error('creditsPerUnit must be a positive number for PER_QUANTITY billing');
      }
      break;

    default:
      throw new Error(`Unknown billing type: ${config.type}`);
  }

  if (config.maxCredits !== undefined && config.maxCredits <= 0) {
    throw new Error('maxCredits must be a positive number if specified');
  }
}

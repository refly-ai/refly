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

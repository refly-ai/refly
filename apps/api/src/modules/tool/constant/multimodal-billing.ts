/**
 * Multimodal billing rates for Gemini-based processing
 * Model: gemini-2.5-flash-preview (vision, audio, video, document, speech)
 *
 * Rates are based on Gemini API pricing with internal credit multiplier.
 */

import type { CreditBilling } from '@refly/openapi-schema';
import type { MultimodalityType, MultimodalTokenUsage } from '../multimodal/gemini/types';

/**
 * Default model ID for multimodal processing
 */
export const MULTIMODAL_MODEL_ID = 'gemini-2.5-flash-preview';

/**
 * Billing rates for different multimodal processing types
 *
 * Credit calculation:
 * - Image: ~258 tokens per image (actual from API)
 * - Video: ~258 tokens per frame @ 1fps (actual from API)
 * - Audio: ~25 tokens per second (actual from API)
 * - Document: ~1000-3000 tokens per page (actual from API)
 * - Speech (TTS): Character-based (chars / 4 for approximation)
 */
export const MULTIMODAL_BILLING_RATES: Record<MultimodalityType, CreditBilling> = {
  image: {
    unit: '1k_tokens',
    inputCost: 0.5,
    outputCost: 2.0,
    minCharge: 1,
  },
  video: {
    unit: '1k_tokens',
    inputCost: 0.5,
    outputCost: 2.0,
    minCharge: 5,
  },
  audio: {
    unit: '1k_tokens',
    inputCost: 0.5,
    outputCost: 2.0,
    minCharge: 2,
  },
  document: {
    unit: '1k_tokens',
    inputCost: 0.5,
    outputCost: 2.0,
    minCharge: 2,
  },
  speech: {
    unit: '1k_chars',
    inputCost: 2.0,
    outputCost: 0,
    minCharge: 1,
  },
};

/**
 * Calculate credit cost for multimodal processing
 *
 * @param tokenUsage Token usage from multimodal API response
 * @returns Credit cost in credits
 */
export function calculateMultimodalCreditCost(tokenUsage: MultimodalTokenUsage): number {
  const billing = MULTIMODAL_BILLING_RATES[tokenUsage.modalityType];
  if (!billing) {
    return 0;
  }

  let cost = 0;

  if (billing.unit === '1k_tokens') {
    // Token-based billing (image, video, audio, document)
    cost =
      (tokenUsage.promptTokens / 1000) * billing.inputCost +
      (tokenUsage.outputTokens / 1000) * billing.outputCost;

    // Apply cache discount if applicable (typically 10% of input cost)
    if (tokenUsage.cachedContentTokens && billing.cacheReadCost) {
      const cachedCost = (tokenUsage.cachedContentTokens / 1000) * billing.cacheReadCost;
      cost -= cachedCost; // Reduce cost for cached tokens
    }
  } else if (billing.unit === '1k_chars') {
    // Character-based billing (TTS)
    // For TTS, promptTokens represents chars / 4, so multiply back
    const charCount = tokenUsage.promptTokens * 4;
    cost = (charCount / 1000) * billing.inputCost;
  }

  // Ensure minimum charge
  return Math.max(cost, billing.minCharge);
}

/**
 * Get billing configuration for a modality type
 */
export function getMultimodalBilling(modalityType: MultimodalityType): CreditBilling {
  return MULTIMODAL_BILLING_RATES[modalityType];
}

/**
 * Check if a modality type has billing configured
 */
export function hasMultimodalBilling(modalityType: string): modalityType is MultimodalityType {
  return modalityType in MULTIMODAL_BILLING_RATES;
}

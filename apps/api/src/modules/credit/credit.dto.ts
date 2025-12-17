import { CreditBilling, TokenUsageItem, ToolCallMeta, ModelTier } from '@refly/openapi-schema';

export type CheckRequestCreditUsageResult = {
  canUse: boolean;
  message: string;
};

/**
 * Simple token credit usage data for single model call billing
 * Called directly on on_chat_model_end event
 */
export interface SyncTokenCreditUsageJobData {
  uid: string;
  resultId: string;
  version: number;
  /** Token usage data */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Credit billing configuration */
  creditBilling: CreditBilling;
  /** Model info for usage details */
  modelName: string;
  actualModelName?: string;
  modelProvider?: string;
  tier?: ModelTier;
  timestamp: Date;
}

export interface SyncMediaCreditUsageJobData {
  uid: string;
  resultId?: string;
  creditBilling?: CreditBilling;
  timestamp: Date;
}

export interface SyncToolCreditUsageJobData {
  uid: string;
  resultId: string;
  version: number;
  creditBilling?: CreditBilling;
  /** Actual amount to deduct (after discount) */
  discountedPrice?: number;
  /** Original price before discount */
  originalPrice?: number;
  timestamp: Date;
  toolCallMeta: ToolCallMeta;
  toolCallId: string;
}

export interface CreditBalance {
  creditAmount: number;
  creditBalance: number;
  regularCredits?: number;
  templateEarningsCredits?: number;
  cumulativeEarningsCredits?: number;
}

// New interfaces for batch processing
export interface ModelUsageDetail {
  /** User-facing model name (Auto or direct model selection) */
  modelName: string;
  /** Actual model name used for execution (e.g., Claude Sonnet 4) */
  actualModelName?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  creditCost: number;
}

// New interface for credit usage step
export interface CreditUsageStep {
  usage: TokenUsageItem;
  creditBilling: CreditBilling;
  /** Model name used for billing (Auto or direct model selection) */
  billingModelName: string;
}

export interface SyncBatchTokenCreditUsageJobData {
  uid: string;
  resultId?: string;
  version?: number;
  creditUsageSteps: CreditUsageStep[];
  timestamp: Date;
}

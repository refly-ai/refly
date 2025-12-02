import { CreditBilling, TokenUsageItem } from '@refly/openapi-schema';
export type CheckRequestCreditUsageResult = {
  canUse: boolean;
  message: string;
};

export interface SyncMediaCreditUsageJobData {
  uid: string;
  resultId?: string;
  creditBilling?: CreditBilling;
  timestamp: Date;
}

export interface SyncToolCreditUsageJobData {
  uid: string;
  resultId?: string;
  version?: number;
  creditBilling?: CreditBilling;
  /** Actual amount to deduct (after discount) */
  discountedPrice?: number;
  /** Original price before discount */
  originalPrice?: number;
  timestamp: Date;
  toolsetName: string;
  toolName: string;
}
export interface CreditBalance {
  creditAmount: number;
  creditBalance: number;
  regularCredits?: number;
  templateEarningsCredits?: number;
}

// New interfaces for batch processing
export interface ModelUsageDetail {
  modelName: string;
  totalTokens: number;
  creditCost: number;
}

// New interface for credit usage step
export interface CreditUsageStep {
  usage: TokenUsageItem;
  creditBilling: CreditBilling;
}

export interface SyncBatchTokenCreditUsageJobData {
  uid: string;
  resultId?: string;
  version?: number;
  creditUsageSteps: CreditUsageStep[];
  timestamp: Date;
}

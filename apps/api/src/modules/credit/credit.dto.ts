import { CreditBilling, TokenUsageItem } from '@refly/openapi-schema';
export type CheckRequestCreditUsageResult = {
  canUse: boolean;
  message: string;
};

export interface SyncTokenCreditUsageJobData {
  uid: string;
  resultId?: string;
  usage: TokenUsageItem;
  creditBilling?: CreditBilling;
  timestamp: Date;
}

export interface CreditBalance {
  creditAmount: number;
  creditBalance: number;
}

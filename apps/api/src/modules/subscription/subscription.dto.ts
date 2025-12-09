import {
  Subscription,
  SubscriptionPlanType,
  SubscriptionInterval,
  TokenUsageItem,
  SubscriptionStatus,
  TokenUsageMeter,
  StorageUsageMeter,
  ModelTier,
  CreditBilling,
} from '@refly/openapi-schema';
import {
  Subscription as SubscriptionModel,
  TokenUsageMeter as TokenUsageMeterModel,
  StorageUsageMeter as StorageUsageMeterModel,
} from '@prisma/client';
import { pick } from '../../utils';

export interface PlanQuota {
  creditQuota: number;
  dailyGiftCreditQuota: number;
  t1CountQuota: number;
  t2CountQuota: number;
  fileCountQuota: number;
  isEarlyBird?: boolean;
}

export interface CreateSubscriptionParam {
  subscriptionId: string;
  customerId: string;
  lookupKey: string;
  status: SubscriptionStatus;
  planType: SubscriptionPlanType;
  interval?: SubscriptionInterval;
}

export interface SyncTokenUsageJobData {
  uid: string;
  resultId?: string;
  usage: TokenUsageItem;
  timestamp: Date;
}

export interface SyncMediaCreditUsageJobData {
  uid: string;
  resultId?: string;
  creditBilling: CreditBilling;
  timestamp: Date;
}

export interface SyncRequestUsageJobData {
  uid: string;
  tier: ModelTier;
  timestamp: Date;
}

export interface SyncStorageUsageJobData {
  uid: string;
  timestamp: Date;
}

export type CheckRequestUsageResult = Record<ModelTier, boolean>;

export type CheckStorageUsageResult = {
  available: number;
};

export type CheckFileParseUsageResult = {
  pageUsed: number;
  pageLimit: number;
  available: number;
  fileUploadLimit?: number;
};

export function subscriptionPO2DTO(sub: SubscriptionModel): Subscription {
  return {
    ...pick(sub, ['subscriptionId', 'lookupKey', 'isTrial', 'lookupKey']),
    planType: sub.planType as SubscriptionPlanType,
    interval: sub.interval as SubscriptionInterval,
    status: sub.status as SubscriptionStatus,
    cancelAt: sub.cancelAt?.toJSON(),
  };
}

export function tokenUsageMeterPO2DTO(usage: TokenUsageMeterModel): TokenUsageMeter {
  return {
    ...pick(usage, [
      'meterId',
      'uid',
      'subscriptionId',
      't1CountQuota',
      't1CountUsed',
      't2CountQuota',
      't2CountUsed',
      't1TokenQuota',
      't1TokenUsed',
      't2TokenQuota',
      't2TokenUsed',
    ]),
    startAt: usage.startAt.toJSON(),
    endAt: usage.endAt?.toJSON(),
  };
}

export function storageUsageMeterPO2DTO(usage: StorageUsageMeterModel): StorageUsageMeter {
  return {
    ...pick(usage, ['meterId', 'uid', 'subscriptionId', 'fileCountQuota', 'fileCountUsed']),
    objectStorageQuota: usage.objectStorageQuota.toString(),
    resourceSize: usage.resourceSize.toString(),
    canvasSize: usage.canvasSize.toString(),
    fileSize: usage.fileSize.toString(),
    vectorStorageQuota: usage.vectorStorageQuota.toString(),
    vectorStorageUsed: usage.vectorStorageUsed.toString(),
  };
}

import { ModelInfo, ModelTier, SubscriptionPlan, FileVisibility } from '@refly/openapi-schema';
import { ModelInfo as ModelInfoPO, SubscriptionPlan as SubscriptionPlanPO } from '@prisma/client';
import { pick, safeParseJSON } from '@refly/utils';

export interface FileObject {
  storageKey: string;
  visibility?: FileVisibility;
}

export function modelInfoPO2DTO(modelInfo: ModelInfoPO): ModelInfo {
  return {
    ...pick(modelInfo, ['name', 'label', 'provider', 'contextLimit', 'maxOutput', 'isDefault']),
    tier: modelInfo.tier as ModelTier,
    capabilities: safeParseJSON(modelInfo.capabilities),
  };
}

export function subscriptionPlanPO2DTO(plan: SubscriptionPlanPO): SubscriptionPlan {
  return {
    planType: plan.planType,
    creditQuota: plan.creditQuota,
    t1TokenQuota: plan.t1TokenQuota,
    t2TokenQuota: plan.t2TokenQuota,
    objectStorageQuota: String(plan.objectStorageQuota),
    vectorStorageQuota: String(plan.vectorStorageQuota),
  };
}

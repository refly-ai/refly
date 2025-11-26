import {
  ActionResult,
  InvokeSkillRequest,
  LLMModelConfig,
  MediaGenerationModelConfig,
  Provider,
  ProviderItem,
  SimpleEventName,
  SkillInstance,
  SkillTrigger,
  SkillTriggerType,
} from '@refly/openapi-schema';
import {
  SkillInstance as SkillInstanceModel,
  SkillTrigger as SkillTriggerModel,
} from '@prisma/client';
import { pick } from '../../utils';
import { safeParseJSON } from '@refly/utils';

export interface InvokeSkillJobData extends InvokeSkillRequest {
  uid: string;
  rawParam: string;
  result?: ActionResult;
  provider?: Provider;
  providerItem?: ProviderItem;
  modelConfigMap?: {
    chat?: LLMModelConfig;
    agent?: LLMModelConfig;
    queryAnalysis?: LLMModelConfig;
    titleGeneration?: LLMModelConfig;
    image?: MediaGenerationModelConfig;
    video?: MediaGenerationModelConfig;
    audio?: MediaGenerationModelConfig;
  };
}

export function skillInstancePO2DTO(skill: SkillInstanceModel): SkillInstance {
  return {
    ...pick(skill, ['skillId', 'description']),
    name: skill.tplName,
    icon: safeParseJSON(skill.icon),
    tplConfig: safeParseJSON(skill.tplConfig),
    tplConfigSchema: safeParseJSON(skill.configSchema),
    pinnedAt: skill.pinnedAt?.toJSON(),
    createdAt: skill.createdAt.toJSON(),
    updatedAt: skill.updatedAt.toJSON(),
  };
}

export function skillTriggerPO2DTO(trigger: SkillTriggerModel): SkillTrigger {
  return {
    ...pick(trigger, ['skillId', 'displayName', 'triggerId', 'enabled']),
    triggerType: trigger.triggerType as SkillTriggerType,
    simpleEventName: trigger.simpleEventName as SimpleEventName,
    timerConfig: trigger.timerConfig ? safeParseJSON(trigger.timerConfig) : undefined,
    input: trigger.input ? safeParseJSON(trigger.input) : undefined,
    context: trigger.context ? safeParseJSON(trigger.context) : undefined,
    createdAt: trigger.createdAt.toJSON(),
    updatedAt: trigger.updatedAt.toJSON(),
  };
}

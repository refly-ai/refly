import {
  ActionResult,
  InvokeSkillRequest,
  LLMModelConfig,
  ModelScene,
  Provider,
  SimpleEventName,
  SkillInstance,
  SkillTrigger,
  SkillTriggerType,
} from '@refly/openapi-schema';
import {
  SkillInstance as SkillInstanceModel,
  SkillTrigger as SkillTriggerModel,
} from '../../generated/client';
import { pick } from '../../utils';

export interface InvokeSkillJobData extends InvokeSkillRequest {
  uid: string;
  rawParam: string;
  result?: ActionResult;
  provider?: Provider;
  modelConfigMap?: Record<ModelScene, LLMModelConfig>;
  abortController?: AbortController;
}

export interface SkillTimeoutCheckJobData {
  uid: string;
  type: 'idle' | 'execution';
  resultId: string;
  version?: number;
}

export function skillInstancePO2DTO(skill: SkillInstanceModel): SkillInstance {
  return {
    ...pick(skill, ['skillId', 'description']),
    name: skill.tplName,
    icon: JSON.parse(skill.icon),
    invocationConfig: JSON.parse(skill.invocationConfig),
    tplConfig: JSON.parse(skill.tplConfig),
    tplConfigSchema: JSON.parse(skill.configSchema),
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
    timerConfig: trigger.timerConfig ? JSON.parse(trigger.timerConfig) : undefined,
    input: trigger.input ? JSON.parse(trigger.input) : undefined,
    context: trigger.context ? JSON.parse(trigger.context) : undefined,
    createdAt: trigger.createdAt.toJSON(),
    updatedAt: trigger.updatedAt.toJSON(),
  };
}

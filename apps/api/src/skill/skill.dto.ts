import {
  ActionResult,
  InvokeSkillRequest,
  SimpleEventName,
  SkillInstance,
  SkillJob,
  SkillJobStatus,
  SkillTrigger,
  SkillTriggerType,
} from '@refly-packages/openapi-schema';
import {
  SkillInstance as SkillInstanceModel,
  SkillTrigger as SkillTriggerModel,
  SkillJob as SkillJobModel,
  Conversation as ConversationModel,
  ChatMessage as ChatMessageModel,
} from '@prisma/client';
import { pick } from '@/utils';
import { chatMessagePO2DTO, conversationPO2DTO } from '@/conversation/conversation.dto';

export interface InvokeSkillJobData extends InvokeSkillRequest {
  uid: string;
  rawParam: string;
  result?: ActionResult;
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

export function skillJobPO2DTO(
  job: SkillJobModel & {
    conversation?: ConversationModel;
    trigger?: SkillTriggerModel;
    messages?: ChatMessageModel[];
  },
): SkillJob {
  return {
    ...pick(job, ['jobId', 'skillId', 'skillDisplayName', 'triggerId', 'convId']),
    trigger: job.trigger ? skillTriggerPO2DTO(job.trigger) : undefined,
    conversation: job.conversation ? conversationPO2DTO(job.conversation) : undefined,
    messages: job.messages?.map(chatMessagePO2DTO) ?? [],
    tplConfig: JSON.parse(job.tplConfig),
    jobStatus: job.status as SkillJobStatus,
    input: JSON.parse(job.input),
    context: JSON.parse(job.context),
    createdAt: job.createdAt.toJSON(),
    updatedAt: job.updatedAt.toJSON(),
  };
}

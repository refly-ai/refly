import { Runnable } from '@langchain/core/runnables';
import { ToolParams } from '@langchain/core/tools';
import { BaseMessage } from '@langchain/core/messages';
import { SkillEngine } from './engine';
import { StructuredTool } from '@langchain/core/tools';
import { StateGraphArgs } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import {
  PopulatedSkillContext,
  SkillInput,
  SkillTemplateConfigSchema,
  SkillInvocationConfig,
  SkillMeta,
  User,
  SkillTemplateConfig,
} from '@refly/openapi-schema';
import { EventEmitter } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { SkillEvent } from '@refly/common-types';

export abstract class BaseSkill extends StructuredTool {
  /**
   * Skill display name
   */
  abstract displayName: Record<string, string>;
  /**
   * Skill template config schema
   */
  abstract configSchema: SkillTemplateConfigSchema;
  /**
   * Skill invocation config
   */
  abstract invocationConfig: SkillInvocationConfig;
  /**
   * Langgraph state definition
   */
  abstract graphState: StateGraphArgs<BaseSkillState>['channels'];

  constructor(protected engine: SkillEngine, protected params?: BaseToolParams) {
    super(params);
  }

  /**
   * Convert this skill to a LangChain runnable.
   */
  abstract toRunnable(): Runnable;

  /**
   * Emit a skill event.
   */
  emitEvent(data: Partial<SkillEvent>, config: SkillRunnableConfig) {
    const { emitter, currentSkill, spanId } = config?.configurable || {};

    if (!emitter) {
      return;
    }

    const eventData: SkillEvent = {
      event: data.event!,
      spanId,
      skillMeta: currentSkill,
      ...data,
    };

    emitter.emit(data.event, eventData);
  }

  async _call(
    input: typeof this.graphState,
    runManager?: CallbackManagerForToolRun,
    config?: SkillRunnableConfig,
  ): Promise<string> {
    if (!config) {
      throw new Error('skill config is required');
    }

    // Ensure currentSkill is not empty.
    config.configurable.currentSkill ??= {
      tplName: this.name,
      displayName: this.displayName[config.configurable.locale || 'en'],
    };

    // Ensure spanId is not empty.
    config.configurable.spanId ??= randomUUID();

    const response = await this.toRunnable().invoke(input, {
      ...config,
      metadata: {
        ...config.metadata,
        ...config.configurable.currentSkill,
        spanId: config.configurable.spanId,
      },
    });
    return response;
  }
}

export interface BaseToolParams extends ToolParams {
  engine: SkillEngine;
}

export interface BaseSkillState extends SkillInput {
  messages: BaseMessage[];
}

export const baseStateGraphArgs = {
  messages: {
    reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => [],
  },
  query: {
    reducer: (left: string, right: string) => (right ? right : left || ''),
    default: () => '',
  },
  locale: {
    reducer: (left?: string, right?: string) => (right ? right : left || 'en'),
    default: () => 'en',
  },
};

export interface SkillEventMap {
  start: [data: SkillEvent];
  end: [data: SkillEvent];
  log: [data: SkillEvent];
  stream: [data: SkillEvent];
  structured_data: [data: SkillEvent];
  error: [data: SkillEvent];
}

export interface SkillRunnableMeta extends Record<string, unknown>, SkillMeta {
  spanId: string;
}

export interface SkillRunnableConfig extends RunnableConfig {
  configurable?: PopulatedSkillContext & {
    spanId?: string;
    convId?: string;
    locale?: string;
    selectedSkill?: SkillMeta;
    currentSkill?: SkillMeta;
    chatHistory?: BaseMessage[];
    installedSkills?: SkillMeta[];
    tplConfig?: SkillTemplateConfig;
    emitter?: EventEmitter<SkillEventMap>;
  };
  user: User;
  metadata?: SkillRunnableMeta;
}

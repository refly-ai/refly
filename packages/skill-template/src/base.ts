import { Runnable } from '@langchain/core/runnables';
import { ToolParams } from '@langchain/core/tools';
import { BaseMessage } from '@langchain/core/messages';
import { SkillEngine } from './engine';
import { StructuredTool } from '@langchain/core/tools';
import { StateGraphArgs } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import {
  SkillContext,
  SkillInput,
  SkillTemplateConfigDefinition,
  SkillInvocationConfig,
  SkillMeta,
  User,
  SkillTemplateConfig,
  Icon,
  Artifact,
  ActionStepMeta,
} from '@refly-packages/openapi-schema';
import { EventEmitter } from 'node:stream';
import { SkillEvent } from '@refly-packages/common-types';

export abstract class BaseSkill extends StructuredTool {
  /**
   * Skill template icon
   */
  icon: Icon = { type: 'emoji', value: '🔧' };
  /**
   * Skill template config schema
   */
  abstract configSchema: SkillTemplateConfigDefinition;
  /**
   * Skill invocation config
   */
  abstract invocationConfig: SkillInvocationConfig;
  /**
   * Langgraph state definition
   */
  abstract graphState: StateGraphArgs<BaseSkillState>['channels'];

  constructor(public engine: SkillEngine, protected params?: BaseToolParams) {
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
    const { emitter, resultId } = config?.configurable || {};

    if (!emitter) {
      return;
    }

    const eventData: SkillEvent = {
      event: data.event!,
      step: config.metadata?.step,
      resultId,
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

    // Configure the engine with the current skill config.
    this.engine.configure(config);

    // Ensure currentSkill is not empty.
    config.configurable.currentSkill ??= {
      name: this.name,
      icon: this.icon,
    };

    this.emitEvent({ event: 'start' }, config);

    const response = await this.toRunnable().invoke(input, {
      ...config,
      metadata: {
        ...config.metadata,
        ...config.configurable.currentSkill,
        resultId: config.configurable.resultId,
      },
    });

    this.emitEvent({ event: 'end' }, config);

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
  create_node: [data: SkillEvent];
  artifact: [data: SkillEvent];
  structured_data: [data: SkillEvent];
  token_usage: [data: SkillEvent];
  error: [data: SkillEvent];
}

export interface SkillRunnableMeta extends Record<string, unknown>, SkillMeta {
  step?: ActionStepMeta;
  artifact?: Artifact;
  suppressOutput?: boolean;
}

export interface SkillRunnableConfig extends RunnableConfig {
  configurable?: SkillContext & {
    user: User;
    resultId?: string;
    canvasId?: string;
    locale?: string;
    uiLocale?: string;
    modelName?: string;
    currentSkill?: SkillMeta;
    currentStep?: ActionStepMeta;
    chatHistory?: BaseMessage[];
    tplConfig?: SkillTemplateConfig;
    emitter?: EventEmitter<SkillEventMap>;
  };
  metadata?: SkillRunnableMeta;
}

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
  SkillEvent,
  SkillTemplateConfig,
  Icon,
  Artifact,
  ActionStepMeta,
  ModelInfo,
} from '@refly-packages/openapi-schema';
import { EventEmitter } from 'node:stream';

export abstract class BaseSkill extends StructuredTool {
  /**
   * Skill template icon
   */
  icon: Icon = { type: 'emoji', value: '🔧' };
  /**
   * Skill placeholder
   */
  placeholder = '🔧';
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

  constructor(
    public engine: SkillEngine,
    protected params?: BaseToolParams,
  ) {
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
    const { emitter } = config?.configurable || {};

    if (!emitter) {
      return;
    }

    const eventData: SkillEvent = {
      event: data.event,
      step: config.metadata?.step,
      ...data,
    };

    if (!eventData.event) {
      if (eventData.log) {
        eventData.event = 'log';
      } else if (eventData.tokenUsage) {
        eventData.event = 'token_usage';
      } else if (eventData.structuredData) {
        eventData.event = 'structured_data';
      } else if (eventData.artifact) {
        eventData.event = 'artifact';
      }
    }

    emitter.emit(eventData.event, eventData);
  }

  async _call(
    input: typeof this.graphState,
    _runManager?: CallbackManagerForToolRun,
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

    const response = await this.toRunnable().invoke(input, {
      ...config,
      metadata: {
        ...config.metadata,
        ...config.configurable.currentSkill,
        resultId: config.configurable.resultId,
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
  images: {
    reducer: (x: string[], y: string[]) => x.concat(y),
    default: () => [],
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
    modelInfo?: ModelInfo;
    currentSkill?: SkillMeta;
    currentStep?: ActionStepMeta;
    chatHistory?: BaseMessage[];
    tplConfig?: SkillTemplateConfig;
    emitter?: EventEmitter<SkillEventMap>;
  };
  metadata?: SkillRunnableMeta;
}

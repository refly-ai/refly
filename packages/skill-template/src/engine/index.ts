import { SkillRunnableConfig } from '../base';

import { FakeListChatModel } from '@langchain/core/utils/testing';
import { OpenAIBaseInput } from '@langchain/openai';
import { ResourceType, ModelScene, LLMModelConfig } from '@refly/openapi-schema';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ReflyService } from '@refly/agent-tools';
import { getChatModel } from '@refly/providers';

// TODO: unify with frontend
export type ContentNodeType =
  | 'resource'
  | 'document'
  | 'extensionWeblink'
  | 'resourceSelection'
  | 'documentSelection'
  | 'urlSource';

export interface NodeMeta {
  title: string;
  nodeType: ContentNodeType;
  url?: string;
  canvasId?: string;
  resourceId?: string;
  resourceType?: ResourceType;
  [key: string]: any; // any other fields
}

export interface SkillEngineOptions {
  defaultModel?: string;
  config?: any;
}

import type { PinoLogger } from 'nestjs-pino';

export type Logger = PinoLogger;

export class SkillEngine {
  private config: SkillRunnableConfig;

  constructor(
    public logger: Logger,
    public service: ReflyService,
    private options?: SkillEngineOptions,
  ) {
    this.options = options;
  }

  setOptions(options: SkillEngineOptions) {
    this.options = { ...this.options, ...options };
  }

  configure(config: SkillRunnableConfig) {
    this.config = config;
  }

  getConfig(key?: string) {
    if (!this.options?.config) {
      this.logger.warn('No config found in skill engine, returning null');
      return null;
    }

    if (!key) {
      return this.options.config;
    }

    // Support nested keys like 'api.port'
    const keys = key.split('.');
    let value = this.options.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }

    return value;
  }

  chatModel(params?: Partial<OpenAIBaseInput>, scene?: ModelScene): BaseChatModel {
    if (process.env.MOCK_LLM_RESPONSE) {
      return new FakeListChatModel({
        responses: ['This is a test'],
        sleep: 100,
      });
    }

    const finalScene = scene || 'chat';

    const config = this.config?.configurable;
    const provider = config?.provider;
    const model = config.modelConfigMap?.[finalScene] as LLMModelConfig;
    const mode = config?.mode;

    return getChatModel(
      provider,
      model ?? { modelId: this.options.defaultModel, modelName: this.options.defaultModel },
      params,
      { mode, userId: config.user.uid },
    );
  }
}

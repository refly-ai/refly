import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { LLMResult } from '@langchain/core/outputs';
import { LangfuseClientManager } from './langfuse-client';
import { TraceManager } from './trace-manager';
import { createId } from '@paralleldrive/cuid2';

/**
 * Custom Langfuse callback handler that uses our TraceManager
 */
export class LangfuseCallbackHandler extends BaseCallbackHandler {
  name = 'refly_langfuse_callback_handler';

  private config: {
    userId?: string;
    sessionId?: string;
    traceName?: string;
    tags?: string[];
    enabled: boolean;
  };
  private traceManager: TraceManager;
  private runIdToGenerationId = new Map<string, string>();
  private traceId: string;

  constructor(
    config: {
      userId?: string;
      sessionId?: string;
      traceName?: string;
      tags?: string[];
    } = {},
  ) {
    super();
    this.config = {
      enabled: LangfuseClientManager.getInstance().isMonitoringEnabled(),
      ...config,
    };
    this.traceManager = new TraceManager();
    this.traceId = createId();

    // Create the main trace
    if (this.config.enabled) {
      this.traceManager.createTrace(this.traceId, this.config.traceName || 'LangChain Execution', {
        userId: this.config.userId,
        sessionId: this.config.sessionId,
        tags: this.config.tags,
      });
    }

    console.log('[Langfuse Custom] Created callback handler:', {
      userId: this.config.userId,
      sessionId: this.config.sessionId,
      traceName: this.config.traceName,
      tags: this.config.tags,
      enabled: this.config.enabled,
      traceId: this.traceId,
    });
  }

  // LLM callbacks - Using Generation for better Langfuse integration
  async handleLLMStart(
    llm: { [key: string]: any },
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.config.enabled) return;

    // Extract reproducible context from metadata (passed from agent.ts)
    const toolDefinitions = metadata?.toolDefinitions as
      | Array<{ name: string; description: string }>
      | undefined;
    const systemPrompt = metadata?.systemPrompt as string | undefined;
    const modelConfig = metadata?.modelConfig as
      | {
          modelId?: string;
          modelName?: string;
          temperature?: number;
          maxTokens?: number;
          provider?: string;
        }
      | undefined;

    console.log('[Langfuse Custom] LLM Start:', {
      runId,
      parentRunId,
      llmName: llm.constructor?.name,
      promptsCount: prompts.length,
      tags: [...(tags || []), ...(this.config.tags || [])],
      hasToolDefinitions: !!toolDefinitions?.length,
      hasSystemPrompt: !!systemPrompt,
      hasModelConfig: !!modelConfig,
    });

    const generationId = createId();
    this.runIdToGenerationId.set(runId, generationId);

    // Use createGeneration for LLM calls - supports modelParameters and unlimited input size
    this.traceManager.createGeneration(this.traceId, generationId, {
      name: this.config.traceName || `LLM: ${llm.constructor?.name || 'Unknown'}`,
      model: modelConfig?.modelId || modelConfig?.modelName,
      modelParameters: {
        temperature: modelConfig?.temperature,
        maxTokens: modelConfig?.maxTokens,
        provider: modelConfig?.provider,
      },
      input: {
        // Full prompts without truncation for reproducibility
        prompts,
        // System prompt stored separately for clarity
        systemPrompt,
        // Tool definitions for reproducibility (no size limit in input field)
        toolDefinitions,
        // Extra params from LangChain
        ...this.sanitizeData(extraParams || {}),
      },
      metadata: {
        type: 'langchain_llm',
        llmType: llm.constructor?.name,
        runId,
        parentRunId,
        tags: [...(tags || []), ...(this.config.tags || [])],
        sessionId: this.config.sessionId,
        userId: this.config.userId,
      },
    });
  }

  async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    if (!this.config.enabled) return;

    // Extract token usage from llmOutput if available
    const tokenUsage = output.llmOutput?.tokenUsage || output.llmOutput?.usage;

    console.log('[Langfuse Custom] LLM End:', {
      runId,
      generations: output.generations?.length,
      llmOutput: output.llmOutput,
      hasTokenUsage: !!tokenUsage,
    });

    const generationId = this.runIdToGenerationId.get(runId);
    if (generationId) {
      const generation = output.generations[0]?.[0];

      // Use endGeneration with full output and usage data
      this.traceManager.endGeneration(
        generationId,
        {
          // Full text without truncation for reproducibility
          text: generation?.text,
          generationInfo: generation?.generationInfo,
          llmOutput: output.llmOutput,
        },
        tokenUsage
          ? {
              promptTokens: tokenUsage.promptTokens || tokenUsage.prompt_tokens,
              completionTokens: tokenUsage.completionTokens || tokenUsage.completion_tokens,
              totalTokens: tokenUsage.totalTokens || tokenUsage.total_tokens,
            }
          : undefined,
        undefined,
        'DEFAULT',
      );

      this.runIdToGenerationId.delete(runId);
    }
  }

  async handleLLMError(err: Error, runId: string): Promise<void> {
    if (!this.config.enabled) return;

    console.log('[Langfuse Custom] LLM Error:', {
      runId,
      error: err.message,
    });

    const generationId = this.runIdToGenerationId.get(runId);
    if (generationId) {
      this.traceManager.endGeneration(
        generationId,
        {
          error: err.message,
          stack: err.stack,
        },
        undefined,
        err.message,
        'ERROR',
      );

      this.runIdToGenerationId.delete(runId);
    }
  }

  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        result[key] = this.truncateText(value, 500);
      } else if (typeof value === 'object') {
        result[key] = this.sanitizeData(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.substring(0, maxLength)}...`;
  }
}

/**
 * Get a base Langfuse callback handler
 */
export function getLangfuseCallbackHandler(): LangfuseCallbackHandler | null {
  try {
    const clientManager = LangfuseClientManager.getInstance();
    if (!clientManager.isMonitoringEnabled()) {
      console.warn('[Langfuse Custom] Monitoring disabled, callback handler not created');
      return null;
    }

    const handler = new LangfuseCallbackHandler();
    console.log('[Langfuse Custom] Created base callback handler');
    return handler;
  } catch (error) {
    console.error('[Langfuse Custom] Error creating callback handler:', error);
    return null;
  }
}

/**
 * Get a Langfuse callback handler with metadata
 */
export function getLangfuseCallbackHandlerWithMetadata(metadata: {
  userId?: string;
  sessionId?: string;
  traceName?: string;
  tags?: string[];
}): LangfuseCallbackHandler | null {
  try {
    const clientManager = LangfuseClientManager.getInstance();
    if (!clientManager.isMonitoringEnabled()) {
      console.warn(
        '[Langfuse Custom] Monitoring disabled, callback handler with metadata not created',
      );
      return null;
    }

    const handler = new LangfuseCallbackHandler(metadata);
    console.log('[Langfuse Custom] Created callback handler with metadata:', metadata);
    return handler;
  } catch (error) {
    console.error('[Langfuse Custom] Error creating callback handler with metadata:', error);
    return null;
  }
}

/**
 * Create Langfuse callbacks for a skill execution
 */
export function createLangfuseCallbacks(metadata: {
  userId?: string;
  sessionId?: string;
  traceName?: string;
  tags?: string[];
}) {
  const callback = getLangfuseCallbackHandlerWithMetadata(metadata);

  const result = {
    hasCallback: !!callback,
    callbacksLength: callback ? 1 : 0,
  };

  console.log('[Langfuse Custom] createLangfuseCallbacks result:', result);

  return callback ? [callback] : [];
}

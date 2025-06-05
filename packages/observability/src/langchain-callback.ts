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
  private runIdToSpanId = new Map<string, string>();
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

  // LLM callbacks
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

    console.log('[Langfuse Custom] LLM Start:', {
      runId,
      parentRunId,
      llmName: llm.constructor?.name,
      promptsCount: prompts.length,
      tags: [...(tags || []), ...(this.config.tags || [])],
    });

    const spanId = createId();
    this.runIdToSpanId.set(runId, spanId);

    this.traceManager.createSpan(this.traceId, spanId, {
      name: this.config.traceName || `LLM: ${llm.constructor?.name || 'Unknown'}`,
      input: {
        prompts: prompts.map((p) => this.truncateText(p, 1000)),
        ...this.sanitizeData(extraParams || {}),
      },
      metadata: {
        type: 'langchain_llm',
        llmType: llm.constructor?.name,
        runId,
        parentRunId,
        tags: [...(tags || []), ...(this.config.tags || [])],
        ...metadata,
        sessionId: this.config.sessionId,
        userId: this.config.userId,
      },
    });
  }

  async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    if (!this.config.enabled) return;

    console.log('[Langfuse Custom] LLM End:', {
      runId,
      generations: output.generations?.length,
      llmOutput: output.llmOutput,
    });

    const spanId = this.runIdToSpanId.get(runId);
    if (spanId) {
      const generation = output.generations[0]?.[0];

      this.traceManager.endSpan(
        spanId,
        {
          text: generation?.text ? this.truncateText(generation.text, 1000) : undefined,
          generationInfo: generation?.generationInfo,
          llmOutput: output.llmOutput,
        },
        undefined,
        'DEFAULT',
      );

      this.runIdToSpanId.delete(runId);
    }
  }

  async handleLLMError(err: Error, runId: string): Promise<void> {
    if (!this.config.enabled) return;

    console.log('[Langfuse Custom] LLM Error:', {
      runId,
      error: err.message,
    });

    const spanId = this.runIdToSpanId.get(runId);
    if (spanId) {
      this.traceManager.endSpan(
        spanId,
        {
          error: err.message,
          stack: err.stack,
        },
        err.message,
        'ERROR',
      );

      this.runIdToSpanId.delete(runId);
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

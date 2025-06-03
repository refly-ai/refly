import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { AgentAction, AgentFinish } from '@langchain/core/agents';
import { ChainValues } from '@langchain/core/utils/types';
import { Document } from '@langchain/core/documents';
import { LLMResult } from '@langchain/core/outputs';
import { getTraceManager } from '@refly/observability';
import { createId } from '@paralleldrive/cuid2';
import { Agent } from './skills/agent';

export interface LangfuseCallbackConfig {
  enabled?: boolean;
  sessionId?: string;
  userId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * LangChain callback handler for Langfuse integration
 */
export class LangfuseCallbackHandler extends BaseCallbackHandler {
  name = 'langfuse_callback_handler';

  private config: LangfuseCallbackConfig;
  private traceManager: any;
  private spanStack: string[] = [];
  private runIdToSpanId = new Map<string, string>();

  constructor(config: LangfuseCallbackConfig = {}) {
    super();
    this.config = {
      enabled: true,
      ...config,
    };
    this.traceManager = getTraceManager();
  }

  // Chain callbacks
  async handleChainStart(
    chain: { [key: string]: any },
    inputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: { [key: string]: any },
  ): Promise<void> {
    if (!this.config.enabled || !this.traceManager) return;

    const spanId = createId();
    this.runIdToSpanId.set(runId, spanId);
    this.spanStack.push(spanId);

    this.traceManager.createSpan({
      id: spanId,
      name: `Chain: ${chain.constructor?.name || 'Unknown'}`,
      input: this.sanitizeData(inputs),
      metadata: {
        type: 'langchain_chain',
        chainType: chain.constructor?.name,
        runId,
        parentRunId,
        tags: [...(tags || []), ...(this.config.tags || [])],
        ...metadata,
        ...this.config.metadata,
        sessionId: this.config.sessionId,
        userId: this.config.userId,
      },
    });
  }

  async handleChainEnd(outputs: ChainValues, runId: string): Promise<void> {
    if (!this.config.enabled || !this.traceManager) return;

    const spanId = this.runIdToSpanId.get(runId);
    if (spanId) {
      this.traceManager.updateSpan({
        id: spanId,
        output: this.sanitizeData(outputs),
        metadata: {
          type: 'langchain_chain',
          status: 'success',
        },
      });

      this.runIdToSpanId.delete(runId);
      this.spanStack = this.spanStack.filter((id) => id !== spanId);
    }
  }

  async handleChainError(err: Error, runId: string): Promise<void> {
    if (!this.config.enabled || !this.traceManager) return;

    const spanId = this.runIdToSpanId.get(runId);
    if (spanId) {
      this.traceManager.updateSpan({
        id: spanId,
        level: 'ERROR',
        statusMessage: err.message,
        output: {
          error: err.message,
          stack: err.stack,
        },
        metadata: {
          type: 'langchain_chain',
          status: 'error',
        },
      });

      this.runIdToSpanId.delete(runId);
      this.spanStack = this.spanStack.filter((id) => id !== spanId);
    }
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
    if (!this.config.enabled || !this.traceManager) return;

    const spanId = createId();
    this.runIdToSpanId.set(runId, spanId);
    this.spanStack.push(spanId);

    this.traceManager.createSpan({
      id: spanId,
      name: `LLM: ${llm.constructor?.name || 'Unknown'}`,
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
        ...this.config.metadata,
        sessionId: this.config.sessionId,
        userId: this.config.userId,
      },
    });
  }

  async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    if (!this.config.enabled || !this.traceManager) return;

    const spanId = this.runIdToSpanId.get(runId);
    if (spanId) {
      const generation = output.generations[0]?.[0];

      this.traceManager.updateSpan({
        id: spanId,
        output: {
          text: generation?.text ? this.truncateText(generation.text, 1000) : undefined,
          generationInfo: generation?.generationInfo,
          llmOutput: output.llmOutput,
        },
        usage: {
          promptTokens: output.llmOutput?.tokenUsage?.promptTokens,
          completionTokens: output.llmOutput?.tokenUsage?.completionTokens,
          totalTokens: output.llmOutput?.tokenUsage?.totalTokens,
        },
        metadata: {
          type: 'langchain_llm',
          status: 'success',
        },
      });

      this.runIdToSpanId.delete(runId);
      this.spanStack = this.spanStack.filter((id) => id !== spanId);
    }
  }

  async handleLLMError(err: Error, runId: string): Promise<void> {
    if (!this.config.enabled || !this.traceManager) return;

    const spanId = this.runIdToSpanId.get(runId);
    if (spanId) {
      this.traceManager.updateSpan({
        id: spanId,
        level: 'ERROR',
        statusMessage: err.message,
        output: {
          error: err.message,
          stack: err.stack,
        },
        metadata: {
          type: 'langchain_llm',
          status: 'error',
        },
      });

      this.runIdToSpanId.delete(runId);
      this.spanStack = this.spanStack.filter((id) => id !== spanId);
    }
  }

  // Tool callbacks
  async handleToolStart(
    tool: { [key: string]: any },
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: { [key: string]: any },
  ): Promise<void> {
    if (!this.config.enabled || !this.traceManager) return;

    const spanId = createId();
    this.runIdToSpanId.set(runId, spanId);
    this.spanStack.push(spanId);

    this.traceManager.createSpan({
      id: spanId,
      name: `Tool: ${tool.name || 'Unknown'}`,
      input: {
        input: this.truncateText(input, 1000),
        toolName: tool.name,
        description: tool.description,
      },
      metadata: {
        type: 'langchain_tool',
        toolName: tool.name,
        runId,
        parentRunId,
        tags: [...(tags || []), ...(this.config.tags || [])],
        ...metadata,
        ...this.config.metadata,
        sessionId: this.config.sessionId,
        userId: this.config.userId,
      },
    });
  }

  async handleToolEnd(output: string, runId: string): Promise<void> {
    if (!this.config.enabled || !this.traceManager) return;

    const spanId = this.runIdToSpanId.get(runId);
    if (spanId) {
      this.traceManager.updateSpan({
        id: spanId,
        output: {
          output: this.truncateText(output, 1000),
        },
        metadata: {
          type: 'langchain_tool',
          status: 'success',
        },
      });

      this.runIdToSpanId.delete(runId);
      this.spanStack = this.spanStack.filter((id) => id !== spanId);
    }
  }

  async handleToolError(err: Error, runId: string): Promise<void> {
    if (!this.config.enabled || !this.traceManager) return;

    const spanId = this.runIdToSpanId.get(runId);
    if (spanId) {
      this.traceManager.updateSpan({
        id: spanId,
        level: 'ERROR',
        statusMessage: err.message,
        output: {
          error: err.message,
          stack: err.stack,
        },
        metadata: {
          type: 'langchain_tool',
          status: 'error',
        },
      });

      this.runIdToSpanId.delete(runId);
      this.spanStack = this.spanStack.filter((id) => id !== spanId);
    }
  }

  // Agent callbacks
  async handleAgentAction(action: AgentAction, runId: string): Promise<void> {
    if (!this.config.enabled || !this.traceManager) return;

    const spanId = createId();
    this.runIdToSpanId.set(runId, spanId);
    this.spanStack.push(spanId);

    this.traceManager.createSpan({
      id: spanId,
      name: `Agent Action: ${action.tool}`,
      input: {
        tool: action.tool,
        toolInput: this.sanitizeData(action.toolInput),
        log: this.truncateText(action.log, 500),
      },
      metadata: {
        type: 'langchain_agent_action',
        tool: action.tool,
        runId,
        sessionId: this.config.sessionId,
        userId: this.config.userId,
      },
    });
  }

  async handleAgentEnd(action: AgentFinish, runId: string): Promise<void> {
    if (!this.config.enabled || !this.traceManager) return;

    const spanId = this.runIdToSpanId.get(runId);
    if (spanId) {
      this.traceManager.updateSpan({
        id: spanId,
        output: {
          returnValues: this.sanitizeData(action.returnValues),
          log: this.truncateText(action.log, 500),
        },
        metadata: {
          type: 'langchain_agent_finish',
          status: 'success',
        },
      });

      this.runIdToSpanId.delete(runId);
      this.spanStack = this.spanStack.filter((id) => id !== spanId);
    }
  }

  // Retriever callbacks
  async handleRetrieverStart(
    retriever: { [key: string]: any },
    query: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: { [key: string]: any },
  ): Promise<void> {
    if (!this.config.enabled || !this.traceManager) return;

    const spanId = createId();
    this.runIdToSpanId.set(runId, spanId);
    this.spanStack.push(spanId);

    this.traceManager.createSpan({
      id: spanId,
      name: `Retriever: ${retriever.constructor?.name || 'Unknown'}`,
      input: {
        query: this.truncateText(query, 500),
      },
      metadata: {
        type: 'langchain_retriever',
        retrieverType: retriever.constructor?.name,
        runId,
        parentRunId,
        tags: [...(tags || []), ...(this.config.tags || [])],
        ...metadata,
        ...this.config.metadata,
        sessionId: this.config.sessionId,
        userId: this.config.userId,
      },
    });
  }

  async handleRetrieverEnd(documents: Document[], runId: string): Promise<void> {
    if (!this.config.enabled || !this.traceManager) return;

    const spanId = this.runIdToSpanId.get(runId);
    if (spanId) {
      this.traceManager.updateSpan({
        id: spanId,
        output: {
          documentCount: documents.length,
          documents: documents.slice(0, 3).map((doc) => ({
            pageContent: this.truncateText(doc.pageContent, 200),
            metadata: this.sanitizeData(doc.metadata),
          })),
        },
        metadata: {
          type: 'langchain_retriever',
          status: 'success',
          documentCount: documents.length,
        },
      });

      this.runIdToSpanId.delete(runId);
      this.spanStack = this.spanStack.filter((id) => id !== spanId);
    }
  }

  async handleRetrieverError(err: Error, runId: string): Promise<void> {
    if (!this.config.enabled || !this.traceManager) return;

    const spanId = this.runIdToSpanId.get(runId);
    if (spanId) {
      this.traceManager.updateSpan({
        id: spanId,
        level: 'ERROR',
        statusMessage: err.message,
        output: {
          error: err.message,
          stack: err.stack,
        },
        metadata: {
          type: 'langchain_retriever',
          status: 'error',
        },
      });

      this.runIdToSpanId.delete(runId);
      this.spanStack = this.spanStack.filter((id) => id !== spanId);
    }
  }

  /**
   * Sanitize data by removing sensitive information
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential', 'api_key'];
    const result = Array.isArray(data) ? [...data] : { ...data };

    for (const [key, value] of Object.entries(result)) {
      if (
        sensitiveKeys.some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey.toLowerCase()))
      ) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitizeData(value);
      }
    }

    return result;
  }

  /**
   * Truncate text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.runIdToSpanId.clear();
    this.spanStack = [];
  }
}

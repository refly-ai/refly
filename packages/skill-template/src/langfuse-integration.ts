import { LangfuseListener } from './langfuse-listener';
import { LangfuseCallbackHandler } from './langchain-callback';
import { getTraceManager } from '@refly/observability';
import { createId } from '@paralleldrive/cuid2';
import type { Agent } from './skills/agent';

/**
 * Configuration for Langfuse integration
 */
export interface LangfuseIntegrationConfig {
  enabled?: boolean;
  sessionId?: string;
  userId?: string;
  tags?: string[];
  metadata?: Record<string, any>;

  // Event listener configuration
  eventListener?: {
    enabled?: boolean;
    includeEvents?: string[];
    excludeEvents?: string[];
  };

  // LangChain callback configuration
  langchainCallback?: {
    enabled?: boolean;
  };
}

/**
 * Langfuse integration helper for skill-template
 */
export class LangfuseIntegration {
  private config: LangfuseIntegrationConfig;
  private eventListener?: LangfuseListener;
  private langchainCallback?: LangfuseCallbackHandler;
  private traceManager: any;

  constructor(config: LangfuseIntegrationConfig = {}) {
    this.config = {
      enabled: true,
      eventListener: { enabled: true },
      langchainCallback: { enabled: true },
      ...config,
    };

    this.traceManager = getTraceManager();
    this.initialize();
  }

  /**
   * Initialize Langfuse integration components
   */
  private initialize(): void {
    if (!this.config.enabled || !this.traceManager) {
      return;
    }

    // Initialize event listener
    if (this.config.eventListener?.enabled) {
      this.eventListener = new LangfuseListener({
        enabled: true,
        includeEvents: this.config.eventListener.includeEvents,
        excludeEvents: this.config.eventListener.excludeEvents,
      });
    }

    // Initialize LangChain callback handler
    if (this.config.langchainCallback?.enabled) {
      this.langchainCallback = new LangfuseCallbackHandler({
        enabled: true,
        sessionId: this.config.sessionId,
        userId: this.config.userId,
        tags: this.config.tags,
        metadata: this.config.metadata,
      });
    }
  }

  /**
   * Attach monitoring to an Agent instance
   */
  attachToAgent(agent: any): void {
    if (!this.config.enabled) return;

    // Attach event listener to agent's emitter
    if (this.eventListener && agent.emitter) {
      this.eventListener.attachToEmitter(agent.emitter);
    }
  }

  /**
   * Get LangChain callback handler for use with LangChain components
   */
  getLangChainCallback(): LangfuseCallbackHandler | undefined {
    return this.langchainCallback;
  }

  /**
   * Create a trace for a skill execution
   */
  createSkillTrace(skillName: string, input: any): string {
    const traceId = createId();
    this.traceManager?.createTrace(traceId, {
      name: skillName,
      input,
      metadata: {
        skillName,
        type: 'skill',
      },
    });
    return traceId;
  }

  /**
   * Update a skill trace with results
   */
  updateSkillTrace(traceId: string, output: any): void {
    this.traceManager?.updateTrace(traceId, {
      output,
    });
  }

  /**
   * Mark a skill trace as failed
   */
  failSkillTrace(traceId: string, error: any): void {
    this.traceManager?.updateTrace(traceId, {
      output: { error: error?.message || error },
    });
  }

  /**
   * Create a span for a specific operation
   */
  createSpan(traceId: string, name: string, input?: any): string {
    const spanId = createId();
    this.traceManager?.createSpan(traceId, spanId, {
      name,
      input,
    });
    return spanId;
  }

  /**
   * Update a span with results
   */
  updateSpan(spanId: string, output: any): void {
    this.traceManager?.endSpan(spanId, output);
  }

  /**
   * Mark a span as failed
   */
  failSpan(spanId: string, error: any): void {
    this.traceManager?.endSpan(spanId, { error: error?.message || error }, error?.message, 'ERROR');
  }

  /**
   * Log a generation (LLM call) with token usage
   */
  logGeneration(
    name: string,
    input: string,
    output: string,
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    },
    metadata?: Record<string, any>,
  ): void {
    if (!this.config.enabled || !this.traceManager) return;

    this.traceManager.createGeneration({
      name,
      input: this.truncateText(input, 2000),
      output: this.truncateText(output, 2000),
      usage,
      metadata: {
        sessionId: this.config.sessionId,
        userId: this.config.userId,
        tags: this.config.tags,
        ...this.config.metadata,
        ...metadata,
      },
    });
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
    if (this.langchainCallback) {
      this.langchainCallback.cleanup();
    }
  }
}

/**
 * Factory function to create a configured Langfuse integration
 */
export function createLangfuseIntegration(config?: LangfuseIntegrationConfig): LangfuseIntegration {
  return new LangfuseIntegration(config);
}

/**
 * Decorator to automatically trace method calls
 */
export function traced(name?: string) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const traceName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const traceManager = getTraceManager();
      if (!traceManager) {
        return originalMethod.apply(this, args);
      }

      const spanId = createId();
      const traceId = createId();
      
      // Create a trace first
      traceManager.createTrace(traceId, traceName, {
        metadata: {
          type: 'method_call',
          className: target.constructor.name,
          methodName: propertyKey,
        },
      });

      // Create a span within the trace
      traceManager.createSpan(traceId, spanId, {
        name: traceName,
        input: args.length > 0 ? { arguments: args } : undefined,
      });

      try {
        const result = await originalMethod.apply(this, args);

        if (spanId) {
          traceManager.endSpan(spanId, result);
        }

        return result;
      } catch (error) {
        if (spanId) {
          traceManager.endSpan(spanId, { error: String(error) }, String(error), 'ERROR');
        }
        throw error;
      }
    };

    return descriptor;
  };
}

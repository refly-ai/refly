import type { LangfuseTraceClient, LangfuseSpanClient, LangfuseGenerationClient } from 'langfuse';
import { LangfuseClientManager } from './langfuse-client';

export interface TraceMetadata {
  userId?: string;
  sessionId?: string;
  projectId?: string;
  skillName?: string;
  version?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface SpanData {
  name: string;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
  level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
  statusMessage?: string;
  version?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface GenerationData {
  name: string;
  model?: string;
  modelParameters?: Record<string, any>;
  input?: any;
  output?: any;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, any>;
  level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
  statusMessage?: string;
  version?: string;
  startTime?: Date;
  endTime?: Date;
}

/**
 * Trace manager for handling Langfuse traces and spans
 */
export class TraceManager {
  private clientManager: LangfuseClientManager;
  private activeTraces: Map<string, LangfuseTraceClient> = new Map();
  private activeSpans: Map<string, LangfuseSpanClient> = new Map();
  private activeGenerations: Map<string, LangfuseGenerationClient> = new Map();

  constructor() {
    this.clientManager = LangfuseClientManager.getInstance();
  }

  /**
   * Create a new trace
   */
  createTrace(
    traceId: string,
    name: string,
    metadata: TraceMetadata = {},
  ): LangfuseTraceClient | null {
    const client = this.clientManager.getClient();
    if (!client || !this.clientManager.isMonitoringEnabled()) {
      return null;
    }

    try {
      const filteredMetadata = this.clientManager.filterData(metadata);

      const trace = client.trace({
        id: traceId,
        name,
        userId: metadata.userId,
        sessionId: metadata.sessionId,
        version: metadata.version,
        tags: metadata.tags,
        metadata: filteredMetadata.metadata,
      });

      this.activeTraces.set(traceId, trace);
      return trace;
    } catch (error) {
      console.error('[TraceManager] Failed to create trace:', error);
      return null;
    }
  }

  /**
   * Get an existing trace
   */
  getTrace(traceId: string): LangfuseTraceClient | null {
    return this.activeTraces.get(traceId) || null;
  }

  /**
   * Create a span within a trace
   */
  createSpan(
    traceId: string,
    spanId: string,
    spanData: SpanData,
    parentSpanId?: string,
  ): LangfuseSpanClient | null {
    const trace = this.getTrace(traceId);
    if (!trace) {
      console.warn(`[TraceManager] Trace ${traceId} not found for span creation`);
      return null;
    }

    try {
      const filteredData = this.clientManager.filterData(spanData);

      const spanOptions: any = {
        id: spanId,
        name: filteredData.name,
        input: filteredData.input,
        metadata: filteredData.metadata,
        level: filteredData.level || 'DEFAULT',
        version: filteredData.version,
      };

      if (filteredData.startTime) {
        spanOptions.startTime = filteredData.startTime;
      }

      let span: LangfuseSpanClient;

      if (parentSpanId) {
        const parentSpan = this.activeSpans.get(parentSpanId);
        if (parentSpan) {
          span = parentSpan.span(spanOptions);
        } else {
          span = trace.span(spanOptions);
        }
      } else {
        span = trace.span(spanOptions);
      }

      this.activeSpans.set(spanId, span);
      return span;
    } catch (error) {
      console.error('[TraceManager] Failed to create span:', error);
      return null;
    }
  }

  /**
   * Update span with output and end it
   */
  endSpan(
    spanId: string,
    output?: any,
    statusMessage?: string,
    level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR',
  ): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      return;
    }

    try {
      const filteredOutput = this.clientManager.filterData(output);

      span.update({
        output: filteredOutput,
        statusMessage,
        level: level || 'DEFAULT',
        endTime: new Date(),
      });

      this.activeSpans.delete(spanId);
    } catch (error) {
      console.error('[TraceManager] Failed to end span:', error);
    }
  }

  /**
   * Create a generation (LLM call) within a trace
   */
  createGeneration(
    traceId: string,
    generationId: string,
    generationData: GenerationData,
    parentSpanId?: string,
  ): LangfuseGenerationClient | null {
    const trace = this.getTrace(traceId);
    if (!trace) {
      console.warn(`[TraceManager] Trace ${traceId} not found for generation creation`);
      return null;
    }

    try {
      const filteredData = this.clientManager.filterData(generationData);

      const generationOptions: any = {
        id: generationId,
        name: filteredData.name,
        model: filteredData.model,
        modelParameters: filteredData.modelParameters,
        input: filteredData.input,
        metadata: filteredData.metadata,
        level: filteredData.level || 'DEFAULT',
        version: filteredData.version,
      };

      if (filteredData.startTime) {
        generationOptions.startTime = filteredData.startTime;
      }

      let generation: LangfuseGenerationClient;

      if (parentSpanId) {
        const parentSpan = this.activeSpans.get(parentSpanId);
        if (parentSpan) {
          generation = parentSpan.generation(generationOptions);
        } else {
          generation = trace.generation(generationOptions);
        }
      } else {
        generation = trace.generation(generationOptions);
      }

      this.activeGenerations.set(generationId, generation);
      return generation;
    } catch (error) {
      console.error('[TraceManager] Failed to create generation:', error);
      return null;
    }
  }

  /**
   * Update generation with output and usage, then end it
   */
  endGeneration(
    generationId: string,
    output?: any,
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    },
    statusMessage?: string,
    level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR',
  ): void {
    const generation = this.activeGenerations.get(generationId);
    if (!generation) {
      return;
    }

    try {
      const filteredOutput = this.clientManager.filterData(output);

      generation.update({
        output: filteredOutput,
        usage,
        statusMessage,
        level: level || 'DEFAULT',
        endTime: new Date(),
      });

      this.activeGenerations.delete(generationId);
    } catch (error) {
      console.error('[TraceManager] Failed to end generation:', error);
    }
  }

  /**
   * End a trace
   */
  endTrace(traceId: string, output?: any): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      return;
    }

    try {
      const filteredOutput = this.clientManager.filterData(output);

      trace.update({
        output: filteredOutput,
      });

      this.activeTraces.delete(traceId);
    } catch (error) {
      console.error('[TraceManager] Failed to end trace:', error);
    }
  }

  /**
   * Record an error in a trace, span, or generation
   */
  recordError(
    id: string,
    error: Error | string,
    type: 'trace' | 'span' | 'generation' = 'span',
  ): void {
    try {
      const errorMessage = typeof error === 'string' ? error : error.message;
      const errorStack = typeof error === 'object' && error.stack ? error.stack : undefined;

      switch (type) {
        case 'trace': {
          const trace = this.activeTraces.get(id);
          if (trace) {
            trace.update({
              metadata: {
                error: errorMessage,
                errorStack: errorStack,
              },
            });
          }
          break;
        }
        case 'span': {
          const span = this.activeSpans.get(id);
          if (span) {
            span.update({
              level: 'ERROR',
              statusMessage: errorMessage,
              metadata: { error: errorStack },
            });
          }
          break;
        }
        case 'generation': {
          const generation = this.activeGenerations.get(id);
          if (generation) {
            generation.update({
              level: 'ERROR',
              statusMessage: errorMessage,
              metadata: { error: errorStack },
            });
          }
          break;
        }
      }
    } catch (err) {
      console.error('[TraceManager] Failed to record error:', err);
    }
  }

  /**
   * Clean up all active traces, spans, and generations
   */
  cleanup(): void {
    this.activeTraces.clear();
    this.activeSpans.clear();
    this.activeGenerations.clear();
  }

  /**
   * Get statistics about active traces
   */
  getStats(): {
    activeTraces: number;
    activeSpans: number;
    activeGenerations: number;
  } {
    return {
      activeTraces: this.activeTraces.size,
      activeSpans: this.activeSpans.size,
      activeGenerations: this.activeGenerations.size,
    };
  }
}

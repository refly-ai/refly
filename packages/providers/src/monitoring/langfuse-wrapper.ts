import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import { encode } from 'gpt-tokenizer';

// Try to import TraceManager from observability package if available
let TraceManager: any = null;
try {
  const observabilityModule = require('@refly/observability/trace-manager');
  TraceManager = observabilityModule.TraceManager;
} catch (_error) {
  console.warn('[Providers Monitoring] TraceManager not available, using basic span tracking');
}

/**
 * Calculate accurate token usage for inputs and outputs
 */
const calculateAccurateTokenUsage = (input: any, output: string) => {
  const inputText = Array.isArray(input)
    ? input.map((msg) => (typeof msg?.content === 'string' ? msg.content : '')).join('')
    : String(input || '');

  // Use tiktoken for accurate calculation
  try {
    const promptTokens = encode(inputText).length;
    const completionTokens = encode(output || '').length;

    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  } catch (error) {
    console.warn('[Providers Monitoring] gpt-tokenizer error:', error);
    const promptTokens = Math.ceil(inputText.length / 4);
    const completionTokens = Math.ceil((output || '').length / 4);

    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }
};

// Simple ID generation function
function createId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Lazy loaded monitoring components
let langfuseInstance: any = null;
let isMonitoringEnabled = false;

// Configuration interface
interface MonitoringConfig {
  publicKey?: string;
  secretKey?: string;
  baseUrl?: string;
  enabled?: boolean;
}

// Global configuration
let _globalConfig: MonitoringConfig = {
  enabled: false,
};

/**
 * Initialize monitoring with configuration
 */
export function initializeMonitoring(config: MonitoringConfig) {
  _globalConfig = { ...config };
  isMonitoringEnabled = config.enabled && !!config.publicKey && !!config.secretKey;

  if (isMonitoringEnabled) {
    try {
      // Lazy load Langfuse to avoid dependency issues
      const { Langfuse } = require('langfuse');
      langfuseInstance = new Langfuse({
        publicKey: config.publicKey,
        secretKey: config.secretKey,
        baseUrl: config.baseUrl,
      });
    } catch (error) {
      console.warn(
        '[Providers Monitoring] Langfuse not available, monitoring disabled:',
        error.message,
      );
      isMonitoringEnabled = false;
    }
  }
}

/**
 * Create a trace for monitoring operations
 */
function createTrace(userId?: string, metadata: Record<string, any> = {}) {
  if (!isMonitoringEnabled || !langfuseInstance) {
    return null;
  }

  try {
    const traceId = createId();
    const trace = langfuseInstance.trace({
      id: traceId,
      name: 'Model Operation',
      userId: userId || 'anonymous',
      metadata,
    });

    return {
      createSpan: (spanOptions: { name: string; input?: any; metadata?: any }) => {
        const spanId = createId();
        const span = trace.span({
          id: spanId,
          name: spanOptions.name,
          input: spanOptions.input,
          metadata: spanOptions.metadata,
          startTime: new Date(),
        });

        return {
          update: (data: {
            output?: any;
            statusMessage?: string;
            level?: string;
            metadata?: any;
          }) => {
            span.update({
              output: data.output,
              statusMessage: data.statusMessage,
              level: data.level || 'DEFAULT',
              metadata: data.metadata,
              endTime: new Date(),
            });
          },
          error: (error: Error | string) => {
            span.update({
              statusMessage: typeof error === 'string' ? error : error.message,
              level: 'ERROR',
              endTime: new Date(),
            });
          },
        };
      },
    };
  } catch (error) {
    console.error('[Providers Monitoring] Failed to create trace:', error);
    return null;
  }
}

/**
 * Wrap a chat model with monitoring capabilities
 */
export function wrapChatModelWithMonitoring(
  model: BaseChatModel,
  context: { userId?: string; modelId?: string; provider?: string; mode?: string } = {},
): BaseChatModel {
  if (!isMonitoringEnabled) {
    return model;
  }

  const trace = createTrace(context.userId, {
    type: 'llm',
    modelId: context.modelId,
    provider: context.provider,
  });

  if (!trace) {
    return model;
  }

  // Wrap invoke method
  const originalInvoke = model.invoke.bind(model);
  model.invoke = async (input, options) => {
    const span = trace.createSpan({
      name: 'llm_invoke',
      input: { messages: input },
      metadata: {
        operation: 'invoke',
        mode: context.mode,
        modelId: context.modelId,
        provider: context.provider,
      },
    });

    try {
      const result = await originalInvoke(input, options);

      // Extract usage data or calculate accurately
      const usage = result.usage_metadata
        ? {
            promptTokens: result.usage_metadata.input_tokens || 0,
            completionTokens: result.usage_metadata.output_tokens || 0,
            totalTokens:
              result.usage_metadata.total_tokens ||
              result.usage_metadata.input_tokens + result.usage_metadata.output_tokens,
          }
        : calculateAccurateTokenUsage(input, result.content || '');

      const outputData: Record<string, any> = {
        usage,
        ...(result.content && { content: result.content }),
      };

      // Capture tool_calls information if present
      if (result.tool_calls && Array.isArray(result.tool_calls) && result.tool_calls.length > 0) {
        outputData.tool_calls = result.tool_calls;
      }

      span.update({
        output: outputData,
        level: 'DEFAULT',
      });
      return result;
    } catch (error) {
      span.error(error);
      throw error;
    }
  };

  // Wrap stream method if available
  if (model.stream) {
    const originalStream = model.stream.bind(model);
    model.stream = async (input, options) => {
      const span = trace.createSpan({
        name: 'llm_stream',
        input: { messages: input },
        metadata: {
          operation: 'stream',
          modelId: context.modelId,
          provider: context.provider,
        },
      });

      try {
        const stream = await originalStream(input, options);

        // Create a new readable stream that logs the output
        const monitoredStream = new ReadableStream({
          async start(controller) {
            const chunks = [];
            let finalUsage = null;
            let toolCalls = [];

            try {
              for await (const chunk of stream) {
                chunks.push(chunk);
                controller.enqueue(chunk);

                // Capture usage metadata from streaming chunks (similar to skill.service.ts)
                if (chunk.usage_metadata) {
                  finalUsage = {
                    promptTokens: chunk.usage_metadata.input_tokens || 0,
                    completionTokens: chunk.usage_metadata.output_tokens || 0,
                    totalTokens:
                      chunk.usage_metadata.total_tokens ||
                      chunk.usage_metadata.input_tokens + chunk.usage_metadata.output_tokens,
                  };
                }

                // Capture tool_calls from streaming chunks
                if (chunk.tool_calls && Array.isArray(chunk.tool_calls)) {
                  toolCalls = [...toolCalls, ...chunk.tool_calls];
                }
              }

              // Log the complete output with usage
              const fullContent = chunks.map((c) => c.content).join('');
              const usage = finalUsage || calculateAccurateTokenUsage(input, fullContent);

              const outputData: Record<string, any> = {
                content: fullContent,
                chunkCount: chunks.length,
                usage,
              };

              // Add tool_calls to output if present
              if (toolCalls.length > 0) {
                outputData.tool_calls = toolCalls;
              }

              span.update({
                output: outputData,
                level: 'DEFAULT',
              });

              controller.close();
            } catch (error) {
              span.error(error);
              controller.error(error);
            }
          },
        });

        return monitoredStream as any;
      } catch (error) {
        span.error(error);
        throw error;
      }
    };
  }

  return model;
}

/**
 * Wrap embeddings with monitoring capabilities
 */
export function wrapEmbeddingsWithMonitoring(
  embeddings: Embeddings,
  context: { userId?: string; modelId?: string; provider?: string } = {},
): Embeddings {
  if (!isMonitoringEnabled) {
    return embeddings;
  }

  const trace = createTrace(context.userId, {
    type: 'embeddings',
    modelId: context.modelId,
    provider: context.provider,
  });

  if (!trace) {
    return embeddings;
  }

  // Wrap embedDocuments method
  const originalEmbedDocuments = embeddings.embedDocuments.bind(embeddings);
  embeddings.embedDocuments = async (documents: string[]) => {
    const span = trace.createSpan({
      name: 'embed_documents',
      input: { documentCount: documents.length },
      metadata: {
        operation: 'embedDocuments',
        modelId: context.modelId,
        provider: context.provider,
      },
    });

    try {
      const result = await originalEmbedDocuments(documents);
      span.update({
        output: {
          vectorCount: result.length,
          dimensions: result[0]?.length || 0,
        },
        level: 'DEFAULT',
      });
      return result;
    } catch (error) {
      span.error(error);
      throw error;
    }
  };

  // Wrap embedQuery method
  const originalEmbedQuery = embeddings.embedQuery.bind(embeddings);
  embeddings.embedQuery = async (query: string) => {
    const span = trace.createSpan({
      name: 'embed_query',
      input: { query: query.substring(0, 100) + (query.length > 100 ? '...' : '') },
      metadata: {
        operation: 'embedQuery',
        modelId: context.modelId,
        provider: context.provider,
      },
    });

    try {
      const result = await originalEmbedQuery(query);
      span.update({
        output: {
          dimensions: result.length,
        },
        level: 'DEFAULT',
      });
      return result;
    } catch (error) {
      span.error(error);
      throw error;
    }
  };

  return embeddings;
}

/**
 * Shutdown monitoring
 */
export async function shutdownMonitoring(): Promise<void> {
  if (langfuseInstance) {
    try {
      await langfuseInstance.shutdownAsync();
    } catch (error) {
      console.error('[Providers Monitoring] Error shutting down:', error);
    }
  }
}

/**
 * Enhanced wrapper for model calls with generation tracking and precise token usage
 */
export async function wrapModelCallWithGeneration(
  originalCall: () => Promise<any>,
  traceData: {
    input: string | any[];
    name?: string;
    metadata?: Record<string, any>;
    tags?: string[];
  },
): Promise<any> {
  const startTime = Date.now();
  let generation: any = null;

  try {
    // Use TraceManager if available
    if (TraceManager) {
      generation = TraceManager.startGeneration({
        name: traceData.name || 'langchain_call',
        input: traceData.input,
        metadata: {
          ...traceData.metadata,
          startTime: new Date().toISOString(),
        },
        tags: traceData.tags || ['langchain', 'model_call'],
      });
    }

    const result = await originalCall();
    const endTime = Date.now();

    // Calculate usage data
    let usage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    // Extract from result.usage_metadata if available
    if (result?.usage_metadata) {
      usage = {
        promptTokens: result.usage_metadata.input_tokens || 0,
        completionTokens: result.usage_metadata.output_tokens || 0,
        totalTokens:
          result.usage_metadata.total_tokens ||
          (result.usage_metadata.input_tokens || 0) + (result.usage_metadata.output_tokens || 0),
      };
    } else {
      // Calculate accurate token usage using tiktoken
      const calculatedUsage = await calculateAccurateTokenUsage(
        traceData.input,
        result?.content || result?.text || '',
      );
      usage = calculatedUsage;
    }

    // Update generation with results
    if (generation && TraceManager) {
      TraceManager.endGeneration(generation, {
        output: result?.content || result?.text || result,
        usage: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          unit: 'TOKENS',
        },
        model: traceData.metadata?.model,
        duration: endTime - startTime,
        endTime: new Date().toISOString(),
      });
    }

    return result;
  } catch (error) {
    // Log error in generation if available
    if (generation && TraceManager) {
      TraceManager.endGeneration(generation, {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    }
    throw error;
  }
}

/**
 * Enhanced wrapper for streaming model calls with generation tracking
 */
export async function* wrapModelStreamWithGeneration(
  originalStream: () => AsyncIterable<any>,
  traceData: {
    input: string | any[];
    name?: string;
    metadata?: Record<string, any>;
    tags?: string[];
  },
): AsyncIterable<any> {
  const startTime = Date.now();
  let generation: any = null;
  let completeOutput = '';
  let totalUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  try {
    // Use TraceManager if available
    if (TraceManager) {
      generation = TraceManager.startGeneration({
        name: traceData.name || 'langchain_stream',
        input: traceData.input,
        metadata: {
          ...traceData.metadata,
          startTime: new Date().toISOString(),
          streaming: true,
        },
        tags: [...(traceData.tags || []), 'langchain', 'streaming'],
      });
    }

    for await (const chunk of originalStream()) {
      // Accumulate output
      if (chunk?.content) {
        completeOutput += chunk.content;
      }

      // Extract usage from chunk if available
      if (chunk?.usage_metadata) {
        totalUsage = {
          promptTokens: chunk.usage_metadata.input_tokens || totalUsage.promptTokens,
          completionTokens: chunk.usage_metadata.output_tokens || totalUsage.completionTokens,
          totalTokens:
            chunk.usage_metadata.total_tokens ||
            (chunk.usage_metadata.input_tokens || 0) + (chunk.usage_metadata.output_tokens || 0),
        };
      }

      yield chunk;
    }

    // Calculate final usage if not available from chunks
    if (totalUsage.totalTokens === 0) {
      const calculatedUsage = await calculateAccurateTokenUsage(traceData.input, completeOutput);
      totalUsage = calculatedUsage;
    }

    const endTime = Date.now();

    // End generation with complete data
    if (generation && TraceManager) {
      TraceManager.endGeneration(generation, {
        output: completeOutput,
        usage: {
          promptTokens: totalUsage.promptTokens,
          completionTokens: totalUsage.completionTokens,
          totalTokens: totalUsage.totalTokens,
          unit: 'TOKENS',
        },
        model: traceData.metadata?.model,
        duration: endTime - startTime,
        endTime: new Date().toISOString(),
      });
    }
  } catch (error) {
    // Log error in generation if available
    if (generation && TraceManager) {
      TraceManager.endGeneration(generation, {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    }
    throw error;
  }
}

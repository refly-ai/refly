import { Injectable, OnModuleInit } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { metrics } from '@opentelemetry/api';
import type { Counter, Histogram } from '@opentelemetry/api';

interface TokenData {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/**
 * Skill invocation metrics service
 *
 * Provides business-friendly API for recording LLM and tool invocation metrics.
 * Automatically exports to Prometheus via OpenTelemetry.
 *
 * Architecture:
 * - Low cardinality labels: minimize label combinations
 * - Metrics aggregation: counters and histograms for analysis
 * - No traceId in metrics: use logs for detailed correlation
 *
 * Usage:
 *   this.metrics.llm.success()
 *   this.metrics.llm.fail({ error })
 *   this.metrics.llm.duration(durationMs)
 *   this.metrics.llm.token({ inputTokens, outputTokens, ... })
 *   this.metrics.llm.cost({ ... })
 *
 *   this.metrics.tool.success({ toolName, toolsetKey })
 *   this.metrics.tool.fail({ toolName, toolsetKey, error })
 *   this.metrics.tool.duration(toolName, toolsetKey, durationMs)
 */
@Injectable()
export class SkillInvokeMetrics implements OnModuleInit {
  private meter = metrics.getMeter('refly-api');

  // Internal OpenTelemetry metrics instances
  private llmInvocationCounter!: Counter;
  private llmDurationHistogram!: Histogram;
  private llmTokenCounter!: Counter;
  private llmCostCounter!: Counter;
  private toolInvocationCounter!: Counter;
  private toolDurationHistogram!: Histogram;

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(SkillInvokeMetrics.name);
  }

  async onModuleInit() {
    this.logger.info('Initializing Skill Invoke metrics monitoring');
    this.initializeMetrics();
  }

  private initializeMetrics() {
    // LLM metrics
    this.llmInvocationCounter = this.meter.createCounter('llm.invocation.count', {
      description: 'Total number of LLM invocations',
    });

    this.llmDurationHistogram = this.meter.createHistogram('llm.invocation.duration', {
      description: 'LLM invocation duration in milliseconds',
      unit: 'ms',
    });

    this.llmTokenCounter = this.meter.createCounter('llm.token.count', {
      description: 'LLM token consumption',
    });

    this.llmCostCounter = this.meter.createCounter('llm.cost.total', {
      description: 'LLM cost in USD cents',
      unit: 'cents',
    });

    // Tool metrics
    this.toolInvocationCounter = this.meter.createCounter('tool.invocation.count', {
      description: 'Total number of tool invocations',
    });

    this.toolDurationHistogram = this.meter.createHistogram('tool.execution.duration', {
      description: 'Tool execution duration in milliseconds',
      unit: 'ms',
    });

    this.logger.info('Skill Invoke metrics initialized successfully');
  }

  /**
   * Public API for LLM invocation metrics
   */
  llm = {
    /**
     * Record successful LLM invocation
     * @param modelName - Model name (e.g., 'claude-3-5-sonnet-20241022')
     */
    success: (modelName: string): void => {
      this.llmInvocationCounter.add(1, { status: 'success', model_name: modelName });
    },

    /**
     * Record failed LLM invocation
     * @param modelName - Model name
     */
    fail: (modelName: string): void => {
      this.llmInvocationCounter.add(1, { status: 'error', model_name: modelName });
    },

    /**
     * Record LLM invocation duration
     * @param modelName - Model name
     * @param durationMs - Duration in milliseconds
     */
    duration: (modelName: string, durationMs: number): void => {
      this.llmDurationHistogram.record(durationMs, { model_name: modelName });
    },

    /**
     * Record token consumption
     * @param data - Token counts by type and model name
     */
    token: (data: TokenData & { modelName: string }): void => {
      this.llmTokenCounter.add(data.inputTokens, {
        token_type: 'input',
        model_name: data.modelName,
      });
      this.llmTokenCounter.add(data.outputTokens, {
        token_type: 'output',
        model_name: data.modelName,
      });

      if (data.cacheReadTokens > 0) {
        this.llmTokenCounter.add(data.cacheReadTokens, {
          token_type: 'cache_read',
          model_name: data.modelName,
        });
      }

      if (data.cacheWriteTokens > 0) {
        this.llmTokenCounter.add(data.cacheWriteTokens, {
          token_type: 'cache_write',
          model_name: data.modelName,
        });
      }
    },
  };

  /**
   * Public API for tool invocation metrics
   */
  tool = {
    /**
     * Record successful tool invocation
     * @param data.toolName - Tool name
     * @param data.toolsetKey - Toolset key (e.g., 'regular', 'composio', 'mcp')
     */
    success: (data: { toolName: string; toolsetKey: string }): void => {
      this.toolInvocationCounter.add(1, {
        tool_name: data.toolName,
        toolset_key: data.toolsetKey,
        status: 'success',
      });
    },

    /**
     * Record failed tool invocation
     * @param data.toolName - Tool name
     * @param data.toolsetKey - Toolset key
     * @param data.error - Error message (currently unused, reserved for future)
     */
    fail: (data: { toolName: string; toolsetKey: string; error: string }): void => {
      this.toolInvocationCounter.add(1, {
        tool_name: data.toolName,
        toolset_key: data.toolsetKey,
        status: 'error',
      });
    },

    /**
     * Record tool execution duration
     * @param toolName - Tool name
     * @param toolsetKey - Toolset key
     * @param durationMs - Duration in milliseconds
     */
    duration: (toolName: string, toolsetKey: string, durationMs: number): void => {
      this.toolDurationHistogram.record(durationMs, {
        tool_name: toolName,
        toolset_key: toolsetKey,
      });
    },
  };
}

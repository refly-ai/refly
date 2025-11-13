import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sandbox } from '@scalebox/sdk';
import fs from 'node:fs';
import { User, SandboxExecuteRequest, SandboxExecuteResponse } from '@refly/openapi-schema';
import { Queue, QueueEvents } from 'bullmq';

import { buildResponse } from '../../../utils';
import { MEDIA_TYPES } from '../common/constant/media-types';
import { ToolExecutionSync } from '../common/decorators/tool-execution-sync.decorator';
import {
  type ToolExecutionResult,
  ToolExecutionSyncInterceptor,
} from '../common/interceptors/tool-execution-sync.interceptor';
import {
  SCALEBOX_EXECUTION_QUEUE,
  SCALEBOX_DEFAULT_TIMEOUT,
  SCALEBOX_DEFAULT_MAX_QUEUE_SIZE,
} from './scalebox.constants';
import { ScaleboxExecutionJobData, ScaleboxExecutionResult } from './scalebox.dto';

/**
 * Scalebox Service
 * Execute code in a secure sandbox environment using Scalebox provider
 */
@Injectable()
export class ScaleboxService implements OnModuleDestroy {
  private readonly logger = new Logger(ScaleboxService.name);
  private queueEvents?: QueueEvents;

  constructor(
    private readonly config: ConfigService,
    private readonly toolExecutionSync: ToolExecutionSyncInterceptor,
    @Optional()
    @InjectQueue(SCALEBOX_EXECUTION_QUEUE)
    private readonly executionQueue?: Queue<ScaleboxExecutionJobData, ScaleboxExecutionResult>,
  ) {
    // Create QueueEvents for job result listening if queue is available
    if (this.executionQueue) {
      this.queueEvents = new QueueEvents(SCALEBOX_EXECUTION_QUEUE, {
        connection: this.executionQueue.opts.connection,
      });
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    if (this.queueEvents) {
      await this.queueEvents.close();
    }
  }

  /**
   * Core sandbox code execution logic (static method for reuse)
   * This method contains the actual Scalebox SDK integration logic
   */
  static async executeCode(params: {
    code: string;
    language?: string;
    apiKey: string;
    canvasId?: string;
  }): Promise<ScaleboxExecutionResult> {
    const logger = new Logger(ScaleboxService.name);
    const startTime = Date.now();

    try {
      logger.log(
        `Creating sandbox, language: ${params.language || 'python'}, canvasId: ${params.canvasId || 'N/A'}`,
      );
      const sandbox = await Sandbox.create('code-interpreter', {
        apiKey: params.apiKey,
      });

      const cwd = params.canvasId ? `/tmp/canvas/${params.canvasId}` : undefined;

      if (cwd) {
        logger.log(`Creating working directory: ${cwd}`);
        await sandbox.files.makeDir(cwd);
      }

      logger.log('Executing code in sandbox');
      const result = await sandbox.runCode(params.code, {
        language: (params.language || 'python') as any,
        cwd,
      });

      const filename = `output-${Date.now()}.png`;

      result.png &&
        fs.writeFileSync(`/Users/zqxy123/Downloads/static/${filename}`, result.png, 'base64');

      logger.log('Code execution completed, killing sandbox');
      await sandbox.kill();

      const executionTime = Date.now() - startTime;
      logger.log(`Sandbox execution finished, total time: ${executionTime}ms`);

      return {
        output: `<img src="http://localhost:3000/${filename}" />`,
        error: '',
        exitCode: 0,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`Sandbox execution failed: ${(error as Error).message}`, (error as Error).stack);

      return {
        output: '',
        error: (error as Error).message || 'Unknown error occurred',
        exitCode: 1,
        executionTime,
      };
    }
  }

  /**
   * Public API method that returns SandboxExecuteResponse for backward compatibility
   */
  async execute(user: User, request: SandboxExecuteRequest): Promise<SandboxExecuteResponse> {
    // Call the decorated method which returns ToolExecutionResult
    const result = await this.executeInternal(user, request);

    // Convert ToolExecutionResult to SandboxExecuteResponse
    if (result.status === 'success') {
      return buildResponse<SandboxExecuteResponse>(true, {
        data: {
          output: result.data?.output || '',
          error: result.data?.error || '',
          exitCode: result.data?.exitCode || 0,
          executionTime: result.data?.executionTime || 0,
        },
      });
    } else {
      return buildResponse<SandboxExecuteResponse>(false, null, result.errors?.[0]);
    }
  }

  /**
   * Internal execute implementation with @ToolExecutionSync decorator
   * Uses @ToolExecutionSync decorator to handle all boilerplate logic:
   * - ActionResult creation and status management
   * - Workflow node execution tracking
   * - Canvas node creation and connection
   * - Parent-child relationship handling
   */
  @ToolExecutionSync({
    resultType: MEDIA_TYPES.DOC,
    getParentResultId: (req) => req.parentResultId,
    getTitle: (req) => `sandbox-execute-${req.language || 'python'}`,
    getModel: (req) => req.model,
    getProviderItemId: (req) => req.providerItemId,
    createCanvasNode: true,
    updateWorkflowNode: true,
    getMetadata: (_req, result) => ({
      output: result.data?.output,
      exitCode: result.data?.exitCode,
      executionTime: result.data?.executionTime,
    }),
  })
  private async executeInternal(
    user: User,
    request: SandboxExecuteRequest,
  ): Promise<ToolExecutionResult> {
    this.logger.log(
      `Executing sandbox code for user ${user.uid}, canvasId: ${request.canvasId || 'N/A'}, language: ${request.language || 'python'}`,
    );

    // Get API key from config
    const apiKey = this.config.get<string>('sandbox.scalebox.apiKey');

    if (!apiKey) {
      return {
        status: 'error',
        errors: [
          {
            code: 'SCALEBOX_NOT_CONFIGURED',
            message: 'Scalebox API key is not configured. Please contact administrator.',
          },
        ],
      };
    }

    // If queue is not available (desktop mode), return error
    if (!this.executionQueue) {
      this.logger.error('Execution queue not available');
      return {
        status: 'error',
        errors: [
          {
            code: 'QUEUE_NOT_AVAILABLE',
            message: 'Sandbox execution queue is not available. Please check Redis connection.',
          },
        ],
      };
    }

    try {
      // Check queue size before adding new job
      const waitingCount = await this.executionQueue.getWaitingCount();
      const maxQueueSizeConfig = this.config.get<string>('sandbox.scalebox.maxQueueSize');
      const maxQueueSize =
        Number.parseInt(maxQueueSizeConfig, 10) || SCALEBOX_DEFAULT_MAX_QUEUE_SIZE;

      if (waitingCount >= maxQueueSize) {
        this.logger.warn(
          `Queue overloaded: ${waitingCount} tasks waiting, max: ${maxQueueSize}. Rejecting new request from user ${user.uid}`,
        );
        return {
          status: 'error',
          errors: [
            {
              code: 'QUEUE_OVERLOADED',
              message: `System is busy (${waitingCount} tasks in queue). Please try again later.`,
            },
          ],
        };
      }

      // Add job to queue with aggressive cleanup options
      const job = await this.executionQueue.add(
        'execute',
        {
          uid: user.uid,
          code: request.code,
          language: request.language,
          timeout: request.timeout,
          canvasId: request.canvasId,
          apiKey,
        },
        {
          removeOnComplete: true, // Remove job immediately after completion
          removeOnFail: true, // Remove job immediately after failure
        },
      );

      this.logger.log(`Sandbox job queued: ${job.id}, current queue size: ${waitingCount + 1}`);

      // Wait for job to complete and return result
      const timeoutConfig = this.config.get<string>('sandbox.scalebox.timeout');
      const waitTimeout = Number.parseInt(timeoutConfig, 10) || SCALEBOX_DEFAULT_TIMEOUT;
      const result = await job.waitUntilFinished(this.queueEvents, waitTimeout);

      this.logger.log(`Sandbox execution completed: ${job.id}`);

      // Convert ScaleboxExecutionResult to ToolExecutionResult
      if (result.exitCode === 0) {
        return {
          status: 'success',
          data: result,
        };
      } else {
        return {
          status: 'error',
          data: result,
          errors: [
            {
              code: 'SANDBOX_EXECUTION_FAILED',
              message: result.error || 'Failed to execute code',
            },
          ],
        };
      }
    } catch (error) {
      this.logger.error(
        `Queue execution failed: ${(error as Error).message}`,
        (error as Error).stack,
      );

      // Return error instead of fallback
      return {
        status: 'error',
        errors: [
          {
            code: 'QUEUE_EXECUTION_FAILED',
            message: (error as Error).message || 'Failed to execute code in queue',
          },
        ],
      };
    }
  }
}

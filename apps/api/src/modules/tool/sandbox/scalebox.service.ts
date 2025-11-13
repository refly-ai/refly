import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sandbox } from '@scalebox/sdk';
import { User, SandboxExecuteRequest, SandboxExecuteResponse } from '@refly/openapi-schema';

import { buildResponse } from '../../../utils';
import { MEDIA_TYPES } from '../common/constant/media-types';
import { ToolExecutionSync } from '../common/decorators/tool-execution-sync.decorator';
import {
  type ToolExecutionResult,
  ToolExecutionSyncInterceptor,
} from '../common/interceptors/tool-execution-sync.interceptor';

/**
 * Scalebox Service
 * Execute code in a secure sandbox environment using Scalebox provider
 */
@Injectable()
export class ScaleboxService {
  private readonly logger = new Logger(ScaleboxService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly toolExecutionSync: ToolExecutionSyncInterceptor,
  ) {}

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
    const startTime = Date.now();

    try {
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

      this.logger.log(
        `Executing sandbox code for user ${user.uid}, canvasId: ${request.canvasId || 'N/A'}, language: ${request.language || 'python'}`,
      );

      // Create sandbox with API key
      const sandbox = await Sandbox.create('code-interpreter', {
        apiKey,
      });

      // Execute code - runCode expects two separate parameters
      const result = await sandbox.runCode(request.code, {
        language: (request.language || 'python') as any,
      });

      // Kill sandbox
      await sandbox.kill();

      const executionTime = Date.now() - startTime;

      this.logger.log(
        `Sandbox execution completed for user ${user.uid}, execution time: ${executionTime}ms`,
      );

      return {
        status: 'success',
        data: {
          output: result.text || '',
          error: '',
          exitCode: 0,
          executionTime,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error(
        `Failed to execute sandbox code: ${(error as Error).message} for user ${user.uid}`,
        (error as Error).stack,
      );

      return {
        status: 'error',
        data: {
          output: '',
          error: (error as Error).message || 'Unknown error occurred',
          exitCode: 1,
          executionTime,
        },
        errors: [
          {
            code: 'SANDBOX_EXECUTION_FAILED',
            message: (error as Error).message || 'Failed to execute code',
          },
        ],
      };
    }
  }
}

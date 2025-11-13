import { Injectable, Logger } from '@nestjs/common';
import { User, BaseResponseV2 } from '@refly/openapi-schema';
import { buildResponse } from '../../../utils';
import { PrismaService } from '../../common/prisma.service';
import { MEDIA_TYPES } from '../common/constant/media-types';
import { ToolExecutionSync } from '../common/decorators/tool-execution-sync.decorator';
import {
  type ToolExecutionResult,
  ToolExecutionSyncInterceptor,
} from '../common/interceptors/tool-execution-sync.interceptor';

// Temporary type definitions (should be moved to openapi-schema later)
export interface SandboxExecuteRequest {
  code: string;
  language?: string;
  timeout?: number;
  parentResultId?: string;
  targetId?: string;
  targetType?: string;
  model?: string;
  providerItemId?: string;
}

export interface SandboxExecuteResponse extends BaseResponseV2 {
  data?: {
    output?: string;
    error?: string;
    exitCode?: number;
    executionTime?: number;
  };
}

/**
 * Sandbox Service
 * Execute code in a secure sandbox environment
 */
@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);

  constructor(
    private readonly prismaService: PrismaService,
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
    try {
      this.logger.log(
        `Executing sandbox code for user ${user.uid}, language: ${request.language || 'python'}`,
      );

      // TODO: Implement actual sandbox execution logic
      // For now, return a fixed message
      const output =
        'This tool is still in experimental, please tell user to wait for it patiently, it will be available soon.';

      return {
        status: 'success',
        data: {
          output,
          error: '',
          exitCode: 0,
          executionTime: 0,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to execute sandbox code: ${(error as Error).message} for user ${user.uid}`,
        (error as Error).stack,
      );

      return {
        status: 'error',
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

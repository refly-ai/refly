import { SandboxExecuteResponse, DriveFile } from '@refly/openapi-schema';
import { WorkerExecuteResponse } from './sandbox.schema';

/**
 * Factory for building SandboxExecuteResponse objects
 */
export const SandboxResponseFactory = {
  /**
   * Build success response from worker response
   */
  success(
    response: WorkerExecuteResponse,
    files: DriveFile[],
    executionTime: number,
  ): SandboxExecuteResponse {
    return {
      status: 'success',
      data: {
        output: response.data?.output || '',
        error: response.data?.error || '',
        exitCode: response.data?.exitCode ?? 0,
        executionTime,
        files,
        warnings:
          response.data?.warnings && response.data.warnings.length > 0
            ? response.data.warnings
            : undefined,
      },
    };
  },

  /**
   * Build failed response from worker errors
   */
  failed(response: WorkerExecuteResponse): SandboxExecuteResponse {
    return {
      status: 'failed',
      errors: response.errors || [
        {
          code: 'WORKER_EXECUTION_FAILED',
          message: 'Worker execution failed',
        },
      ],
    };
  },

  /**
   * Build error response from exception
   */
  error(error: Error, code = 'SANDBOX_EXECUTION_FAILED'): SandboxExecuteResponse {
    return {
      status: 'failed',
      errors: [
        {
          code,
          message: error.message || 'Unknown error',
        },
      ],
    };
  },
} as const;

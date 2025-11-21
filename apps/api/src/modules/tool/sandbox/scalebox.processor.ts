import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ScaleboxExecutionJobData, ScaleboxExecutionResult } from './scalebox.dto';
import { ScaleboxService } from './scalebox.service';
import { formatError, performance } from './scalebox.utils';

/**
 * Scalebox Execution Processor
 * Placeholder for future queue-based execution (currently unused)
 */
@Injectable()
export class ScaleboxExecutionProcessor {
  constructor(
    private readonly scaleboxService: ScaleboxService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ScaleboxExecutionProcessor.name);
  }

  async execute(data: ScaleboxExecutionJobData): Promise<ScaleboxExecutionResult> {
    const { uid, code, language, canvasId, apiKey, s3DrivePath, version } = data;

    this.logger.info(
      {
        uid,
        canvasId,
        language,
      },
      'Processing execution',
    );

    const result = await performance(() =>
      this.scaleboxService.executeCode(
        {
          code,
          language,
        },
        {
          uid,
          apiKey,
          canvasId,
          s3DrivePath,
          version,
        },
      ),
    );

    const { success, error, data: resultData, executionTime } = result;

    if (!success) {
      const { message } = formatError(error);

      this.logger.error(
        {
          error: message,
          stack: (error as Error).stack,
        },
        'Execution failed',
      );

      return {
        error: message,
        exitCode: 1,
        executionTime,
        files: [],
        originResult: undefined,
      };
    }

    this.logger.info(
      {
        executionTime: resultData!.executionTime,
        exitCode: resultData!.exitCode,
      },
      'Execution completed',
    );

    return resultData!;
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { PinoLogger } from 'nestjs-pino';
import { Job } from 'bullmq';
import { SCALEBOX_EXECUTION_QUEUE, SCALEBOX_DEFAULT_CONCURRENCY } from './scalebox.constants';
import { ScaleboxExecutionJobData, ScaleboxExecutionResult } from './scalebox.dto';
import { ScaleboxService } from './scalebox.service';
import { formatError, performance } from './scalebox.utils';

/**
 * Scalebox Execution Processor
 * Consumes sandbox execution jobs from the internal queue
 */
@Processor(SCALEBOX_EXECUTION_QUEUE, {
  concurrency: SCALEBOX_DEFAULT_CONCURRENCY,
})
export class ScaleboxExecutionProcessor extends WorkerHost {
  constructor(
    private readonly scaleboxService: ScaleboxService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(ScaleboxExecutionProcessor.name);
  }

  async process(job: Job<ScaleboxExecutionJobData>): Promise<ScaleboxExecutionResult> {
    const { uid, code, language, canvasId, apiKey } = job.data;

    this.logger.info(
      {
        jobId: job.id,
        uid,
        canvasId,
        language,
      },
      'Processing job',
    );

    const result = await performance(() =>
      this.scaleboxService.executeCode({
        code,
        language,
        apiKey,
        canvasId,
      }),
    );

    const { success, error, data, executionTime } = result;

    if (!success) {
      const { message } = formatError(error);

      this.logger.error(
        {
          jobId: job.id,
          error: message,
          stack: (error as Error).stack,
        },
        'Job failed',
      );

      return {
        error: message,
        exitCode: 1,
        executionTime,
      };
    }

    this.logger.info(
      {
        jobId: job.id,
        executionTime: data!.executionTime,
        exitCode: data!.exitCode,
      },
      'Job completed',
    );

    return data!;
  }
}

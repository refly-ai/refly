import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SCALEBOX_EXECUTION_QUEUE, SCALEBOX_DEFAULT_CONCURRENCY } from './scalebox.constants';
import { ScaleboxExecutionJobData, ScaleboxExecutionResult } from './scalebox.dto';
import { ScaleboxService } from './scalebox.service';

/**
 * Scalebox Execution Processor
 * Consumes sandbox execution jobs from the internal queue
 */
@Processor(SCALEBOX_EXECUTION_QUEUE, {
  concurrency: SCALEBOX_DEFAULT_CONCURRENCY,
})
export class ScaleboxExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(ScaleboxExecutionProcessor.name);

  async process(job: Job<ScaleboxExecutionJobData>): Promise<ScaleboxExecutionResult> {
    const startTime = Date.now();
    const { uid, code, language, canvasId, apiKey } = job.data;

    this.logger.log(
      `[${SCALEBOX_EXECUTION_QUEUE}] Processing job ${job.id}, uid: ${uid}, canvasId: ${canvasId || 'N/A'}, language: ${language || 'python'}`,
    );

    try {
      // Use the static method for core execution logic
      const result = await ScaleboxService.executeCode({
        code,
        language,
        apiKey,
      });

      this.logger.log(
        `[${SCALEBOX_EXECUTION_QUEUE}] Job completed: ${job.id}, executionTime: ${result.executionTime}ms, exitCode: ${result.exitCode}`,
      );

      // Return result (BullMQ will automatically handle this)
      return result;
    } catch (error) {
      // Catch any unexpected errors and return as execution result
      // This ensures Only-Once semantics - the job will not be retried
      const executionTime = Date.now() - startTime;

      this.logger.error(
        `[${SCALEBOX_EXECUTION_QUEUE}] Job failed with unexpected error: ${job.id}, error: ${(error as Error).message}`,
        (error as Error).stack,
      );

      // Return error as result instead of throwing
      // This prevents the job from being retried and ensures the caller receives the error
      return {
        output: '',
        error: (error as Error).message || 'Unexpected error occurred during code execution',
        exitCode: 1,
        executionTime,
      };
    }
  }
}

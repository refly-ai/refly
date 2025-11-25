import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { QUEUE_SANDBOX } from '../../../utils/const';
import { Config } from '../../config/config.decorator';
import { ScaleboxService } from './scalebox.service';
import { SandboxExecuteJobData, ScaleboxExecutionResult } from './scalebox.dto';
import { SCALEBOX_DEFAULT_CONFIG } from './scalebox.constants';

/**
 * Sandbox Execution Processor
 *
 * Responsibilities:
 * - Task queue management
 * - Concurrency control via BullMQ (limited by maxSize)
 * - Job parameter persistence
 *
 * Delegates actual execution to ScaleboxService.executeCode()
 */
@Injectable()
@Processor(QUEUE_SANDBOX, {
  concurrency: 1, // Will be overridden by getWorkerOptions
})
export class SandboxProcessor extends WorkerHost {
  constructor(
    private readonly scaleboxService: ScaleboxService,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(SandboxProcessor.name);
    void this.config; // Suppress unused warning - used by @Config decorators
  }

  @Config.integer(
    'sandbox.scalebox.pool.localConcurrentMaxSize',
    SCALEBOX_DEFAULT_CONFIG.pool.localConcurrentMaxSize,
  )
  private localConcurrentMaxSize: number;

  getWorkerOptions() {
    return {
      concurrency: this.localConcurrentMaxSize,
    };
  }

  /**
   * Process sandbox execution job
   * Note: Queue size limiting is handled at submission time in service layer
   * BullMQ concurrency controls max parallel workers
   */
  async process(job: Job<SandboxExecuteJobData>): Promise<ScaleboxExecutionResult> {
    const { params, context } = job.data;

    this.logger.info(
      {
        jobId: job.id,
        canvasId: context.canvasId,
        uid: context.uid,
      },
      'Processing sandbox execution job',
    );

    const result = await this.scaleboxService.executeCode(params, context);

    this.logger.info(
      {
        jobId: job.id,
        canvasId: context.canvasId,
        exitCode: result.exitCode,
      },
      'Sandbox execution job completed',
    );

    return result;
  }
}

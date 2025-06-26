import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { PilotService } from './pilot.service';
import { QUEUE_RUN_PILOT, QUEUE_SYNC_PILOT_STEP } from '../../utils/const';
import { User } from '@refly/openapi-schema';

// Interface for RunPilotJobData
export interface RunPilotJobData {
  user: User;
  sessionId: string;
}

// Interface for SyncPilotStepJobData
export interface SyncPilotStepJobData {
  user: User;
  stepId: string;
}

@Processor(QUEUE_RUN_PILOT)
export class RunPilotProcessor extends WorkerHost {
  private readonly logger = new Logger(RunPilotProcessor.name);

  constructor(private pilotService: PilotService) {
    super();
  }

  async process(job: Job<RunPilotJobData>) {
    this.logger.log(
      `[${QUEUE_RUN_PILOT}] Processing job: ${job.id} for session: ${job.data.sessionId}`,
    );

    try {
      await this.pilotService.runPilot(job.data.user, job.data.sessionId);
      this.logger.log(
        `[${QUEUE_RUN_PILOT}] Completed job: ${job.id} for session: ${job.data.sessionId}`,
      );
    } catch (error) {
      this.logger.error(`[${QUEUE_RUN_PILOT}] Error processing job ${job.id}: ${error?.stack}`);
      throw error;
    }
  }
}

@Processor(QUEUE_SYNC_PILOT_STEP)
export class SyncPilotStepProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncPilotStepProcessor.name);

  constructor(private pilotService: PilotService) {
    super();
  }

  async process(job: Job<SyncPilotStepJobData>) {
    this.logger.log(
      `[${QUEUE_SYNC_PILOT_STEP}] Processing job: ${job.id} for step: ${job.data.stepId}`,
    );

    try {
      await this.pilotService.syncPilotStep(job.data.user, job.data.stepId);
      this.logger.log(
        `[${QUEUE_SYNC_PILOT_STEP}] Completed job: ${job.id} for step: ${job.data.stepId}`,
      );
    } catch (error) {
      this.logger.error(
        `[${QUEUE_SYNC_PILOT_STEP}] Error processing job ${job.id}: ${error?.stack}`,
      );
      throw error;
    }
  }
}

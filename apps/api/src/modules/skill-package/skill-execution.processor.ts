/**
 * Skill Execution BullMQ Processor - processes skill and workflow execution jobs.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  SkillPackageExecutorService,
  SkillExecutionJob,
  SkillWorkflowJob,
} from './skill-package-executor.service';
import { QUEUE_SKILL_EXECUTION, QUEUE_SKILL_WORKFLOW } from '../../utils/const';

@Processor(QUEUE_SKILL_EXECUTION)
export class SkillExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(SkillExecutionProcessor.name);

  constructor(private readonly executorService: SkillPackageExecutorService) {
    super();
  }

  async process(job: Job<SkillExecutionJob>): Promise<void> {
    this.logger.log(`Processing skill execution job: ${job.data.executionId}`);

    try {
      await this.executorService.processExecution(job.data);
      this.logger.log(`Completed skill execution job: ${job.data.executionId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Skill execution job failed: ${job.data.executionId} - ${errorMessage}`);
      throw error;
    }
  }
}

@Processor(QUEUE_SKILL_WORKFLOW)
export class SkillWorkflowProcessor extends WorkerHost {
  private readonly logger = new Logger(SkillWorkflowProcessor.name);

  constructor(private readonly executorService: SkillPackageExecutorService) {
    super();
  }

  async process(job: Job<SkillWorkflowJob>): Promise<void> {
    this.logger.log(`Processing skill workflow job: ${job.data.executionWorkflowId}`);

    try {
      await this.executorService.processWorkflow(job.data);
      this.logger.log(`Completed skill workflow job: ${job.data.executionWorkflowId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Skill workflow job failed: ${job.data.executionWorkflowId} - ${errorMessage}`,
      );
      throw error;
    }
  }
}

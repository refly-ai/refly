import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WorkflowService } from './workflow.service';
import { SyncWorkflowJobData, RunWorkflowJobData } from './workflow.dto';
import { QUEUE_SYNC_WORKFLOW, QUEUE_RUN_WORKFLOW } from '../../utils/const';

@Processor(QUEUE_SYNC_WORKFLOW)
export class SyncWorkflowProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncWorkflowProcessor.name);

  constructor(private workflowService: WorkflowService) {
    super();
  }

  async process(job: Job<SyncWorkflowJobData>) {
    this.logger.log(
      `[${QUEUE_SYNC_WORKFLOW}] Processing job: ${job.id} for nodeExecutionId: ${job.data.nodeExecutionId}`,
    );

    try {
      await this.workflowService.syncWorkflow(job.data.user, job.data.nodeExecutionId);
      this.logger.log(
        `[${QUEUE_SYNC_WORKFLOW}] Completed job: ${job.id} for nodeExecutionId: ${job.data.nodeExecutionId}`,
      );
    } catch (error) {
      this.logger.error(`[${QUEUE_SYNC_WORKFLOW}] Error processing job ${job.id}: ${error?.stack}`);
      throw error;
    }
  }
}

@Processor(QUEUE_RUN_WORKFLOW)
export class RunWorkflowProcessor extends WorkerHost {
  private readonly logger = new Logger(RunWorkflowProcessor.name);

  constructor(private workflowService: WorkflowService) {
    super();
  }

  async process(job: Job<RunWorkflowJobData>) {
    this.logger.log(
      `[${QUEUE_RUN_WORKFLOW}] Processing job: ${job.id} for executionId: ${job.data.executionId}, nodeId: ${job.data.nodeId}`,
    );

    try {
      await this.workflowService.runWorkflow(job.data.user, job.data.executionId, job.data.nodeId);
      this.logger.log(
        `[${QUEUE_RUN_WORKFLOW}] Completed job: ${job.id} for executionId: ${job.data.executionId}, nodeId: ${job.data.nodeId}`,
      );
    } catch (error) {
      this.logger.error(`[${QUEUE_RUN_WORKFLOW}] Error processing job ${job.id}: ${error?.stack}`);
      throw error;
    }
  }
}

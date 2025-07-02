import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { CanvasService } from './canvas.service';
import {
  QUEUE_CLEAR_CANVAS_ENTITY,
  QUEUE_SYNC_CANVAS_ENTITY,
  QUEUE_AUTO_NAME_CANVAS,
  QUEUE_POST_DELETE_CANVAS,
  QUEUE_VERIFY_NODE_ADDITION,
} from '../../utils/const';
import {
  DeleteCanvasNodesJobData,
  SyncCanvasEntityJobData,
  AutoNameCanvasJobData,
  DeleteCanvasJobData,
  VerifyNodeAdditionJobData,
} from './canvas.dto';

@Processor(QUEUE_SYNC_CANVAS_ENTITY)
export class SyncCanvasEntityProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncCanvasEntityProcessor.name);

  constructor(private canvasService: CanvasService) {
    super();
  }

  async process(job: Job<SyncCanvasEntityJobData>) {
    this.logger.log(`[${QUEUE_SYNC_CANVAS_ENTITY}] job: ${JSON.stringify(job.data)}`);

    try {
      await this.canvasService.syncCanvasEntityRelation(job.data.canvasId);
    } catch (error) {
      this.logger.error(`[${QUEUE_SYNC_CANVAS_ENTITY}] error: ${error?.stack}`);
      throw error;
    }
  }
}

@Processor(QUEUE_CLEAR_CANVAS_ENTITY)
export class ClearCanvasEntityProcessor extends WorkerHost {
  private logger = new Logger(ClearCanvasEntityProcessor.name);

  constructor(private canvasService: CanvasService) {
    super();
  }

  async process(job: Job<DeleteCanvasNodesJobData>) {
    // this.logger.log(`[${QUEUE_CLEAR_CANVAS_ENTITY}] job: ${JSON.stringify(job.data)}`);
    const { entities } = job.data;

    try {
      await this.canvasService.deleteEntityNodesFromCanvases(entities);
    } catch (error) {
      this.logger.error(`[${QUEUE_CLEAR_CANVAS_ENTITY}] error ${job.id}: ${error?.stack}`);
      throw error;
    }
  }
}

@Processor(QUEUE_AUTO_NAME_CANVAS)
export class AutoNameCanvasProcessor extends WorkerHost {
  private logger = new Logger(AutoNameCanvasProcessor.name);

  constructor(private canvasService: CanvasService) {
    super();
  }

  async process(job: Job<AutoNameCanvasJobData>) {
    this.logger.log(`Processing auto name canvas job ${job.id} for canvas ${job.data.canvasId}`);
    await this.canvasService.autoNameCanvasFromQueue(job.data);
  }
}

@Processor(QUEUE_POST_DELETE_CANVAS)
export class PostDeleteCanvasProcessor extends WorkerHost {
  private logger = new Logger(PostDeleteCanvasProcessor.name);

  constructor(private canvasService: CanvasService) {
    super();
  }

  async process(job: Job<DeleteCanvasJobData>) {
    this.logger.log(`Processing canvas deletion job ${job.id} for canvas ${job.data.canvasId}`);

    try {
      await this.canvasService.postDeleteCanvas(job.data);
    } catch (error) {
      this.logger.error(`[${QUEUE_POST_DELETE_CANVAS}] error ${job.id}: ${error?.stack}`);
      throw error;
    }
  }
}

@Processor(QUEUE_VERIFY_NODE_ADDITION)
export class VerifyNodeAdditionProcessor extends WorkerHost {
  private logger = new Logger(VerifyNodeAdditionProcessor.name);

  constructor(private canvasService: CanvasService) {
    super();
  }

  async process(job: Job<VerifyNodeAdditionJobData>) {
    this.logger.log(
      `Processing node verification job ${job.id} for canvas ${job.data.canvasId}, attempt ${job.data.attempt}`,
    );

    try {
      await this.canvasService.verifyNodeAdditionFromQueue(job.data);
    } catch (error) {
      this.logger.error(`[${QUEUE_VERIFY_NODE_ADDITION}] error ${job.id}: ${error?.stack}`);
      throw error;
    }
  }
}

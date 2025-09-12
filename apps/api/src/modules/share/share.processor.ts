import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ShareCreationService } from './share-creation.service';
import { QUEUE_CREATE_SHARE } from '../../utils/const';
import type { CreateShareJobData } from './share.dto';

@Processor(QUEUE_CREATE_SHARE)
export class CreateShareProcessor extends WorkerHost {
  private readonly logger = new Logger(CreateShareProcessor.name);

  constructor(private readonly shareCreationService: ShareCreationService) {
    super();
  }

  async process(job: Job<CreateShareJobData>) {
    this.logger.log(`[${QUEUE_CREATE_SHARE}] Processing job: ${job.id}`);
    try {
      await this.shareCreationService.processCreateShareJob(job.data);
      this.logger.log(`[${QUEUE_CREATE_SHARE}] Completed job: ${job.id}`);
    } catch (error) {
      this.logger.error(`[${QUEUE_CREATE_SHARE}] Error processing job ${job.id}: ${error?.stack}`);
      throw error;
    }
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { KnowledgeService } from './knowledge.service';
import { QUEUE_RESOURCE } from '../utils/const';
import { FinalizeResourceParam } from './knowledge.dto';

@Processor(QUEUE_RESOURCE)
export class ResourceProcessor extends WorkerHost {
  private readonly logger = new Logger(ResourceProcessor.name);

  constructor(private knowledgeService: KnowledgeService) {
    super();
  }

  async process(job: Job<FinalizeResourceParam>) {
    this.logger.log(`[${QUEUE_RESOURCE}] job: ${JSON.stringify(job)}`);

    try {
      await this.knowledgeService.finalizeResource(job.data);
    } catch (error) {
      this.logger.error(`[${QUEUE_RESOURCE}] error: ${error?.stack}`);
      throw error;
    }
  }
}

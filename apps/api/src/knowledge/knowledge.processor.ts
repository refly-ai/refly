import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { KnowledgeService } from './knowledge.service';
import { QUEUE_RESOURCE, CHANNEL_FINALIZE_RESOURCE, QUEUE_PARSE_REF_URL } from '../utils/const';
import { FinalizeResourceParam, ParseReferenceExternalUrlParam } from './knowledge.dto';

@Processor(QUEUE_RESOURCE)
export class ResourceProcessor {
  private readonly logger = new Logger(ResourceProcessor.name);

  constructor(private knowledgeService: KnowledgeService) {}

  @Process(CHANNEL_FINALIZE_RESOURCE)
  async handleFinalizeResource(job: Job<FinalizeResourceParam>) {
    this.logger.log(`[handleFinalizeResource] job: ${JSON.stringify(job)}`);

    try {
      await this.knowledgeService.finalizeResource(job.data);
    } catch (error) {
      this.logger.error(`[handleFinalizeResource] error: ${error?.stack}`);
      throw error;
    }
  }
}

@Processor(QUEUE_PARSE_REF_URL)
export class ReferenceProcessor {
  private readonly logger = new Logger(ReferenceProcessor.name);

  constructor(private knowledgeService: KnowledgeService) {}

  @Process()
  async handleParseReferenceExternalUrl(job: Job<ParseReferenceExternalUrlParam>) {
    this.logger.log(`[handleParseReferenceExternalUrl] job: ${JSON.stringify(job)}`);

    try {
      await this.knowledgeService.parseReferenceExternalUrl(job.data);
    } catch (error) {
      this.logger.error(`[handleParseReferenceExternalUrl] error: ${error?.stack}`);
      throw error;
    }
  }
}

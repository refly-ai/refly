import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CreditService } from './credit.service';
import {
  SyncMediaCreditUsageJobData,
  SyncBatchTokenCreditUsageJobData,
  SyncToolCreditUsageJobData,
  SyncMultimodalCreditUsageJobData,
} from './credit.dto';
import {
  QUEUE_SYNC_TOKEN_CREDIT_USAGE,
  QUEUE_SYNC_MEDIA_CREDIT_USAGE,
  QUEUE_SYNC_TOOL_CREDIT_USAGE,
  QUEUE_SYNC_MULTIMODAL_CREDIT_USAGE,
} from '../../utils/const';

@Processor(QUEUE_SYNC_TOKEN_CREDIT_USAGE)
export class SyncTokenCreditUsageProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncTokenCreditUsageProcessor.name);

  constructor(private creditService: CreditService) {
    super();
  }

  async process(job: Job<SyncBatchTokenCreditUsageJobData>) {
    this.logger.log(`[${QUEUE_SYNC_TOKEN_CREDIT_USAGE}] job: ${JSON.stringify(job)}`);
    try {
      await this.creditService.syncBatchTokenCreditUsage(job.data);
    } catch (error) {
      this.logger.error(`[${QUEUE_SYNC_TOKEN_CREDIT_USAGE}] error: ${error?.stack}`);
      throw error;
    }
  }
}

@Processor(QUEUE_SYNC_MEDIA_CREDIT_USAGE)
export class SyncMediaCreditUsageProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncMediaCreditUsageProcessor.name);

  constructor(private creditService: CreditService) {
    super();
  }

  async process(job: Job<SyncMediaCreditUsageJobData>) {
    this.logger.log(`[${QUEUE_SYNC_MEDIA_CREDIT_USAGE}] job: ${JSON.stringify(job)}`);
    try {
      await this.creditService.syncMediaCreditUsage(job.data);
    } catch (error) {
      this.logger.error(`[${QUEUE_SYNC_MEDIA_CREDIT_USAGE}] error: ${error?.stack}`);
      throw error;
    }
  }
}

@Processor(QUEUE_SYNC_TOOL_CREDIT_USAGE)
export class SyncToolCreditUsageProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncToolCreditUsageProcessor.name);

  constructor(private creditService: CreditService) {
    super();
  }

  async process(job: Job<SyncToolCreditUsageJobData>) {
    this.logger.log(`[${QUEUE_SYNC_TOOL_CREDIT_USAGE}] job: ${JSON.stringify(job)}`);
    try {
      await this.creditService.syncToolCreditUsage(job.data);
    } catch (error) {
      this.logger.error(`[${QUEUE_SYNC_TOOL_CREDIT_USAGE}] error: ${error?.stack}`);
      throw error;
    }
  }
}

@Processor(QUEUE_SYNC_MULTIMODAL_CREDIT_USAGE)
export class SyncMultimodalCreditUsageProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncMultimodalCreditUsageProcessor.name);

  constructor(private creditService: CreditService) {
    super();
  }

  async process(job: Job<SyncMultimodalCreditUsageJobData>) {
    this.logger.log(`[${QUEUE_SYNC_MULTIMODAL_CREDIT_USAGE}] job: ${JSON.stringify(job)}`);
    try {
      await this.creditService.syncMultimodalCreditUsage(job.data);
    } catch (error) {
      this.logger.error(`[${QUEUE_SYNC_MULTIMODAL_CREDIT_USAGE}] error: ${error?.stack}`);
      throw error;
    }
  }
}

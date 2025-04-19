import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { SubscriptionService } from './subscription.service';
import {
  QUEUE_SYNC_TOKEN_USAGE,
  QUEUE_SYNC_STORAGE_USAGE,
  QUEUE_CHECK_CANCELED_SUBSCRIPTIONS,
  QUEUE_SYNC_REQUEST_USAGE,
} from '../../utils/const';
import {
  SyncTokenUsageJobData,
  SyncStorageUsageJobData,
  SyncRequestUsageJobData,
} from './subscription.dto';

@Processor(QUEUE_SYNC_TOKEN_USAGE)
export class SyncTokenUsageProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncTokenUsageProcessor.name);

  constructor(private subscriptionService: SubscriptionService) {
    super();
  }

  async process(job: Job<SyncTokenUsageJobData>) {
    this.logger.log(`[${QUEUE_SYNC_TOKEN_USAGE}] job: ${JSON.stringify(job)}`);
    try {
      await this.subscriptionService.syncTokenUsage(job.data);
    } catch (error) {
      this.logger.error(`[${QUEUE_SYNC_TOKEN_USAGE}] error: ${error?.stack}`);
      throw error;
    }
  }
}

@Processor(QUEUE_SYNC_STORAGE_USAGE)
export class SyncStorageUsageProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncStorageUsageProcessor.name);

  constructor(private subscriptionService: SubscriptionService) {
    super();
  }

  async process(job: Job<SyncStorageUsageJobData>) {
    this.logger.log(`[${QUEUE_SYNC_STORAGE_USAGE}] job: ${JSON.stringify(job)}`);
    try {
      await this.subscriptionService.syncStorageUsage(job.data);
    } catch (error) {
      this.logger.error(`[${QUEUE_SYNC_STORAGE_USAGE}] error: ${error?.stack}`);
      throw error;
    }
  }
}

@Processor(QUEUE_CHECK_CANCELED_SUBSCRIPTIONS)
export class CheckCanceledSubscriptionsProcessor extends WorkerHost {
  private readonly logger = new Logger(CheckCanceledSubscriptionsProcessor.name);

  constructor(private subscriptionService: SubscriptionService) {
    super();
  }

  async process() {
    this.logger.log(
      `[${QUEUE_CHECK_CANCELED_SUBSCRIPTIONS}] Starting check for canceled subscriptions`,
    );
    try {
      await this.subscriptionService.checkCanceledSubscriptions();
    } catch (error) {
      this.logger.error(`[${QUEUE_CHECK_CANCELED_SUBSCRIPTIONS}] error: ${error?.stack}`);
      throw error;
    }
  }
}

@Processor(QUEUE_SYNC_REQUEST_USAGE)
export class SyncRequestUsageProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncRequestUsageProcessor.name);

  constructor(private subscriptionService: SubscriptionService) {
    super();
  }

  async process(job: Job<SyncRequestUsageJobData>) {
    this.logger.log(`[${QUEUE_SYNC_REQUEST_USAGE}] job: ${JSON.stringify(job)}`);
    try {
      await this.subscriptionService.syncRequestUsage(job.data);
    } catch (error) {
      this.logger.error(`[${QUEUE_SYNC_REQUEST_USAGE}] error: ${error?.stack}`);
      throw error;
    }
  }
}

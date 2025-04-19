import { Module } from '@nestjs/common';
import { StripeModule } from '@golevelup/nestjs-stripe';
import { BullModule } from '@nestjs/bullmq';
import { SubscriptionService } from './subscription.service';
import {
  SyncTokenUsageProcessor,
  SyncStorageUsageProcessor,
  SyncRequestUsageProcessor,
  CheckCanceledSubscriptionsProcessor,
} from './subscription.processor';
import { SubscriptionController } from './subscription.controller';
import { CommonModule } from '../common/common.module';
import { QUEUE_CHECK_CANCELED_SUBSCRIPTIONS } from '../../utils/const';

@Module({
  imports: [
    CommonModule,
    StripeModule.externallyConfigured(StripeModule, 0),
    BullModule.registerQueue({
      name: QUEUE_CHECK_CANCELED_SUBSCRIPTIONS,
      prefix: 'subscription_cron',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  providers: [
    SubscriptionService,
    SyncTokenUsageProcessor,
    SyncStorageUsageProcessor,
    SyncRequestUsageProcessor,
    CheckCanceledSubscriptionsProcessor,
  ],
  controllers: [SubscriptionController],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}

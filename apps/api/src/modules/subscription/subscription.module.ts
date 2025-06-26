import { Module } from '@nestjs/common';
import { StripeModule } from '@golevelup/nestjs-stripe';
import { BullModule } from '@nestjs/bullmq';
import { SubscriptionService } from './subscription.service';
import { SubscriptionWebhooks } from './subscription.webhook';
import {
  SyncTokenUsageProcessor,
  SyncStorageUsageProcessor,
  SyncRequestUsageProcessor,
  CheckCanceledSubscriptionsProcessor,
} from './subscription.processor';
import { SubscriptionController } from './subscription.controller';
import { CommonModule } from '../common/common.module';
import { QUEUE_CHECK_CANCELED_SUBSCRIPTIONS } from '../../utils/const';
import { isDesktop } from '../../utils/runtime';

@Module({
  imports: [
    CommonModule,
    ...(isDesktop()
      ? []
      : [
          BullModule.registerQueue({
            name: QUEUE_CHECK_CANCELED_SUBSCRIPTIONS,
            prefix: 'subscription_cron',
            defaultJobOptions: {
              removeOnComplete: true,
              removeOnFail: false,
            },
          }),
          StripeModule.externallyConfigured(StripeModule, 0),
        ]),
  ],
  providers: [
    SubscriptionService,
    SyncTokenUsageProcessor,
    SyncStorageUsageProcessor,
    SyncRequestUsageProcessor,
    ...(isDesktop() ? [] : [CheckCanceledSubscriptionsProcessor, SubscriptionWebhooks]),
  ],
  controllers: [SubscriptionController],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}

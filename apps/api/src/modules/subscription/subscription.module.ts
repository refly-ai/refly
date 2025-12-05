import { Module, forwardRef } from '@nestjs/common';
import { StripeModule } from '@golevelup/nestjs-stripe';
import { BullModule } from '@nestjs/bullmq';
import { SubscriptionService } from './subscription.service';
import { SubscriptionWebhooks } from './subscription.webhook';
import {
  SyncTokenUsageProcessor,
  SyncStorageUsageProcessor,
  SyncRequestUsageProcessor,
  CheckCanceledSubscriptionsProcessor,
  ExpireAndRechargeCreditsProcessor,
} from './subscription.processor';
import { SubscriptionController } from './subscription.controller';
import { CommonModule } from '../common/common.module';
import { CreditModule } from '../credit/credit.module';
import { VoucherModule } from '../voucher/voucher.module';
import {
  QUEUE_CHECK_CANCELED_SUBSCRIPTIONS,
  QUEUE_EXPIRE_AND_RECHARGE_CREDITS,
} from '../../utils/const';
import { isDesktop } from '../../utils/runtime';

@Module({
  imports: [
    CommonModule,
    CreditModule,
    forwardRef(() => VoucherModule),
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
          BullModule.registerQueue({
            name: QUEUE_EXPIRE_AND_RECHARGE_CREDITS,
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
    ...(isDesktop()
      ? []
      : [
          CheckCanceledSubscriptionsProcessor,
          ExpireAndRechargeCreditsProcessor,
          SubscriptionWebhooks,
        ]),
  ],
  controllers: [SubscriptionController],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}

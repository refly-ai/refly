import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { MiscController } from './misc.controller';
import { MiscService } from './misc.service';
import { CommonModule } from '@/common/common.module';
import { SubscriptionModule } from '@/subscription/subscription.module';
import { QUEUE_SYNC_STORAGE_USAGE } from '@/utils';

@Module({
  imports: [
    CommonModule,
    ConfigModule,
    SubscriptionModule,
    BullModule.registerQueue({ name: QUEUE_SYNC_STORAGE_USAGE }),
  ],
  controllers: [MiscController],
  providers: [MiscService],
  exports: [MiscService],
})
export class MiscModule {}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MediaGeneratorController } from './media-generator.controller';
import { MediaGeneratorService } from './media-generator.service';
import { CommonModule } from '../common/common.module';
import { MiscModule } from '../misc/misc.module';
import { ProviderModule } from '../provider/provider.module';
import { CreditModule } from '../credit/credit.module';
import { QUEUE_SYNC_MEDIA_CREDIT_USAGE } from '../../utils/const';
import { isDesktop } from '../../utils/runtime';
import { SyncMediaCreditUsageProcessor } from '../credit/credit.processor';
import { CanvasSyncModule } from '../canvas-sync/canvas-sync.module';

@Module({
  imports: [
    CommonModule,
    MiscModule,
    ProviderModule,
    CanvasSyncModule,
    CreditModule,
    ...(isDesktop() ? [] : [BullModule.registerQueue({ name: QUEUE_SYNC_MEDIA_CREDIT_USAGE })]),
  ],
  controllers: [MediaGeneratorController],
  providers: [MediaGeneratorService, SyncMediaCreditUsageProcessor],
  exports: [MediaGeneratorService],
})
export class MediaGeneratorModule {}

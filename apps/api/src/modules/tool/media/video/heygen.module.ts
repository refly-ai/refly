import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_SYNC_TOOL_CREDIT_USAGE } from '../../../../utils/const';
import { isDesktop } from '../../../../utils/runtime';
import { CanvasSyncModule } from '../../../canvas-sync/canvas-sync.module';
import { CommonModule } from '../../../common/common.module';
import { MiscModule } from '../../../misc/misc.module';
import { ToolExecutionSyncInterceptor } from '../../common/interceptors/tool-execution-sync.interceptor';
import { HeyGenService } from './heygen.service';

/**
 * HeyGen Video Generation Module
 * Provides video generation capabilities using HeyGen API
 * @see https://docs.heygen.com/reference/create-an-avatar-video-v2
 */
@Module({
  imports: [
    CommonModule,
    MiscModule,
    CanvasSyncModule,
    ...(isDesktop() ? [] : [BullModule.registerQueue({ name: QUEUE_SYNC_TOOL_CREDIT_USAGE })]),
  ],
  providers: [HeyGenService, ToolExecutionSyncInterceptor],
  exports: [HeyGenService],
})
export class HeyGenModule {}

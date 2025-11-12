import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_SYNC_TOOL_CREDIT_USAGE } from '../../../../utils/const';
import { isDesktop } from '../../../../utils/runtime';
import { CanvasSyncModule } from '../../../canvas-sync/canvas-sync.module';
import { CommonModule } from '../../../common/common.module';
import { MiscModule } from '../../../misc/misc.module';
import { ToolExecutionSyncInterceptor } from '../../common/interceptors/tool-execution-sync.interceptor';
import { FishAudioService } from './fish-audio.service';

/**
 * Fish Audio Module
 * Provides audio processing capabilities using the official Fish Audio SDK
 * @see https://docs.fish.audio/sdk-reference/javascript
 */
@Module({
  imports: [
    CommonModule,
    MiscModule,
    CanvasSyncModule,
    ...(isDesktop() ? [] : [BullModule.registerQueue({ name: QUEUE_SYNC_TOOL_CREDIT_USAGE })]),
  ],
  providers: [FishAudioService, ToolExecutionSyncInterceptor],
  exports: [FishAudioService],
})
export class FishAudioModule {}

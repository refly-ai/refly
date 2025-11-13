import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommonModule } from '../../common/common.module';
import { CanvasSyncModule } from '../../canvas-sync/canvas-sync.module';
import { isDesktop } from '../../../utils/runtime';
import { ToolExecutionSyncInterceptor } from '../common/interceptors/tool-execution-sync.interceptor';
import { SCALEBOX_EXECUTION_QUEUE } from './scalebox.constants';
import { ScaleboxExecutionProcessor } from './scalebox.processor';
import { ScaleboxService } from './scalebox.service';

/**
 * Scalebox Module
 * Provides code execution capabilities using Scalebox sandbox provider
 */
@Module({
  imports: [
    CommonModule,
    CanvasSyncModule,
    // Only register queue in non-desktop mode
    ...(isDesktop()
      ? []
      : [
          BullModule.registerQueue({
            name: SCALEBOX_EXECUTION_QUEUE,
          }),
        ]),
  ],
  providers: [ScaleboxService, ScaleboxExecutionProcessor, ToolExecutionSyncInterceptor],
  exports: [ScaleboxService],
})
export class ScaleboxModule {}

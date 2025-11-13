import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CanvasSyncModule } from '../../canvas-sync/canvas-sync.module';
import { ToolExecutionSyncInterceptor } from '../common/interceptors/tool-execution-sync.interceptor';
import { ScaleboxService } from './scalebox.service';

/**
 * Scalebox Module
 * Provides code execution capabilities using Scalebox sandbox provider
 */
@Module({
  imports: [CommonModule, CanvasSyncModule],
  providers: [ScaleboxService, ToolExecutionSyncInterceptor],
  exports: [ScaleboxService],
})
export class ScaleboxModule {}

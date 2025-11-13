import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CanvasSyncModule } from '../../canvas-sync/canvas-sync.module';
import { ToolExecutionSyncInterceptor } from '../common/interceptors/tool-execution-sync.interceptor';
import { SandboxService } from './sandbox.service';

/**
 * Sandbox Module
 * Provides code execution capabilities in a secure sandbox environment
 */
@Module({
  imports: [CommonModule, CanvasSyncModule],
  providers: [SandboxService, ToolExecutionSyncInterceptor],
  exports: [SandboxService],
})
export class SandboxModule {}

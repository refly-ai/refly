import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../../common/common.module';
import { CanvasSyncModule } from '../../canvas-sync/canvas-sync.module';
import { DriveModule } from '../../drive/drive.module';
import { ScaleboxExecutionProcessor } from './scalebox.processor';
import { ScaleboxService } from './scalebox.service';
import { SandboxPool } from './scalebox.pool';
import { ScaleboxStorage } from './scalebox.storage';

/**
 * Scalebox Module
 * Provides code execution capabilities using Scalebox sandbox provider
 */
@Module({
  imports: [ConfigModule, CommonModule, CanvasSyncModule, DriveModule],
  providers: [ScaleboxService, ScaleboxExecutionProcessor, SandboxPool, ScaleboxStorage],
  exports: [ScaleboxService],
})
export class ScaleboxModule {}

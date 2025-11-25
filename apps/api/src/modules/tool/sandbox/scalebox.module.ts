import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { CommonModule } from '../../common/common.module';
import { CanvasSyncModule } from '../../canvas-sync/canvas-sync.module';
import { DriveModule } from '../../drive/drive.module';
import { QUEUE_SANDBOX } from '../../../utils/const';
import { ScaleboxService } from './scalebox.service';
import { SandboxPool } from './scalebox.pool';
import { ScaleboxStorage } from './scalebox.storage';
import { SandboxProcessor } from './scalebox.processor';

/**
 * Scalebox Module
 * Provides code execution capabilities using Scalebox sandbox provider
 */
@Module({
  imports: [
    ConfigModule,
    CommonModule,
    CanvasSyncModule,
    DriveModule,
    BullModule.registerQueue({
      name: QUEUE_SANDBOX,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
  ],
  providers: [ScaleboxService, SandboxPool, ScaleboxStorage, SandboxProcessor],
  exports: [ScaleboxService],
})
export class ScaleboxModule {}

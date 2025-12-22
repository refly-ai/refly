import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { CommonModule } from '../../common/common.module';
import { CanvasSyncModule } from '../../canvas-sync/canvas-sync.module';
import { DriveModule } from '../../drive/drive.module';
import {
  QUEUE_SCALEBOX_EXECUTE,
  QUEUE_SCALEBOX_PAUSE,
  QUEUE_SCALEBOX_KILL,
} from '../../../utils/const';
import { ScaleboxService } from './scalebox.service';
import { SandboxPool } from './scalebox.pool';
import { ScaleboxStorage } from './scalebox.storage';
import { ScaleboxLock } from './scalebox.lock';
import { SandboxWrapperFactory } from './scalebox.factory';
import {
  ScaleboxExecuteProcessor,
  ScaleboxPauseProcessor,
  ScaleboxKillProcessor,
} from './scalebox.processor';

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
    BullModule.registerQueue({ name: QUEUE_SCALEBOX_EXECUTE }),
    BullModule.registerQueue({ name: QUEUE_SCALEBOX_PAUSE }),
    BullModule.registerQueue({ name: QUEUE_SCALEBOX_KILL }),
  ],
  providers: [
    ScaleboxService,
    SandboxPool,
    ScaleboxStorage,
    ScaleboxLock,
    SandboxWrapperFactory,
    ScaleboxExecuteProcessor,
    ScaleboxPauseProcessor,
    ScaleboxKillProcessor,
  ],
  exports: [ScaleboxService],
})
export class ScaleboxModule {}

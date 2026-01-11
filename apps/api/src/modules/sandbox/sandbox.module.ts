import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DriveModule } from '../drive/drive.module';
import { SandboxService } from './sandbox.service';
import { SandboxClient } from './sandbox.client';
import { SANDBOX_QUEUES } from './sandbox.constants';

@Module({
  imports: [CommonModule, DriveModule, BullModule.registerQueue({ name: SANDBOX_QUEUES.REQUEST })],
  providers: [SandboxService, SandboxClient],
  exports: [SandboxService],
})
export class SandboxModule {}

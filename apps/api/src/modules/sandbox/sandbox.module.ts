import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DriveModule } from '../drive/drive.module';
import { SandboxService } from './sandbox.service';
import { SandboxClient } from './sandbox.client';

@Module({
  imports: [CommonModule, DriveModule],
  providers: [SandboxService, SandboxClient],
  exports: [SandboxService],
})
export class SandboxModule {}

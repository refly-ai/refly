import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { SandboxService } from './sandbox.service';
import { SandboxController } from './sandbox.controller';

@Module({
  imports: [CommonModule],
  providers: [SandboxService],
  controllers: [SandboxController],
  exports: [SandboxService],
})
export class SandboxModule {}

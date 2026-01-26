import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ToolCallService } from './tool-call.service';
import { ToolCallCliController } from './tool-call-cli.controller';

@Module({
  imports: [CommonModule],
  controllers: [ToolCallCliController],
  providers: [ToolCallService],
  exports: [ToolCallService],
})
export class ToolCallModule {}

import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ToolController } from './tool.controller';
import { ToolService } from './tool.service';
import { McpServerModule } from '../mcp-server/mcp-server.module';

@Module({
  imports: [CommonModule, McpServerModule],
  controllers: [ToolController],
  providers: [ToolService],
  exports: [ToolService],
})
export class ToolModule {}

import { Module } from '@nestjs/common';
import { McpServerController } from './mcp-server.controller';
import { McpServerService } from './mcp-server.service';
import { CommonModule } from '../common/common.module';
import { McpEnabledGuard } from './mcp-enabled.guard';

@Module({
  imports: [CommonModule],
  controllers: [McpServerController],
  providers: [McpServerService, McpEnabledGuard],
  exports: [McpServerService],
})
export class McpServerModule {}

import { Module } from '@nestjs/common';
import { McpServerController } from './mcp-server.controller';
import { McpServerService } from './mcp-server.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [McpServerController],
  providers: [McpServerService],
  exports: [McpServerService],
})
export class McpServerModule {}

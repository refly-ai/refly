import { Module } from '@nestjs/common';
import { McpModule, McpTransportType } from '@rekog/mcp-nest';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { InternalMcpService } from './internal-mcp.service';
import { SearchTools } from './tools/search.tools';
import { MediaGeneratorTools } from './tools/media-generator.tools';
import { ProviderQueryTools } from './tools/provider-query.tools';
import { SearchModule } from '../search/search.module';
import { RAGModule } from '../rag/rag.module';
import { ProviderModule } from '../provider/provider.module';
import { CommonModule } from '../common/common.module';
import { MediaGeneratorModule } from '../media-generator/media-generator.module';
import { ActionModule } from '../action/action.module';

@Module({
  imports: [
    McpModule.forRoot({
      name: 'refly-mcp-server',
      version: '1.0.0',
      guards: [JwtAuthGuard], // Use JwtAuthGuard to protect MCP endpoints
      transport: McpTransportType.STREAMABLE_HTTP, // Use Streamable HTTP transport
      // Default endpoint is /mcp
    }),
    CommonModule,
    RAGModule,
    ProviderModule,
    MediaGeneratorModule,
    ActionModule,
    SearchModule,
  ],
  providers: [
    InternalMcpService,
    McpServerService,
    // McpServerTools,
    SearchTools,
    MediaGeneratorTools,
    ProviderQueryTools,
    JwtAuthGuard,
  ],
  exports: [InternalMcpService],
})
export class InternalMcpModule {}

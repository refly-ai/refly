import { Module } from '@nestjs/common';
import { McpModule, McpTransportType } from '@rekog/mcp-nest';
import { JwtAuthGuard } from '@/modules/auth/guard/jwt-auth.guard';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { PrismaService } from '@/modules/common/prisma.service';
import { EncryptionService } from '@/modules/common/encryption.service';
import { InternalMcpService } from '@/modules/internal-mcp/internal-mcp.service';
import { SearchTools } from '@/modules/internal-mcp/tools/search.tools';
import { SearchService } from '@/modules/search/search.service';
import { RAGModule } from '@/modules/rag/rag.module';
import { ProviderModule } from '@/modules/provider/provider.module';
import { CommonModule } from '@/modules/common/common.module';

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
  ],
  providers: [
    InternalMcpService,
    McpServerService,
    PrismaService,
    EncryptionService,
    // McpServerTools,
    SearchTools,
    SearchService,
    JwtAuthGuard,
  ],
  exports: [InternalMcpService],
})
export class InternalMcpModule {}

import { Module } from '@nestjs/common';
import { McpServerController } from './mcp-server.controller';
import { McpServerService } from './mcp-server.service';
import { PrismaService } from '@/modules/common/prisma.service';
import { EncryptionService } from '@/modules/common/encryption.service';

@Module({
  controllers: [McpServerController],
  providers: [McpServerService, PrismaService, EncryptionService],
  exports: [McpServerService],
})
export class McpServerModule {}

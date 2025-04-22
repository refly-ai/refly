import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MCPService } from './mcp.service';
import { MCPController } from './mcp.controller';
import { CommonModule } from '../common/common.module';
import { MCPConfigService } from './mcp-config.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * MCP Module
 *
 * Provides functionality for MCP server management and connection testing
 */
@Module({
  imports: [
    CommonModule,
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('auth.jwt.secret'),
        signOptions: { expiresIn: configService.get('auth.jwt.expiresIn') },
      }),
    }),
  ],
  controllers: [MCPController],
  providers: [MCPService, MCPConfigService],
  exports: [MCPService, MCPConfigService],
})
export class MCPModule {}

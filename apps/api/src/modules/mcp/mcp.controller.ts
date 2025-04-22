import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MCPServer } from '@refly/common-types';

import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { MCPService } from './mcp.service';
import { MCPConfigService } from './mcp-config.service';

/**
 * MCP Controller
 *
 * Provides API endpoints for managing MCP server configurations
 * and testing connections to MCP servers
 */
@Controller('v1/mcp')
export class MCPController {
  constructor(
    private readonly mcpService: MCPService,
    private readonly mcpConfigService: MCPConfigService,
  ) {}

  /**
   * Test connection to an MCP server
   * @param server Server configuration to test
   * @returns Success status
   */
  @UseGuards(JwtAuthGuard)
  @Post('test-connection')
  async testConnection(@Body() server: MCPServer) {
    return { success: await this.mcpService.testConnection(server) };
  }

  /**
   * Get all MCP servers for the current user
   * @param req The request object containing user info
   * @returns Array of MCP servers
   */
  @UseGuards(JwtAuthGuard)
  @Get('servers')
  async getUserServers(@Req() req) {
    const userId = req.user.id;
    return await this.mcpConfigService.getUserMCPServers(userId);
  }

  /**
   * Create a new MCP server
   * @param req The request object containing user info
   * @param server Server configuration to create
   * @returns The created server
   */
  @UseGuards(JwtAuthGuard)
  @Post('servers')
  async createServer(@Req() req, @Body() server: Omit<MCPServer, 'id'>) {
    const userId = req.user.id;
    return await this.mcpConfigService.createMCPServer(userId, server);
  }

  /**
   * Update an existing MCP server
   * @param req The request object containing user info
   * @param id Server ID to update
   * @param server Updated server configuration
   * @returns The updated server
   */
  @UseGuards(JwtAuthGuard)
  @Put('servers/:id')
  async updateServer(@Req() req, @Param('id') id: string, @Body() server: MCPServer) {
    const userId = req.user.id;
    // Ensure ID matches
    server.id = id;
    return await this.mcpConfigService.updateMCPServer(userId, server);
  }

  /**
   * Delete an MCP server
   * @param req The request object containing user info
   * @param id Server ID to delete
   * @returns Success status
   */
  @UseGuards(JwtAuthGuard)
  @Delete('servers/:id')
  async deleteServer(@Req() req, @Param('id') id: string) {
    const userId = req.user.id;
    await this.mcpConfigService.deleteMCPServer(userId, id);
    return { success: true };
  }

  /**
   * Update a server's active state
   * @param req The request object containing user info
   * @param id Server ID to update
   * @param isActive New active state
   * @returns The updated server
   */
  @UseGuards(JwtAuthGuard)
  @Put('servers/:id/active')
  async setServerActive(
    @Req() req,
    @Param('id') id: string,
    @Body() { isActive }: { isActive: boolean },
  ) {
    const userId = req.user.id;
    return await this.mcpConfigService.setServerActive(userId, id, isActive);
  }

  /**
   * Get a specific MCP server by ID
   * @param id Server ID
   * @returns The server configuration
   */
  @UseGuards(JwtAuthGuard)
  @Get('servers/:id')
  async getServerById(@Param('id') id: string) {
    return await this.mcpConfigService.getMCPServerById(id);
  }

  /**
   * Import MCP server configurations
   * @param req The request object containing user info
   * @param config Configuration JSON string
   * @returns Import results
   */
  @UseGuards(JwtAuthGuard)
  @Post('import-config')
  async importConfig(@Req() req, @Body() { config }: { config: string }) {
    const userId = req.user.id;
    try {
      const configs = JSON.parse(config) as Partial<MCPServer>[];
      const importedServers: MCPServer[] = [];

      for (const serverConfig of configs) {
        if (!serverConfig.name || !serverConfig.type || !serverConfig.baseUrl) {
          continue; // Skip invalid configurations
        }

        const newServer = await this.mcpConfigService.createMCPServer(userId, {
          name: serverConfig.name,
          type: serverConfig.type as 'sse' | 'streamableHttp',
          baseUrl: serverConfig.baseUrl,
          description: serverConfig.description,
          headers: serverConfig.headers,
          isActive: false, // Default imported servers to inactive
          isBuiltin: false,
          disabledTools: serverConfig.disabledTools || [],
        });

        importedServers.push(newServer);
      }

      return {
        success: true,
        count: importedServers.length,
        servers: importedServers,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to import configuration: ${error.message}`,
      };
    }
  }

  /**
   * Export MCP server configurations
   * @param req The request object containing user info
   * @param ids Optional comma-separated server IDs to export
   * @returns Export configuration
   */
  @UseGuards(JwtAuthGuard)
  @Get('export-config')
  async exportConfig(@Req() req, @Query('ids') idsParam?: string) {
    const userId = req.user.id;
    const userServers = await this.mcpConfigService.getUserMCPServers(userId);

    // If IDs provided, only export specified servers
    const ids = idsParam ? idsParam.split(',') : null;
    const servers = ids
      ? userServers.filter((s) => ids.includes(s.id) && !s.isBuiltin)
      : userServers.filter((s) => !s.isBuiltin);

    // Remove sensitive fields for export
    const exportServers = servers.map((s) => ({
      name: s.name,
      type: s.type,
      baseUrl: s.baseUrl,
      description: s.description,
      headers: s.headers,
      disabledTools: s.disabledTools,
    }));

    return { config: JSON.stringify(exportServers, null, 2) };
  }
}

import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MCPServer } from '@refly/common-types';
import { nanoid } from 'nanoid';

@Injectable()
export class MCPConfigService {
  private readonly logger = new Logger(MCPConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all global MCP servers
   * @returns Array of global MCP server configurations
   */
  async getGlobalMCPServers(): Promise<MCPServer[]> {
    try {
      const servers = await this.prisma.mCPServer.findMany({
        where: {
          isGlobal: true,
          deletedAt: null,
        },
      });

      return servers.map((server) => this.mapDbServerToDto(server));
    } catch (error) {
      this.logger.error('Error fetching global MCP servers:', error);
      return [];
    }
  }

  /**
   * Get MCP servers for a specific user, including global servers
   * @param userId The user ID to fetch servers for
   * @returns Array of MCP server configurations accessible by the user
   */
  async getUserMCPServers(userId: string): Promise<MCPServer[]> {
    try {
      const servers = await this.prisma.mCPServer.findMany({
        where: {
          OR: [
            { userId, deletedAt: null },
            { isGlobal: true, deletedAt: null },
          ],
        },
      });

      return servers.map((server) => this.mapDbServerToDto(server));
    } catch (error) {
      this.logger.error(`Error fetching MCP servers for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Create a new MCP server configuration
   * @param userId The user ID creating the server
   * @param server The server configuration to create
   * @returns The created server configuration
   */
  async createMCPServer(userId: string, server: Omit<MCPServer, 'id'>): Promise<MCPServer> {
    try {
      const createdServer = await this.prisma.mCPServer.create({
        data: {
          id: nanoid(),
          name: server.name,
          type: server.type,
          baseUrl: server.baseUrl,
          description: server.description,
          headers: server.headers as any,
          isActive: server.isActive,
          isBuiltin: server.isBuiltin || false,
          disabledTools: server.disabledTools || [],
          userId,
        },
      });

      return this.mapDbServerToDto(createdServer);
    } catch (error) {
      this.logger.error('Error creating MCP server:', error);
      throw new Error(`Failed to create MCP server: ${error.message}`);
    }
  }

  /**
   * Update an existing MCP server configuration
   * @param userId The user ID updating the server
   * @param server The server configuration with updates
   * @returns The updated server configuration
   */
  async updateMCPServer(userId: string, server: MCPServer): Promise<MCPServer> {
    try {
      const existingServer = await this.prisma.mCPServer.findUnique({
        where: { id: server.id },
      });

      if (!existingServer) {
        throw new NotFoundException('Server not found');
      }

      if (existingServer.userId !== userId && !existingServer.isGlobal) {
        throw new UnauthorizedException('You do not have permission to update this server');
      }

      const updatedServer = await this.prisma.mCPServer.update({
        where: { id: server.id },
        data: {
          name: server.name,
          type: server.type,
          baseUrl: server.baseUrl,
          description: server.description,
          headers: server.headers as any,
          isActive: server.isActive,
          disabledTools: server.disabledTools || [],
        },
      });

      return this.mapDbServerToDto(updatedServer);
    } catch (error) {
      this.logger.error(`Error updating MCP server ${server.id}:`, error);
      throw error;
    }
  }

  /**
   * Delete an MCP server configuration
   * @param userId The user ID deleting the server
   * @param serverId The ID of the server to delete
   */
  async deleteMCPServer(userId: string, serverId: string): Promise<void> {
    try {
      const existingServer = await this.prisma.mCPServer.findUnique({
        where: { id: serverId },
      });

      if (!existingServer) {
        return; // Server already doesn't exist, treat as success
      }

      if (existingServer.userId !== userId) {
        throw new UnauthorizedException('You do not have permission to delete this server');
      }

      if (existingServer.isBuiltin) {
        throw new Error('Cannot delete built-in server');
      }

      // Soft delete by setting deletedAt timestamp
      await this.prisma.mCPServer.update({
        where: { id: serverId },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });

      // Also invalidate tool cache
      await this.prisma.mCPToolCache.deleteMany({
        where: { serverId },
      });
    } catch (error) {
      this.logger.error(`Error deleting MCP server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific MCP server by ID
   * @param serverId The server ID to fetch
   * @returns The server configuration or null if not found
   */
  async getMCPServerById(serverId: string): Promise<MCPServer | null> {
    try {
      const server = await this.prisma.mCPServer.findFirst({
        where: {
          id: serverId,
          deletedAt: null,
        },
      });

      if (!server) {
        return null;
      }

      return this.mapDbServerToDto(server);
    } catch (error) {
      this.logger.error(`Error fetching MCP server ${serverId}:`, error);
      return null;
    }
  }

  /**
   * Set a server's active state
   * @param userId The user ID updating the server
   * @param serverId The server ID to update
   * @param isActive The new active state
   * @returns The updated server configuration
   */
  async setServerActive(userId: string, serverId: string, isActive: boolean): Promise<MCPServer> {
    try {
      const existingServer = await this.prisma.mCPServer.findUnique({
        where: { id: serverId },
      });

      if (!existingServer) {
        throw new NotFoundException('Server not found');
      }

      if (existingServer.userId !== userId && !existingServer.isGlobal) {
        throw new UnauthorizedException('You do not have permission to update this server');
      }

      const updatedServer = await this.prisma.mCPServer.update({
        where: { id: serverId },
        data: { isActive },
      });

      return this.mapDbServerToDto(updatedServer);
    } catch (error) {
      this.logger.error(`Error updating MCP server active state ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Map database server entity to DTO
   * @param dbServer The database server entity
   * @returns The server DTO
   */
  private mapDbServerToDto(dbServer: any): MCPServer {
    return {
      id: dbServer.id,
      name: dbServer.name,
      type: dbServer.type as 'sse' | 'streamableHttp',
      baseUrl: dbServer.baseUrl,
      description: dbServer.description,
      headers: dbServer.headers as Record<string, string>,
      isActive: dbServer.isActive,
      isBuiltin: dbServer.isBuiltin,
      disabledTools: dbServer.disabledTools as string[],
    };
  }
}

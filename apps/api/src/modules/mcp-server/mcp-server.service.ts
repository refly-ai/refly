import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  DeleteMcpServerRequest,
  ListMcpServersData,
  UpsertMcpServerRequest,
  User,
} from '@refly/openapi-schema';
import { McpServer as McpServerModel } from '@prisma/client';
import { McpServerNotFoundError, ParamsError } from '@refly/errors';
import { SingleFlightCache } from '../../utils/cache';
import { EncryptionService } from '../common/encryption.service';
import { Connection, MultiServerMCPClient, createMcpClientConfig } from '@refly/skill-template';

/**
 * Server configuration type for encryption/decryption operations
 * Contains sensitive information fields that may need to be encrypted/decrypted
 */
interface ServerWithSensitiveInfo {
  headers?: string;
  env?: string;
  [key: string]: any; // Allow any other properties
}

interface GlobalMcpServerConfig {
  servers: McpServerModel[];
}

@Injectable()
export class McpServerService {
  private logger = new Logger(McpServerService.name);
  private globalMcpServerCache: SingleFlightCache<GlobalMcpServerConfig>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {
    this.globalMcpServerCache = new SingleFlightCache(this.fetchGlobalMcpServerConfig.bind(this));
  }

  /**
   * Fetch global MCP server configurations
   */
  async fetchGlobalMcpServerConfig(): Promise<GlobalMcpServerConfig> {
    const servers = await this.prisma.mcpServer.findMany({
      where: {
        isGlobal: true,
        deletedAt: null,
      },
    });

    // Decrypt sensitive information
    const decryptedServers = servers.map((server) => this.decryptServerConfig(server));

    return { servers: decryptedServers };
  }

  /**
   * Encrypt sensitive information in server config
   * @param server Server configuration containing sensitive information that may need encryption
   * @returns Encrypted server configuration
   */
  private encryptServerConfig<T extends ServerWithSensitiveInfo>(server: T): T {
    const result = { ...server };

    // Encrypt headers containing sensitive information
    if (result.headers) {
      try {
        result.headers = this.encryptionService.encrypt(result.headers);
      } catch (e) {
        this.logger.warn(`Failed to encrypt headers: ${e}`);
      }
    }

    // Encrypt environment variables containing sensitive information
    if (result.env) {
      try {
        result.env = this.encryptionService.encrypt(result.env);
      } catch (e) {
        this.logger.warn(`Failed to encrypt env: ${e}`);
      }
    }

    return result;
  }

  /**
   * Decrypt sensitive information in server config
   * @param server Server configuration containing sensitive information that may need decryption
   * @returns Decrypted server configuration
   */
  private decryptServerConfig<T extends ServerWithSensitiveInfo>(server: T): T {
    const result = { ...server };

    // Decrypt headers containing sensitive information
    if (result.headers) {
      try {
        result.headers = this.encryptionService.decrypt(result.headers);
      } catch (e) {
        this.logger.warn(`Failed to decrypt headers: ${e}`);
      }
    }

    // Decrypt environment variables containing sensitive information
    if (result.env) {
      try {
        result.env = this.encryptionService.decrypt(result.env);
      } catch (e) {
        this.logger.warn(`Failed to decrypt env: ${e}`);
      }
    }

    return result;
  }

  /**
   * List MCP servers for a user
   */
  async listMcpServers(user: User, param: ListMcpServersData['query']) {
    const { enabled, type } = param;
    const servers = await this.prisma.mcpServer.findMany({
      where: {
        uid: user.uid,
        enabled,
        type,
        deletedAt: null,
      },
      orderBy: [
        { enabled: 'desc' }, // true comes before false when ordered descending
        { updatedAt: 'desc' }, // Most recent updates first
        { name: 'asc' }, // Then by name alphabetically
      ],
    });

    // Decrypt sensitive information
    const decryptedServers = servers.map((server) => this.decryptServerConfig(server));

    const { servers: globalServers } = await this.globalMcpServerCache.get();
    return [...globalServers, ...decryptedServers];
  }

  /**
   * Create a new MCP server
   */
  async createMcpServer(user: User, param: UpsertMcpServerRequest) {
    const { name, type, url, command, args, env, headers, reconnect, config, enabled } = param;

    if (!name || !type) {
      throw new ParamsError('Server name and type are required');
    }

    if (type === 'stdio') {
      throw new ParamsError(
        "MCP servers with type 'stdio' are not supported in the web interface. Please select a different server type.",
      );
    }

    const existingServer = await this.prisma.mcpServer.findFirst({
      where: {
        name,
        uid: user.uid,
      },
    });

    // If a deleted server with the same name exists, restore and update it
    if (existingServer) {
      this.logger.log(`Restoring deleted MCP server with name '${name}'`);

      // Encrypt sensitive information
      const serverData = this.encryptServerConfig({
        name,
        type,
        url,
        command,
        args: args ? JSON.stringify(args) : null,
        env: env ? JSON.stringify(env) : null,
        headers: headers ? JSON.stringify(headers) : null,
        reconnect: reconnect ? JSON.stringify(reconnect) : null,
        config: config ? JSON.stringify(config) : null,
        enabled,
        deletedAt: null,
      });

      const updatedServer = await this.prisma.mcpServer.update({
        where: {
          pk: existingServer.pk,
        },
        data: serverData,
      });

      // Return decrypted server configuration
      return this.decryptServerConfig(updatedServer);
    }

    // Validate required fields based on server type
    if ((type === 'sse' || type === 'streamable') && !url) {
      throw new ParamsError('URL is required for SSE and Streamable server types');
    }

    // @ts-ignore
    if (type === 'stdio' && (!command || !args)) {
      throw new ParamsError('Command and args are required for Stdio server type');
    }

    // Encrypt sensitive information
    const serverData = this.encryptServerConfig({
      name,
      type,
      url,
      command,
      args: args ? JSON.stringify(args) : null,
      env: env ? JSON.stringify(env) : null,
      headers: headers ? JSON.stringify(headers) : null,
      reconnect: reconnect ? JSON.stringify(reconnect) : null,
      config: config ? JSON.stringify(config) : null,
      enabled,
    });

    const server = await this.prisma.mcpServer.create({
      data: {
        ...serverData,
        uid: user.uid,
      },
    });

    // Return decrypted server configuration
    return this.decryptServerConfig(server);
  }

  /**
   * Update an existing MCP server
   */
  async updateMcpServer(user: User, param: UpsertMcpServerRequest) {
    const { name, type, url, command, args, env, headers, reconnect, config, enabled } = param;

    if (!name) {
      throw new ParamsError('Server name is required');
    }

    // Find server by name
    const server = await this.prisma.mcpServer.findFirst({
      where: {
        name,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!server) {
      throw new McpServerNotFoundError();
    }
    if (server.isGlobal) {
      throw new ParamsError('Global MCP server cannot be updated');
    }

    // Validate required fields based on server type
    if (type) {
      if ((type === 'sse' || type === 'streamable') && !url && !server.url) {
        throw new ParamsError('URL is required for SSE and Streamable server types');
      }

      if (type === 'stdio' && !command && !server.command && !args && !server.args) {
        throw new ParamsError('Command and args are required for Stdio server type');
      }
    }

    // Encrypt sensitive information
    const serverData = this.encryptServerConfig({
      name,
      type,
      url,
      command,
      args: args ? JSON.stringify(args) : undefined,
      env: env ? JSON.stringify(env) : undefined,
      headers: headers ? JSON.stringify(headers) : undefined,
      reconnect: reconnect ? JSON.stringify(reconnect) : undefined,
      config: config ? JSON.stringify(config) : undefined,
      enabled,
    });

    const updatedServer = await this.prisma.mcpServer.update({
      where: {
        pk: server.pk,
      },
      data: serverData,
    });

    // Return decrypted server configuration
    return this.decryptServerConfig(updatedServer);
  }

  /**
   * Delete an MCP server
   */
  async deleteMcpServer(user: User, param: DeleteMcpServerRequest) {
    const { name } = param;

    if (!name) {
      throw new ParamsError('Server name is required');
    }

    // Find server by name
    const server = await this.prisma.mcpServer.findFirst({
      where: {
        name,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!server) {
      throw new McpServerNotFoundError();
    }
    if (server.isGlobal) {
      throw new ParamsError('Global MCP server cannot be deleted');
    }

    return this.prisma.mcpServer.update({
      where: {
        pk: server.pk,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Test MCP server connection
   * @param config - MCP client configuration
   * @param timeoutMs - Connection timeout in milliseconds
   * @returns Promise that resolves if connection is successful
   */
  private async testMcpConnection(config: Record<string, Connection>, timeoutMs = 15000) {
    if (Object.keys(config).length === 0) {
      throw new ParamsError('Invalid server configuration');
    }

    // Create MCP client and attempt to initialize connection
    const client = new MultiServerMCPClient(config);
    // Set timeout to avoid long waits
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
    });

    try {
      // Attempt to initialize connection with timeout
      await Promise.race([client.initializeConnections(), timeoutPromise]);

      // Optionally verify tools are available
      const tools = await client.getTools();
      if (!tools || tools.length === 0) {
        throw new Error('No tools found for this MCP server');
      }

      // Close connection if successful
      await client.close();

      return tools?.map((item) => ({ name: item.name, description: item.description })) || [];
    } catch (error) {
      // Ensure client is closed even if connection fails
      await client.close().catch(() => {
        // Ignore errors during cleanup
      });
      throw error;
    }
  }

  /**
   * Validate MCP server configuration
   * Ensures the server can be properly connected and initialized
   */
  async validateMcpServer(_user: User, param: UpsertMcpServerRequest) {
    const { name, type, url, command, args } = param;

    // Basic parameter validation
    if (!type) {
      throw new ParamsError('Server type is required');
    }

    if ((type === 'sse' || type === 'streamable') && !url) {
      throw new ParamsError('URL is required for SSE and Streamable server types');
    }

    if (type === 'stdio' && (!command || !args)) {
      throw new ParamsError('Command and args are required for Stdio server type');
    }

    // Test actual connection to validate server configuration
    try {
      this.logger.log(`Validating MCP server connection for "${name || 'unnamed server'}"`);

      // Create client configuration using the shared utility function
      const serverConfig = createMcpClientConfig(param);

      this.logger.log(`MCP server "${name || 'unnamed server'}" connection validated successfully`);
      // Test connection
      return this.testMcpConnection(serverConfig);
    } catch (error) {
      this.logger.error(`MCP server validation failed: ${error.message}`, error.stack);
      throw new ParamsError(`MCP server validation failed: ${error.message}`);
    }
  }
}

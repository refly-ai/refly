import { Injectable, Logger } from '@nestjs/common';
import { MCPServer } from '@refly/common-types';

/**
 * MCP Testing Service
 *
 * This service provides minimal functionality to test connections
 * to MCP servers without implementing a full client.
 */
@Injectable()
export class MCPService {
  private readonly logger = new Logger(MCPService.name);

  /**
   * Test connection to an MCP server
   * @param server MCP server configuration
   * @returns True if connection successful
   */
  async testConnection(server: MCPServer): Promise<boolean> {
    try {
      // Simple fetch request to test connectivity
      const url = new URL('/ping', server.baseUrl);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(server.headers || {}),
      };

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      // Check if the response is successful
      return response.ok;
    } catch (error) {
      this.logger.error(`Connection test failed for server ${server.name}:`, error);
      return false;
    }
  }
}

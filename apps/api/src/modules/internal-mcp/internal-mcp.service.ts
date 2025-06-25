import { Injectable, Logger } from '@nestjs/common';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { EncryptionService } from '@/modules/common/encryption.service';

@Injectable()
export class InternalMcpService {
  private readonly logger = new Logger(InternalMcpService.name);

  // List of sensitive fields that will be filtered in responses
  private readonly sensitiveFields = [
    'token',
    'secret',
    'password',
    'apiKey',
    'api_key',
    'key',
    'authorization',
    'auth',
    'access_token',
    'refresh_token',
    'jwt',
    'credential',
    'private',
  ];

  constructor(
    private readonly mcpServerService: McpServerService,
    private readonly encryptionService: EncryptionService,
  ) {}

  // This service provides helper methods for MCP tool implementation
  // For example, error handling, response formatting, etc.

  /**
   * Format error response
   */
  formatErrorResponse(error: any): { content: Array<{ type: string; text: string }> } {
    this.logger.error('MCP Tool error:', error);
    return {
      content: [{ type: 'text', text: `Error: ${error.message || 'Unknown error'}` }],
    };
  }

  /**
   * Format success response, filtering sensitive fields
   */
  formatSuccessResponse(data: any): { content: Array<{ type: string; text: string }> } {
    // Filter sensitive fields
    const filteredData = this.filterSensitiveFields(data);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(filteredData, null, 2),
        },
      ],
    };
  }

  /**
   * Filter sensitive fields in an object
   * @param data Data to be filtered
   * @returns Filtered data
   */
  private filterSensitiveFields(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    // If it's an array, recursively filter each element
    if (Array.isArray(data)) {
      return data.map((item) => this.filterSensitiveFields(item));
    }

    // If it's an object, recursively filter each property
    if (typeof data === 'object') {
      const result = { ...data };

      for (const key in result) {
        // Check if the key name contains sensitive fields
        const isKeySensitive = this.sensitiveFields.some((field) =>
          key.toLowerCase().includes(field.toLowerCase()),
        );

        if (isKeySensitive) {
          // If it's a sensitive field, replace with [REDACTED]
          result[key] = '[REDACTED]';
        } else if (typeof result[key] === 'object' && result[key] !== null) {
          // Recursively filter nested objects
          result[key] = this.filterSensitiveFields(result[key]);
        }
      }

      return result;
    }

    // Return primitive types directly
    return data;
  }
}

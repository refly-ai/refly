/**
 * Tool Execution Service
 * Unified service for executing tools via API. Basic components for PTC.
 *
 */

import { Injectable, Logger } from '@nestjs/common';
import type { User } from '@refly/openapi-schema';
import type { ExecuteToolRequest } from '@refly/openapi-schema';
import { ParamsError } from '@refly/errors';
import { ComposioService } from '../composio/composio.service';
import { ToolIdentifyService } from './tool-identify.service';
import type { ToolIdentification } from './tool-identify.service';

@Injectable()
export class ToolExecutionService {
  private readonly logger = new Logger(ToolExecutionService.name);

  constructor(
    private readonly composioService: ComposioService,
    private readonly toolIdentifyService: ToolIdentifyService,
  ) {}

  /**
   * Execute a tool by toolset key and tool name
   * Routes to the appropriate executor based on tool type
   *
   * @param user - The user executing the tool
   * @param request - The execution request (toolsetKey, toolName, arguments)
   * @returns Tool execution result
   */
  async executeTool(user: User, request: ExecuteToolRequest): Promise<Record<string, unknown>> {
    const { toolsetKey, toolName, arguments: args } = request;

    if (!toolsetKey) {
      throw new ParamsError('toolsetKey is required');
    }

    if (!toolName) {
      throw new ParamsError('toolName is required');
    }

    // 1. Identify tool type and get connection info
    const toolInfo = await this.toolIdentifyService.identifyTool(user, toolsetKey);

    this.logger.log(
      `Executing tool: ${toolName} from toolset: ${toolsetKey}, type: ${toolInfo.type}`,
    );

    // 2. Route to appropriate executor based on type
    switch (toolInfo.type) {
      case 'composio_oauth':
      case 'composio_apikey':
        return await this.executeComposioTool(toolInfo, toolName, args ?? {});

      case 'config_based':
        throw new ParamsError(
          `Toolset ${toolsetKey} not supported: config_based tool execution is not implemented.`,
        );

      case 'legacy_sdk':
        throw new ParamsError(
          `Toolset ${toolsetKey} not supported: legacy_sdk tool execution is not implemented.`,
        );

      case 'mcp':
        // TODO return a user-friendly error message
        throw new ParamsError(
          `Toolset ${toolsetKey} not supported: MCP tool execution is not supported.`,
        );

      case 'builtin':
        throw new ParamsError(
          `Toolset ${toolsetKey} not supported: builtin tool execution is not supported.`,
        );

      default:
        throw new ParamsError(`Unsupported tool type: ${toolInfo.type}`);
    }
  }

  /**
   * Execute a Composio tool (OAuth or API Key)
   *
   * @param toolInfo - Tool identification info
   * @param toolName - Tool method name
   * @param args - Tool arguments
   * @returns Execution result
   */
  private async executeComposioTool(
    toolInfo: ToolIdentification,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!toolInfo.connectedAccountId || !toolInfo.userId) {
      throw new ParamsError('Missing connection info for Composio tool execution');
    }

    const result = await this.composioService.executeTool(
      toolInfo.userId,
      toolInfo.connectedAccountId,
      toolName,
      args,
    );

    // Return the result data
    // Composio tools return { successful: boolean, data: any, error?: string }
    if (result.successful) {
      return {
        status: 'success',
        data: result.data,
      };
    }

    return {
      status: 'error',
      error: result.error ?? 'Tool execution failed',
      data: result.data,
    };
  }
}

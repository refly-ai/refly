/**
 * Tool Execution Service
 * Unified service for executing tools via API. Basic components for PTC.
 *
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { User } from '@refly/openapi-schema';
import type { ExecuteToolRequest } from '@refly/openapi-schema';
import { ParamsError } from '@refly/errors';
import { ComposioService } from '../composio/composio.service';
import { ToolIdentifyService } from './tool-identify.service';
import type { ToolIdentification } from './tool-identify.service';
import { ToolCallService, ToolCallStatus } from '../../tool-call/tool-call.service';
import { PrismaService } from '../../common/prisma.service';

/**
 * PTC (Programmatic Tool Call) context for /v1/tool/execute API
 * Passed from sandbox environment via HTTP headers
 */
export interface PtcToolExecuteContext {
  /** Parent call ID from execute_code tool */
  ptcCallId?: string;
  /** Result ID for the action */
  resultId?: string;
  /** Result version */
  version?: number;
}

export enum CallType {
  PTC = 'ptc',
  STANDALONE = 'standalone',
}

@Injectable()
export class ToolExecutionService {
  private readonly logger = new Logger(ToolExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly composioService: ComposioService,
    private readonly toolIdentifyService: ToolIdentifyService,
    private readonly toolCallService: ToolCallService,
  ) {}

  /**
   * Execute a tool by toolset key and tool name
   * Routes to the appropriate executor based on tool type
   *
   * @param user - The user executing the tool
   * @param request - The execution request (toolsetKey, toolName, arguments)
   * @param ptcContext - Optional PTC context for sandbox tool calls
   * @returns Tool execution result
   */
  async executeTool(
    user: User,
    request: ExecuteToolRequest,
    ptcContext?: PtcToolExecuteContext,
  ): Promise<Record<string, unknown>> {
    const { toolsetKey, toolName, arguments: args } = request;

    if (!toolsetKey) {
      throw new ParamsError('toolsetKey is required');
    }

    if (!toolName) {
      throw new ParamsError('toolName is required');
    }

    // Determine call type and context
    const hasPtcContext = !!ptcContext?.ptcCallId;
    const callType = hasPtcContext ? CallType.PTC : CallType.STANDALONE;

    // Get resultId/version from HTTP headers (ptcContext)
    const { resultId, version } = ptcContext ?? {};

    // For PTC mode, fetch stepName from parent execute_code call
    let stepName: string | undefined;
    if (hasPtcContext && ptcContext?.ptcCallId) {
      try {
        const parentCall = await this.prisma.toolCallResult.findUnique({
          where: { callId: ptcContext.ptcCallId },
          select: { stepName: true },
        });
        stepName = parentCall?.stepName ?? undefined;
      } catch (error) {
        this.logger.warn(
          `Failed to fetch stepName for ptcCallId ${ptcContext.ptcCallId}: ${error}`,
        );
      }
    }

    // Generate a unique call ID for this execution
    const callId = this.generateCallId(callType);
    const startTime = Date.now();

    this.logger.log(
      `Executing tool: ${toolName} from toolset: ${toolsetKey}, type: ${callType}, callId: ${callId}`,
    );

    // 1. Persist initial "executing" record BEFORE any execution logic
    await this.persistToolCallStart({
      callId,
      uid: user.uid,
      toolsetId: toolsetKey,
      toolName,
      input: { input: args ?? {} },
      type: callType,
      ptcCallId: ptcContext?.ptcCallId,
      resultId: resultId ?? 'non-result-id',
      version: version ?? 0,
      createdAt: startTime,
      stepName, // Pass stepName for PTC calls
    });

    // 2. Execute tool and capture result
    let result: Record<string, unknown>;
    let errorMessage: string | undefined;

    try {
      // Identify tool type and get connection info
      const toolInfo = await this.toolIdentifyService.identifyTool(user, toolsetKey);

      // Route to appropriate executor based on type
      switch (toolInfo.type) {
        case 'composio_oauth':
        case 'composio_apikey':
          result = await this.executeComposioTool(toolInfo, toolName, args ?? {});
          break;

        case 'config_based':
          throw new ParamsError(
            `Toolset ${toolsetKey} not supported: config_based tool execution is not implemented.`,
          );

        case 'legacy_sdk':
          throw new ParamsError(
            `Toolset ${toolsetKey} not supported: legacy_sdk tool execution is not implemented.`,
          );

        case 'mcp':
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
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      result = { status: 'error', error: errorMessage };
    }

    // 4. Update record with final status
    const endTime = Date.now();
    const status = errorMessage ? ToolCallStatus.FAILED : ToolCallStatus.COMPLETED;

    await this.persistToolCallEnd({
      callId,
      output: result,
      status,
      error: errorMessage,
      updatedAt: endTime,
    });

    return result;
  }

  /**
   * Generate a unique call ID for tool execution
   * Format: `{callType}:{uuid}` (toolset/tool info lives in the DB record)
   */
  private generateCallId(callType: CallType): string {
    return `${callType}:${randomUUID()}`;
  }

  /**
   * Persist initial tool call record with "executing" status
   */
  private async persistToolCallStart(params: {
    callId: string;
    uid: string;
    toolsetId: string;
    toolName: string;
    input: Record<string, unknown>;
    type: 'ptc' | 'standalone';
    ptcCallId?: string;
    resultId: string;
    version: number;
    createdAt: number;
    stepName?: string;
  }): Promise<void> {
    const {
      callId,
      uid,
      toolsetId,
      toolName,
      input,
      type,
      ptcCallId,
      resultId,
      version,
      createdAt,
      stepName,
    } = params;

    await this.prisma.toolCallResult.create({
      data: {
        callId,
        uid,
        toolsetId,
        toolName,
        input: JSON.stringify(input),
        output: '',
        status: ToolCallStatus.EXECUTING,
        type,
        ptcCallId: ptcCallId ?? null,
        resultId,
        version,
        createdAt: new Date(createdAt),
        updatedAt: new Date(createdAt),
        stepName: stepName ?? null,
      },
    });
  }

  /**
   * Update tool call record with final status
   */
  private async persistToolCallEnd(params: {
    callId: string;
    output: Record<string, unknown>;
    status: ToolCallStatus;
    error?: string;
    updatedAt: number;
  }): Promise<void> {
    const { callId, output, status, error, updatedAt } = params;

    await this.prisma.toolCallResult.update({
      where: { callId },
      data: {
        output: JSON.stringify(output),
        status,
        error: error ?? null,
        updatedAt: new Date(updatedAt),
      },
    });
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

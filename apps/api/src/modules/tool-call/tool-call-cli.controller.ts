/**
 * CLI-specific tool call endpoints
 * Provides tool call result queries for CLI tooling
 *
 * SECURITY: User scoping is enforced by verifying resultId ownership
 * via the ActionResult table before returning tool call data.
 */

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User } from '@refly/openapi-schema';
import { ToolCallService } from './tool-call.service';
import { PrismaService } from '../common/prisma.service';
import { buildSuccessResponse } from '../../utils/response';
import { safeParseJSON } from '@refly/utils';
import { sanitizeToolOutput } from '../action/action.dto';

@Controller('v1/cli/tool-call')
@UseGuards(JwtAuthGuard)
export class ToolCallCliController {
  constructor(
    private readonly toolCallService: ToolCallService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get tool calls for an action result
   * @param resultId - The action result ID
   * @param version - Optional version number (defaults to action result's current version)
   */
  @Get()
  async getToolCalls(
    @LoginedUser() user: User,
    @Query('resultId') resultId: string,
    @Query('version') version?: string,
  ) {
    if (!resultId) {
      throw new BadRequestException('resultId is required');
    }

    // SECURITY: Verify that the resultId belongs to the requesting user
    const actionResult = await this.prisma.actionResult.findFirst({
      where: {
        resultId,
        uid: user.uid,
      },
      select: { version: true },
    });

    if (!actionResult) {
      throw new NotFoundException('Action result not found or access denied');
    }

    // Use specified version or default to the latest version from the action result
    const versionNum = version ? Number.parseInt(version, 10) : actionResult.version;

    if (Number.isNaN(versionNum) || versionNum < 0) {
      throw new BadRequestException('Invalid version number');
    }

    const toolCalls = await this.toolCallService.fetchToolCalls(resultId, versionNum);
    return buildSuccessResponse({ toolCalls, version: versionNum });
  }

  /**
   * Get a single tool call by callId
   * @param callId - The tool call ID
   * @param sanitizeForDisplay - Whether to sanitize output for display (default: true)
   */
  @Get(':callId')
  async getToolCall(
    @LoginedUser() user: User,
    @Param('callId') callId: string,
    @Query('sanitizeForDisplay') sanitizeForDisplay?: string,
  ) {
    if (!callId) {
      throw new BadRequestException('callId is required');
    }

    // Fetch the tool call
    const toolCall = await this.prisma.toolCallResult.findFirst({
      where: {
        callId,
        deletedAt: null,
      },
    });

    if (!toolCall) {
      throw new NotFoundException('Tool call not found');
    }

    // SECURITY: Verify that the tool call's resultId belongs to the requesting user
    const actionResult = await this.prisma.actionResult.findFirst({
      where: {
        resultId: toolCall.resultId,
        uid: user.uid,
      },
      select: { resultId: true },
    });

    if (!actionResult) {
      throw new NotFoundException('Tool call not found or access denied');
    }

    // Parse and optionally sanitize output
    const shouldSanitize = sanitizeForDisplay !== 'false';
    const rawOutput = safeParseJSON(toolCall.output || '{}') ?? {};
    const output = shouldSanitize ? sanitizeToolOutput(toolCall.toolName, rawOutput) : rawOutput;

    // Parse input
    const input = safeParseJSON(toolCall.input || '{}') ?? {};

    // Calculate duration if both timestamps exist
    const durationMs =
      toolCall.updatedAt && toolCall.createdAt
        ? toolCall.updatedAt.getTime() - toolCall.createdAt.getTime()
        : undefined;

    return buildSuccessResponse({
      callId: toolCall.callId,
      resultId: toolCall.resultId,
      resultVersion: toolCall.version,
      toolsetId: toolCall.toolsetId,
      toolName: toolCall.toolName,
      stepName: toolCall.stepName,
      input,
      output,
      status: toolCall.status,
      error: toolCall.error,
      createdAt: toolCall.createdAt.toISOString(),
      updatedAt: toolCall.updatedAt.toISOString(),
      durationMs,
    });
  }
}

/**
 * CLI-specific action endpoints
 * Provides action result queries for CLI tooling
 */

import { Controller, Get, Post, Query, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User } from '@refly/openapi-schema';
import { ActionService } from './action.service';
import { buildSuccessResponse } from '../../utils/response';
import { actionResultPO2DTO } from './action.dto';

@Controller('v1/cli/action')
@UseGuards(JwtAuthGuard)
export class ActionCliController {
  constructor(private readonly actionService: ActionService) {}

  /**
   * Get action result by resultId
   * Returns detailed action execution information including steps, tool calls, and messages
   */
  @Get('result')
  async getResult(@LoginedUser() user: User, @Query('resultId') resultId: string) {
    if (!resultId) {
      throw new BadRequestException('resultId is required');
    }
    const result = await this.actionService.getActionResult(user, { resultId });
    // Convert to DTO to avoid BigInt serialization issues (pk field is BigInt)
    return buildSuccessResponse(actionResultPO2DTO(result));
  }

  /**
   * Abort a running action/node execution
   * POST /v1/cli/action/abort
   */
  @Post('abort')
  async abort(@LoginedUser() user: User, @Body() body: { resultId: string; version?: number }) {
    if (!body.resultId) {
      throw new BadRequestException('resultId is required');
    }
    await this.actionService.abortActionFromReq(user, body, 'User requested abort via CLI');
    return buildSuccessResponse({
      message: 'Action aborted successfully',
      resultId: body.resultId,
    });
  }
}

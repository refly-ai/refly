import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { GetActionResultResponse, BaseResponse, AbortActionRequest } from '@refly/openapi-schema';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User as UserModel } from '@prisma/client';
import { buildSuccessResponse } from '../../utils/response';
import { ActionService } from '../action/action.service';
import { actionResultPO2DTO } from '../action/action.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';

@Controller('v1/action')
export class ActionController {
  constructor(private readonly actionService: ActionService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/result')
  async getActionResult(
    @LoginedUser() user: UserModel,
    @Query('resultId') resultId: string,
  ): Promise<GetActionResultResponse> {
    const result = await this.actionService.getActionResult(user, {
      resultId,
      sanitizeForDisplay: true,
    });
    return buildSuccessResponse(actionResultPO2DTO(result, { sanitizeForDisplay: true }));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/abort')
  async abortAction(
    @LoginedUser() user: UserModel,
    @Body() body: AbortActionRequest,
  ): Promise<BaseResponse> {
    await this.actionService.abortActionFromReq(user, body, 'User requested abort');
    return buildSuccessResponse();
  }
}

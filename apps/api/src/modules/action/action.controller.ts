import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { GetActionResultResponse, BaseResponse } from '@refly/openapi-schema';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User as UserModel } from '../../generated/client';
import { buildSuccessResponse } from '../../utils/response';
import { ActionService } from '../action/action.service';
import { actionResultPO2DTO } from '../action/action.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';

interface AbortActionRequest {
  resultId: string;
}

type AbortActionResponse = BaseResponse;

@Controller('v1/action')
export class ActionController {
  constructor(private readonly actionService: ActionService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/result')
  async getActionResult(
    @LoginedUser() user: UserModel,
    @Query('resultId') resultId: string,
  ): Promise<GetActionResultResponse> {
    const result = await this.actionService.getActionResult(user, { resultId });
    return buildSuccessResponse(actionResultPO2DTO(result));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/abort')
  async abortAction(
    @LoginedUser() user: UserModel,
    @Body() body: AbortActionRequest,
  ): Promise<AbortActionResponse> {
    await this.actionService.abortAction(user, body);
    return buildSuccessResponse();
  }
}

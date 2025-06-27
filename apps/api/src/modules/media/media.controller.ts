import { Controller, Post, Body, UseGuards, Get, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { MediaService } from '@/modules/media/media.service';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import {
  User,
  GenerateMediaRequest,
  GenerateMediaResponse,
  GetActionResultResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils/response';
import { actionResultPO2DTO } from '../action/action.dto';

@Controller('v1/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @UseGuards(JwtAuthGuard)
  @Post('/generate')
  async generateMedia(
    @LoginedUser() user: User,
    @Body() body: GenerateMediaRequest,
  ): Promise<GenerateMediaResponse> {
    const { resultId } = await this.mediaService.generateMedia(user, body);
    return buildSuccessResponse({ resultId });
  }

  @UseGuards(JwtAuthGuard)
  @Get('/result')
  async getMediaResult(
    @LoginedUser() user: User,
    @Query('resultId') resultId: string,
    @Query('version') version?: number,
  ): Promise<GetActionResultResponse> {
    const result = await this.mediaService.getMediaResult(user, { resultId, version });
    return buildSuccessResponse(actionResultPO2DTO(result));
  }
}

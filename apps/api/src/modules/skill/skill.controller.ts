import { Controller, UseGuards, Post, Body, Res } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { SkillService } from './skill.service';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User, InvokeSkillRequest, InvokeSkillResponse } from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';
import { Response } from 'express';

@Controller('v1/skill')
export class SkillController {
  constructor(private skillService: SkillService) {}

  @UseGuards(JwtAuthGuard)
  @Post('/invoke')
  async invokeSkill(
    @LoginedUser() user: User,
    @Body() body: InvokeSkillRequest,
  ): Promise<InvokeSkillResponse> {
    const { resultId } = await this.skillService.sendInvokeSkillTask(user, body);
    return buildSuccessResponse({ resultId });
  }

  @UseGuards(JwtAuthGuard)
  @Post('/streamInvoke')
  async streamInvokeSkill(
    @LoginedUser() user: User,
    @Body() body: InvokeSkillRequest,
    @Res() res: Response,
  ) {
    await this.skillService.invokeSkillFromApi(user, body, res);
  }
}

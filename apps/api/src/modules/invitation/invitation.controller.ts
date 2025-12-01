import { Controller, Get, Post, UseGuards, Body } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { ListInvitationCodesResponse, User, BaseResponse } from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';

@Controller('v1/invitation')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/list')
  async listInvitationCodes(@LoginedUser() user: User): Promise<ListInvitationCodesResponse> {
    const invitationCodes = await this.invitationService.listInvitationCodes(user.uid);
    return buildSuccessResponse(invitationCodes);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/activate')
  async activateInvitationCode(
    @LoginedUser() user: User,
    @Body() body: { code: string },
  ): Promise<BaseResponse> {
    return this.invitationService.activateInvitationCode(user.uid, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/invited')
  async hasBeenInvited(@LoginedUser() user: User): Promise<BaseResponse> {
    const hasBeenInvited = await this.invitationService.hasBeenInvited(user.uid);
    return buildSuccessResponse(hasBeenInvited);
  }
}

import { Controller, Logger, Get, Body, UseGuards, Put, Query } from '@nestjs/common';

import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import {
  BaseResponse,
  CheckSettingsFieldResponse,
  GetUserSettingsResponse,
  UpdateUserSettingsRequest,
  User,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';
import { userPO2Settings } from './user.dto';

@Controller('v1/user')
export class UserController {
  private logger = new Logger(UserController.name);

  constructor(private userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('settings')
  async getSettings(@LoginedUser() user: User): Promise<GetUserSettingsResponse> {
    const userPo = await this.userService.getUserSettings(user, true);
    const settings = userPO2Settings(userPo);

    return buildSuccessResponse(settings);
  }

  @UseGuards(JwtAuthGuard)
  @Put('settings')
  async updateSettings(
    @LoginedUser() user: User,
    @Body() body: UpdateUserSettingsRequest,
  ): Promise<BaseResponse> {
    await this.userService.updateSettings(user, body);
    return buildSuccessResponse();
  }

  @UseGuards(JwtAuthGuard)
  @Get('checkSettingsField')
  async checkSettingsField(
    @LoginedUser() user: User,
    @Query('field') field: 'name' | 'email',
    @Query('value') value: string,
  ): Promise<CheckSettingsFieldResponse> {
    const result = await this.userService.checkSettingsField(user, { field, value });
    return buildSuccessResponse(result);
  }
}

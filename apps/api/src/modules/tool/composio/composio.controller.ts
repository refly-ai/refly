import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ComposioConnectionStatusResponse,
  InitiateComposioConnectionResponse,
  User,
} from '@refly/openapi-schema';
import { LoginedUser } from '../../../utils/decorators/user.decorator';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { ComposioService } from './composio.service';

@ApiTags('v1/tool/composio')
@Controller('v1/tool/composio')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ComposioController {
  constructor(private readonly composioService: ComposioService) {}

  /**
   * init OAuth connection
   */
  @Post('/:app/authorize')
  @ApiOperation({ summary: 'authorize OAuth connection' })
  async initiateConnection(
    @LoginedUser() user: User,
    @Param('app') app: string,
  ): Promise<InitiateComposioConnectionResponse> {
    return this.composioService.authApp(user, app);
  }

  /**
   * POST /composio/integrations/:app/revoke
   * Revoke user connection and reset OAuth state
   */
  @Post('/:app/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke user connection and reset OAuth state' })
  async revokeConnection(
    @LoginedUser() user: User,
    @Param('app') app: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.composioService.revokeConnection(user, app);
  }

  /**
   *  query connection status by app slug
   */
  @Get('/:app/status')
  @ApiOperation({ summary: 'query connection status by app slug' })
  async checkConnectionStatus(
    @LoginedUser() user: User,
    @Param('app') app: string,
  ): Promise<ComposioConnectionStatusResponse> {
    return this.composioService.checkAppStatus(user, app);
  }
}

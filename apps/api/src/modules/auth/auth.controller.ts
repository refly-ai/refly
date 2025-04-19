import {
  Controller,
  Logger,
  Get,
  Post,
  Res,
  UseGuards,
  Body,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';

import { LoginedUser } from '../../utils/decorators/user.decorator';
import { AuthService } from './auth.service';
import { GithubOauthGuard } from './guard/github-oauth.guard';
import { GoogleOauthGuard } from './guard/google-oauth.guard';
import { OAuthError } from '@refly/errors';
import {
  EmailSignupRequest,
  EmailLoginRequest,
  CreateVerificationRequest,
  CheckVerificationRequest,
  ResendVerificationRequest,
  AuthConfigResponse,
  CreateVerificationResponse,
  ResendVerificationResponse,
  User,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';
import { hours, minutes, seconds, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { REFRESH_TOKEN_COOKIE } from '@refly/utils';

@Controller('v1/auth')
export class AuthController {
  private logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Get('config')
  getAuthConfig(): AuthConfigResponse {
    return buildSuccessResponse(this.authService.getAuthConfig());
  }

  @Throttle({ default: { limit: 5, ttl: hours(1) } })
  @Post('email/signup')
  async emailSignup(@Body() { email, password }: EmailSignupRequest, @Res() res: Response) {
    const { sessionId, tokenData } = await this.authService.emailSignup(email, password);
    if (tokenData) {
      return this.authService
        .setAuthCookie(res, tokenData)
        .json(buildSuccessResponse({ skipVerification: true }));
    }
    return res.status(200).json(buildSuccessResponse({ sessionId }));
  }

  @Throttle({ default: { limit: 5, ttl: minutes(10) } })
  @Post('email/login')
  async emailLogin(@Body() { email, password }: EmailLoginRequest, @Res() res: Response) {
    const tokens = await this.authService.emailLogin(email, password);
    return this.authService.setAuthCookie(res, tokens).json(buildSuccessResponse());
  }

  @Throttle({ default: { limit: 5, ttl: minutes(10) } })
  @Post('verification/create')
  async createVerification(
    @Body() params: CreateVerificationRequest,
  ): Promise<CreateVerificationResponse> {
    const { sessionId } = await this.authService.createVerification(params);
    return buildSuccessResponse({ sessionId });
  }

  @Throttle({ default: { limit: 1, ttl: seconds(30) } })
  @Post('verification/resend')
  async resendVerification(
    @Body() { sessionId }: ResendVerificationRequest,
  ): Promise<ResendVerificationResponse> {
    await this.authService.addSendVerificationEmailJob(sessionId);
    return buildSuccessResponse();
  }

  @Throttle({ default: { limit: 5, ttl: minutes(10) } })
  @Post('verification/check')
  async checkVerification(@Body() params: CheckVerificationRequest, @Res() res: Response) {
    const tokens = await this.authService.checkVerification(params);
    return this.authService.setAuthCookie(res, tokens).json(buildSuccessResponse());
  }

  @UseGuards(GithubOauthGuard)
  @Get('github')
  async github() {
    // auth guard will automatically handle this
  }

  @UseGuards(GoogleOauthGuard)
  @Get('google')
  async google() {
    // auth guard will automatically handle this
  }

  @UseGuards(GithubOauthGuard)
  @Get('callback/github')
  async githubAuthCallback(@LoginedUser() user: User, @Res() res: Response) {
    try {
      this.logger.log(`github oauth callback success, req.user = ${user?.email}`);

      const tokens = await this.authService.login(user);
      this.authService
        .setAuthCookie(res, tokens)
        .redirect(this.configService.get('auth.redirectUrl'));
    } catch (error) {
      this.logger.error('GitHub OAuth callback failed:', error.stack);
      throw new OAuthError();
    }
  }

  @UseGuards(GoogleOauthGuard)
  @Get('callback/google')
  async googleAuthCallback(@LoginedUser() user: User, @Res() res: Response) {
    try {
      this.logger.log(`google oauth callback success, req.user = ${user?.email}`);

      const tokens = await this.authService.login(user);
      this.authService
        .setAuthCookie(res, tokens)
        .redirect(this.configService.get('auth.redirectUrl'));
    } catch (error) {
      this.logger.error('Google OAuth callback failed:', error.stack);
      throw new OAuthError();
    }
  }

  @Post('refreshToken')
  async refreshToken(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      this.authService.clearAuthCookie(res);
      throw new UnauthorizedException();
    }

    try {
      const tokens = await this.authService.refreshAccessToken(refreshToken);
      this.authService.setAuthCookie(res, tokens);
      res.status(200).json(buildSuccessResponse());
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.authService.clearAuthCookie(res);
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@LoginedUser() user: User, @Res() res: Response) {
    try {
      this.logger.log(`Logging out user: ${user.uid}`);

      await this.authService.revokeAllRefreshTokens(user.uid);

      this.authService.clearAuthCookie(res);

      this.logger.log(`Successfully logged out user: ${user.uid}`);
      return res.status(200).json(buildSuccessResponse());
    } catch (error) {
      this.logger.error(`Logout failed for user ${user.uid}:`, error.stack);
      throw error;
    }
  }
}

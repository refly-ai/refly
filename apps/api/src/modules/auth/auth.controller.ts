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
  Query,
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
  type AuthType,
  ListAccountsResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';
import { seconds, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { REFRESH_TOKEN_COOKIE } from '@refly/utils';
import { accountPO2DTO } from './auth.dto';
import { TwitterOauthGuard } from './guard/twitter-oauth.guard';
import { NotionOauthGuard } from './guard/notion-oauth.guard';
import 'express-session';

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

  @Throttle({ default: { limit: 10, ttl: seconds(10) } })
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

  @Throttle({ default: { limit: 10, ttl: seconds(10) } })
  @Post('email/login')
  async emailLogin(@Body() { email, password }: EmailLoginRequest, @Res() res: Response) {
    const tokens = await this.authService.emailLogin(email, password);
    return this.authService.setAuthCookie(res, tokens).json(buildSuccessResponse());
  }

  @Throttle({ default: { limit: 10, ttl: seconds(10) } })
  @Post('verification/create')
  async createVerification(
    @Body() params: CreateVerificationRequest,
  ): Promise<CreateVerificationResponse> {
    const { sessionId } = await this.authService.createVerification(params);
    return buildSuccessResponse({ sessionId });
  }

  @Throttle({ default: { limit: 10, ttl: seconds(10) } })
  @Post('verification/resend')
  async resendVerification(
    @Body() { sessionId }: ResendVerificationRequest,
  ): Promise<ResendVerificationResponse> {
    await this.authService.sendVerificationEmail(sessionId);
    return buildSuccessResponse();
  }

  @Throttle({ default: { limit: 10, ttl: seconds(10) } })
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

  @Get('google')
  async google(
    @Query('scope') scope: string,
    @Query('redirect') redirect: string,
    @Query('uid') uid: string,
    @Res() res: Response,
  ) {
    try {
      const authUrl = await this.authService.generateGoogleOAuthUrl(scope, redirect, uid);
      res.redirect(authUrl);
    } catch (error) {
      this.logger.error('Google OAuth initiation failed:', error.stack);
      throw new OAuthError();
    }
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

  @UseGuards(TwitterOauthGuard)
  @Get('callback/twitter')
  async twitterAuthCallback(@Res() res: Response) {
    return res.redirect(this.configService.get('auth.redirectUrl'));
  }

  @UseGuards(TwitterOauthGuard)
  @Get('twitter')
  async twitter() {
    // TwitterOauthGuard handles OAuth flow automatically
    // UID is stored in session by the guard's canActivate method
  }
  @Get('notion')
  async notion(
    @Query('uid') uid: string,
    @Query('redirect') redirect: string,
    @Res() res: Response,
  ) {
    try {
      const authUrl = await this.authService.generateNotionOAuthUrl(uid, redirect);
      res.redirect(authUrl);
    } catch (error) {
      this.logger.error('Notion OAuth initiation failed:', error.stack);
      throw new OAuthError();
    }
  }
  @UseGuards(NotionOauthGuard)
  @Get('callback/notion')
  async notionAuthCallback(@Res() res: Response) {
    return res.redirect(this.configService.get('auth.redirectUrl'));
  }

  @UseGuards(GoogleOauthGuard)
  @Get('callback/google')
  async googleAuthCallback(
    @LoginedUser() user: User,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      this.logger.log(`google oauth callback success, req.user = ${user?.email}`);

      const { parsedState, finalRedirect } = await this.authService.parseOAuthState(state);

      if (parsedState?.uid) {
        // Tool OAuth path: skip login cookie and just redirect back
        return res.redirect(finalRedirect);
      }
      const tokens = await this.authService.login(user);
      this.authService.setAuthCookie(res, tokens).redirect(finalRedirect);
    } catch (error) {
      this.logger.error('Google OAuth callback failed:', error.stack);
      throw new OAuthError();
    }
  }

  @UseGuards(GoogleOauthGuard)
  @Get('callback/google/tool')
  async googleToolAuthCallback(
    @LoginedUser() user: User,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      this.logger.log(`google oauth tool callback success, req.user = ${user?.email}`);

      const { parsedState, finalRedirect } = await this.authService.parseOAuthState(state);

      if (parsedState?.uid) {
        // Tool OAuth path: skip login cookie and just redirect back
        return res.redirect(finalRedirect);
      }
      const tokens = await this.authService.login(user);
      this.authService.setAuthCookie(res, tokens).redirect(finalRedirect);
    } catch (error) {
      this.logger.error('Google OAuth callback failed:', error.stack);
      throw new OAuthError();
    }
  }

  // Tool OAuth endpoints - specific routes first
  @UseGuards(JwtAuthGuard)
  @Get('tool-oauth/status')
  async checkToolOAuthStatus(
    @LoginedUser() user: User,
    @Query('provider') provider: string,
    @Query('scope') scope: string,
  ) {
    try {
      const requiredScope = scope ? scope.split(',') : [];
      const hasAuth = await this.authService.checkToolOAuthStatus(
        user.uid,
        provider,
        requiredScope,
      );

      return buildSuccessResponse({ authorized: hasAuth });
    } catch (error) {
      this.logger.error('Check tool OAuth status failed:', error.stack);
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

      await this.authService.logout(user, res);

      this.logger.log(`Successfully logged out user: ${user.uid}`);
      return res.status(200).json(buildSuccessResponse());
    } catch (error) {
      this.logger.error(`Logout failed for user ${user.uid}:`, error.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('accounts')
  async listAccounts(
    @LoginedUser() user: User,
    @Query('type') type: AuthType,
    @Query('provider') provider: string,
  ): Promise<ListAccountsResponse> {
    const accounts = await this.authService.listAccounts(user, { type, provider });
    return buildSuccessResponse(accounts.map(accountPO2DTO));
  }
}

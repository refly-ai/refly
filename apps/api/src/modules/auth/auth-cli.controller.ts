import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Query,
  Body,
  Param,
  Logger,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { ApiKeyService } from './api-key.service';
import {
  DeviceAuthService,
  DeviceSessionInfo,
  DeviceSessionWithTokens,
} from './device-auth.service';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User } from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { OAuthError } from '@refly/errors';
import { Profile } from 'passport';

/**
 * CLI-specific OAuth authentication controller
 * Handles OAuth flow for CLI clients using local callback server
 * Also handles API Key management for CLI authentication
 */
@Controller('v1/auth/cli')
export class AuthCliController {
  private readonly logger = new Logger(AuthCliController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly apiKeyService: ApiKeyService,
    private readonly deviceAuthService: DeviceAuthService,
  ) {}

  /**
   * Initialize OAuth flow for CLI
   * GET /v1/auth/cli/oauth/init
   *
   * @param provider OAuth provider (google or github)
   * @param port Local callback server port
   * @returns OAuth authorization URL and encrypted state token
   */
  @Get('oauth/init')
  async initOAuth(
    @Query('provider') provider: string,
    @Query('port') port: string,
  ): Promise<{ success: boolean; data: { authUrl: string; state: string } }> {
    this.logger.log(`[CLI_OAUTH_INIT] provider=${provider}, port=${port}`);

    if (!provider || !port) {
      throw new BadRequestException('Provider and port are required');
    }

    if (!['google', 'github'].includes(provider)) {
      throw new BadRequestException('Provider must be google or github');
    }

    try {
      // Generate encrypted state token with port, timestamp, and nonce
      const state = await this.authService.generateOAuthStateToken(port);

      // Build redirect URL to localhost callback server
      const redirectUri = `http://localhost:${port}/callback`;

      // Generate OAuth URL based on provider
      let authUrl: string;

      if (provider === 'google') {
        authUrl = await this.generateGoogleCliOAuthUrl(redirectUri, state);
      } else if (provider === 'github') {
        authUrl = await this.generateGithubCliOAuthUrl(redirectUri, state);
      } else {
        throw new BadRequestException('Unsupported provider');
      }

      return buildSuccessResponse({
        authUrl,
        state,
      });
    } catch (error) {
      this.logger.error(`[CLI_OAUTH_INIT] Failed: ${error.message}`, error.stack);
      throw new OAuthError();
    }
  }

  /**
   * Handle OAuth callback from CLI
   * POST /v1/auth/cli/oauth/callback
   *
   * @param body Contains authorization code, state, and provider
   * @returns JWT access token, refresh token, and user info
   */
  @Post('oauth/callback')
  async handleCallback(@Body() body: { code: string; state: string; provider: string }): Promise<{
    success: boolean;
    data: { accessToken: string; refreshToken: string; user: User };
  }> {
    const { code, state, provider } = body;

    this.logger.log(`[CLI_OAUTH_CALLBACK] provider=${provider}`);

    if (!code || !state || !provider) {
      throw new BadRequestException('Code, state, and provider are required');
    }

    try {
      // Validate state token (includes CSRF protection)
      const { port } = await this.authService.validateOAuthStateToken(state);
      this.logger.log(`[CLI_OAUTH_CALLBACK] State validated: port=${port}`);

      // Build redirect URI that was used for this OAuth flow
      const redirectUri = `http://localhost:${port}/callback`;

      // Exchange authorization code for tokens based on provider
      let oauthTokens: { accessToken: string; refreshToken?: string };
      let profile: Profile;

      if (provider === 'google') {
        const result = await this.exchangeGoogleCode(code, redirectUri);
        oauthTokens = result.tokens;
        profile = result.profile;
      } else if (provider === 'github') {
        const result = await this.exchangeGithubCode(code, redirectUri);
        oauthTokens = result.tokens;
        profile = result.profile;
      } else {
        throw new BadRequestException('Unsupported provider');
      }

      // Use existing oauthValidate to create/update user and account
      const user = await this.authService.oauthValidate(
        oauthTokens.accessToken,
        oauthTokens.refreshToken,
        profile,
        ['profile', 'email'], // Basic scopes for CLI login
      );

      // Generate JWT tokens for CLI
      const tokens = await this.authService.login(user);

      return buildSuccessResponse({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          uid: user.uid,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      this.logger.error(`[CLI_OAUTH_CALLBACK] Failed: ${error.message}`, error.stack);
      throw new OAuthError();
    }
  }

  /**
   * Exchange Google authorization code for tokens and user profile
   * @private
   */
  private async exchangeGoogleCode(
    code: string,
    redirectUri: string,
  ): Promise<{ tokens: { accessToken: string; refreshToken?: string }; profile: Profile }> {
    const clientId = this.configService.get('auth.google.clientId');
    const clientSecret = this.configService.get('auth.google.clientSecret');

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      this.logger.error(`[GOOGLE_TOKEN_EXCHANGE] Failed: ${errorText}`);
      throw new Error('Failed to exchange Google authorization code');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // Get user profile
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch Google user profile');
    }

    const profileData = await profileResponse.json();

    // Convert to Passport-compatible Profile format
    const profile: Profile = {
      provider: 'google',
      id: profileData.id,
      displayName: profileData.name || '',
      emails: profileData.email ? [{ value: profileData.email }] : [],
      photos: profileData.picture ? [{ value: profileData.picture }] : [],
    };

    return {
      tokens: { accessToken, refreshToken },
      profile,
    };
  }

  /**
   * Exchange GitHub authorization code for tokens and user profile
   * @private
   */
  private async exchangeGithubCode(
    code: string,
    redirectUri: string,
  ): Promise<{ tokens: { accessToken: string; refreshToken?: string }; profile: Profile }> {
    const clientId = this.configService.get('auth.github.clientId');
    const clientSecret = this.configService.get('auth.github.clientSecret');

    // Exchange code for tokens
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      this.logger.error(`[GITHUB_TOKEN_EXCHANGE] Failed: ${errorText}`);
      throw new Error('Failed to exchange GitHub authorization code');
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      this.logger.error(`[GITHUB_TOKEN_EXCHANGE] Error: ${tokenData.error_description}`);
      throw new Error(tokenData.error_description || 'GitHub OAuth error');
    }

    const accessToken = tokenData.access_token;

    // Get user profile
    const profileResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Refly-CLI',
      },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch GitHub user profile');
    }

    const profileData = await profileResponse.json();

    // Get user emails (may need separate request for private emails)
    let emails: { value: string }[] = [];
    if (profileData.email) {
      emails = [{ value: profileData.email }];
    } else {
      // Fetch emails separately if not in profile
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Refly-CLI',
        },
      });

      if (emailsResponse.ok) {
        const emailsData = await emailsResponse.json();
        const primaryEmail = emailsData.find((e: { primary: boolean }) => e.primary);
        if (primaryEmail) {
          emails = [{ value: primaryEmail.email }];
        } else if (emailsData.length > 0) {
          emails = [{ value: emailsData[0].email }];
        }
      }
    }

    // Convert to Passport-compatible Profile format
    const profile: Profile = {
      provider: 'github',
      id: String(profileData.id),
      displayName: profileData.name || profileData.login || '',
      emails,
      photos: profileData.avatar_url ? [{ value: profileData.avatar_url }] : [],
    };

    return {
      tokens: { accessToken, refreshToken: undefined }, // GitHub doesn't provide refresh tokens by default
      profile,
    };
  }

  /**
   * Refresh access token using refresh token
   * POST /v1/auth/cli/oauth/refresh
   *
   * @param body Contains refresh token
   * @returns New access token and refresh token
   */
  @Post('oauth/refresh')
  async refreshToken(
    @Body() body: { refreshToken: string },
  ): Promise<{ success: boolean; data: { accessToken: string; refreshToken: string } }> {
    const { refreshToken } = body;

    this.logger.log('[CLI_OAUTH_REFRESH]');

    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    try {
      const tokens = await this.authService.refreshAccessToken(refreshToken);

      return buildSuccessResponse({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      this.logger.error(`[CLI_OAUTH_REFRESH] Failed: ${error.message}`, error.stack);
      throw new OAuthError();
    }
  }

  /**
   * Revoke all refresh tokens for current user (logout)
   * POST /v1/auth/cli/oauth/revoke
   *
   * @param user Current authenticated user
   * @returns Success response
   */
  @UseGuards(JwtAuthGuard)
  @Post('oauth/revoke')
  async revoke(@LoginedUser() user: User): Promise<{ success: boolean }> {
    this.logger.log(`[CLI_OAUTH_REVOKE] uid=${user.uid}`);

    try {
      await this.authService.revokeAllRefreshTokens(user.uid);

      return buildSuccessResponse(null);
    } catch (error) {
      this.logger.error(`[CLI_OAUTH_REVOKE] Failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate Google OAuth URL for CLI flow
   * @private
   */
  private async generateGoogleCliOAuthUrl(redirectUri: string, state: string): Promise<string> {
    const clientId = this.configService.get('auth.google.clientId');
    const scope = ['profile', 'email'].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state,
      access_type: 'offline',
      prompt: 'consent', // Always show consent screen for CLI to get refresh token
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Generate GitHub OAuth URL for CLI flow
   * @private
   */
  private async generateGithubCliOAuthUrl(redirectUri: string, state: string): Promise<string> {
    const clientId = this.configService.get('auth.github.clientId');
    const scope = ['user:email'].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  // ============================================
  // API Key Management Endpoints
  // ============================================

  /**
   * Create a new API key for CLI authentication
   * POST /v1/auth/cli/api-key
   *
   * @param user Current authenticated user
   * @param body Contains key name and optional expiration
   * @returns Created API key (only shown once)
   */
  @UseGuards(JwtAuthGuard)
  @Post('api-key')
  async createApiKey(
    @LoginedUser() user: User,
    @Body() body: { name: string; expiresInDays?: number },
  ): Promise<{
    success: boolean;
    data: {
      keyId: string;
      apiKey: string;
      name: string;
      keyPrefix: string;
      createdAt: Date;
      expiresAt: Date | null;
    };
  }> {
    const { name, expiresInDays } = body;

    this.logger.log(`[API_KEY_CREATE] uid=${user.uid} name=${name}`);

    if (!name || name.trim().length === 0) {
      throw new BadRequestException('API key name is required');
    }

    if (name.length > 100) {
      throw new BadRequestException('API key name must be 100 characters or less');
    }

    const result = await this.apiKeyService.createApiKey(user.uid, name.trim(), expiresInDays);

    return buildSuccessResponse(result);
  }

  /**
   * List all API keys for current user
   * GET /v1/auth/cli/api-key
   *
   * @param user Current authenticated user
   * @returns List of API keys (without actual key values)
   */
  @UseGuards(JwtAuthGuard)
  @Get('api-key')
  async listApiKeys(@LoginedUser() user: User): Promise<{
    success: boolean;
    data: Array<{
      keyId: string;
      name: string;
      keyPrefix: string;
      createdAt: Date;
      lastUsedAt: Date | null;
      expiresAt: Date | null;
    }>;
  }> {
    this.logger.log(`[API_KEY_LIST] uid=${user.uid}`);

    const keys = await this.apiKeyService.listApiKeys(user.uid);

    return buildSuccessResponse(keys);
  }

  /**
   * Revoke a specific API key
   * DELETE /v1/auth/cli/api-key/:keyId
   *
   * @param user Current authenticated user
   * @param keyId API key ID to revoke
   * @returns Success response
   */
  @UseGuards(JwtAuthGuard)
  @Delete('api-key/:keyId')
  async revokeApiKey(
    @LoginedUser() user: User,
    @Param('keyId') keyId: string,
  ): Promise<{ success: boolean }> {
    this.logger.log(`[API_KEY_REVOKE] uid=${user.uid} keyId=${keyId}`);

    const revoked = await this.apiKeyService.revokeApiKey(user.uid, keyId);

    if (!revoked) {
      throw new NotFoundException('API key not found or already revoked');
    }

    return buildSuccessResponse(null);
  }

  /**
   * Update API key name
   * PATCH /v1/auth/cli/api-key/:keyId
   *
   * @param user Current authenticated user
   * @param keyId API key ID to update
   * @param body Contains the new name
   * @returns Success response
   */
  @UseGuards(JwtAuthGuard)
  @Patch('api-key/:keyId')
  async updateApiKey(
    @LoginedUser() user: User,
    @Param('keyId') keyId: string,
    @Body() body: { name: string },
  ): Promise<{ success: boolean }> {
    this.logger.log(`[API_KEY_UPDATE] uid=${user.uid} keyId=${keyId}`);

    const { name } = body;

    if (!name) {
      throw new BadRequestException('Name is required');
    }

    const updated = await this.apiKeyService.updateApiKey(user.uid, keyId, name);

    if (!updated) {
      throw new NotFoundException('API key not found');
    }

    return buildSuccessResponse(null);
  }

  /**
   * Validate an API key and return user info
   * POST /v1/auth/cli/api-key/validate
   *
   * This endpoint does NOT require authentication - it validates the API key itself
   *
   * @param body Contains the API key to validate
   * @returns User info if valid
   */
  @Post('api-key/validate')
  async validateApiKey(@Body() body: { apiKey: string }): Promise<{
    success: boolean;
    data: { valid: boolean; user?: { uid: string; email?: string; name?: string } };
  }> {
    const { apiKey } = body;

    if (!apiKey) {
      throw new BadRequestException('API key is required');
    }

    const uid = await this.apiKeyService.validateApiKey(apiKey);

    if (!uid) {
      return buildSuccessResponse({ valid: false });
    }

    // Get user info - we need to import PrismaService for this
    // For now, just return the uid
    return buildSuccessResponse({
      valid: true,
      user: { uid },
    });
  }

  // ============================================
  // Device Authorization Endpoints
  // ============================================

  /**
   * Initialize a device authorization session
   * POST /v1/auth/cli/device/init
   *
   * Called by CLI to start the device authorization flow
   *
   * @param body Contains cliVersion and host
   * @returns Device session info with deviceId for polling
   */
  @Post('device/init')
  async initDeviceSession(
    @Body() body: { cliVersion: string; host: string },
  ): Promise<{ success: boolean; data: DeviceSessionInfo }> {
    const { cliVersion, host } = body;

    this.logger.log(`[DEVICE_INIT] cliVersion=${cliVersion} host=${host}`);

    if (!cliVersion || !host) {
      throw new BadRequestException('cliVersion and host are required');
    }

    const session = await this.deviceAuthService.initDeviceSession(cliVersion, host);

    return buildSuccessResponse(session);
  }

  /**
   * Get device session info for web page display
   * GET /v1/auth/cli/device/init
   *
   * Called by web frontend to show device info
   *
   * @param deviceId Device session ID
   * @param cliVersion Optional CLI version for display
   * @param host Optional host for display
   * @returns Device session info
   */
  @Get('device/init')
  async getDeviceSession(
    @Query('device_id') deviceId: string,
    @Query('cli_version') cliVersion?: string,
    @Query('host') host?: string,
  ): Promise<{ success: boolean; data: DeviceSessionInfo | null }> {
    this.logger.log(`[DEVICE_GET] deviceId=${deviceId}`);

    if (!deviceId) {
      throw new BadRequestException('device_id is required');
    }

    const session = await this.deviceAuthService.getDeviceSession(deviceId, cliVersion, host);

    if (!session) {
      throw new NotFoundException('Device session not found');
    }

    return buildSuccessResponse(session);
  }

  /**
   * Authorize a device session
   * POST /v1/auth/cli/device/authorize
   *
   * Called by web frontend when user clicks "Authorize"
   * Requires authentication
   *
   * @param user Current authenticated user
   * @param body Contains device_id
   * @returns Success response
   */
  @UseGuards(JwtAuthGuard)
  @Post('device/authorize')
  async authorizeDevice(
    @LoginedUser() user: User,
    @Body() body: { device_id: string; user_code: string },
  ): Promise<{ success: boolean; errCode?: string }> {
    const { device_id: deviceId, user_code: userCode } = body;

    this.logger.log(`[DEVICE_AUTHORIZE] uid=${user.uid} deviceId=${deviceId}`);

    if (!deviceId || !userCode) {
      throw new BadRequestException('device_id and user_code are required');
    }

    const session = await this.deviceAuthService.getDeviceSession(deviceId);
    if (!session) {
      throw new NotFoundException('Device session not found');
    }

    if (session.status !== 'pending') {
      throw new BadRequestException('Device session is already processed or expired');
    }

    const authorized = await this.deviceAuthService.authorizeDevice(deviceId, userCode, user);

    if (!authorized) {
      return {
        success: false,
        errCode: 'invalid_verification_code',
      };
    }

    return buildSuccessResponse(null);
  }

  /**
   * Cancel a device authorization session
   * POST /v1/auth/cli/device/cancel
   *
   * Called by web frontend when user clicks "Cancel"
   * Does not require authentication (allows cancellation even if not logged in)
   *
   * @param body Contains device_id
   * @returns Success response
   */
  @Post('device/cancel')
  async cancelDevice(@Body() body: { device_id: string }): Promise<{ success: boolean }> {
    const { device_id: deviceId } = body;

    this.logger.log(`[DEVICE_CANCEL] deviceId=${deviceId}`);

    if (!deviceId) {
      throw new BadRequestException('device_id is required');
    }

    const cancelled = await this.deviceAuthService.cancelDevice(deviceId);

    if (!cancelled) {
      throw new BadRequestException(
        'Failed to cancel device session. Session may be expired or already processed.',
      );
    }

    return buildSuccessResponse(null);
  }

  /**
   * Poll device session status
   * GET /v1/auth/cli/device/status
   *
   * Called by CLI to check if user has authorized
   *
   * @param deviceId Device session ID
   * @returns Device session info with tokens if authorized
   */
  @Get('device/status')
  async pollDeviceStatus(
    @Query('device_id') deviceId: string,
  ): Promise<{ success: boolean; data: DeviceSessionWithTokens | null }> {
    if (!deviceId) {
      throw new BadRequestException('device_id is required');
    }

    const session = await this.deviceAuthService.pollDeviceStatus(deviceId);

    if (!session) {
      throw new NotFoundException('Device session not found');
    }

    return buildSuccessResponse(session);
  }
}

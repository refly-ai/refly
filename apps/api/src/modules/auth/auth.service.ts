import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import ms from 'ms';
import { Profile } from 'passport';
import { CookieOptions, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User as UserModel, VerificationSession, Account as AccountModel } from '@prisma/client';
import { TokenData } from './auth.dto';
import {
  ACCESS_TOKEN_COOKIE,
  EMAIL_COOKIE,
  genUID,
  genVerificationSessionID,
  omit,
  pick,
  REFRESH_TOKEN_COOKIE,
  safeParseJSON,
  UID_COOKIE,
} from '@refly/utils';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';
import {
  User,
  AuthConfigItem,
  CheckVerificationRequest,
  CreateVerificationRequest,
  ListAccountsData,
} from '@refly/openapi-schema';
import {
  AccountNotFoundError,
  EmailAlreadyRegistered,
  IncorrectVerificationCode,
  InvalidVerificationSession,
  OAuthError,
  ParamsError,
  PasswordIncorrect,
} from '@refly/errors';
import { logEvent } from '@refly/telemetry-node';
import { NotificationService } from '../notification/notification.service';
import { CreditService } from '../credit/credit.service';

@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private jwtService: JwtService,
    private miscService: MiscService,
    private notificationService: NotificationService,
    private creditService: CreditService,
  ) {}

  private getUserPreferences(): string {
    const requireInvitationCode =
      this.configService.get('auth.invitation.requireInvitationCode') ?? false;
    return JSON.stringify({
      requireInvitationCode,
      hasBeenInvited: false,
    });
  }

  getAuthConfig(): AuthConfigItem[] {
    const items: AuthConfigItem[] = [];
    if (this.configService.get('auth.email.enabled')) {
      items.push({ provider: 'email' });
    }
    if (this.configService.get('auth.google.enabled')) {
      items.push({ provider: 'google' });
    }
    if (this.configService.get('auth.github.enabled')) {
      items.push({ provider: 'github' });
    }
    if (this.configService.get('auth.invitation.requireInvitationCode')) {
      items.push({ provider: 'invitation' });
    }
    return items;
  }

  async login(user: User): Promise<TokenData> {
    const payload: User = pick(user, ['uid', 'email']);
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('auth.jwt.secret'),
      expiresIn: this.configService.get('auth.jwt.expiresIn'),
    });

    // Generate refresh token
    const refreshToken = await this.generateRefreshToken(user.uid);

    return {
      uid: user.uid,
      email: user.email,
      accessToken,
      refreshToken,
    };
  }

  async listAccounts(user: User, params: ListAccountsData['query']): Promise<AccountModel[]> {
    const { type, provider } = params;
    const accounts = await this.prisma.account.findMany({
      where: { uid: user.uid, type, provider },
    });
    return accounts;
  }

  private async generateRefreshToken(uid: string): Promise<string> {
    const jti = randomBytes(32).toString('hex');
    const token = randomBytes(64).toString('hex');
    const hashedToken = await argon2.hash(token);

    // Store the hashed refresh token
    await this.prisma.refreshToken.create({
      data: {
        jti,
        uid,
        hashedToken,
        expiresAt: new Date(Date.now() + ms(this.configService.get('auth.jwt.refreshExpiresIn'))),
      },
    });

    return `${jti}.${token}`;
  }

  async refreshAccessToken(refreshToken: string) {
    const [jti, token] = refreshToken.split('.');

    if (!jti || !token) {
      throw new UnauthorizedException();
    }

    // Find the refresh token in the database
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { jti },
    });

    if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException();
    }

    // Verify the token
    const isValid = await argon2.verify(storedToken.hashedToken, token);
    if (!isValid) {
      throw new UnauthorizedException();
    }

    // Revoke the current refresh token (one-time use)
    await this.prisma.refreshToken.update({
      where: { jti },
      data: { revoked: true },
    });

    // Get the user
    const user = await this.prisma.user.findUnique({
      where: { uid: storedToken.uid },
    });

    if (!user) {
      throw new AccountNotFoundError();
    }

    // Generate new tokens
    return this.login(user);
  }

  async revokeAllRefreshTokens(uid: string) {
    await this.prisma.refreshToken.updateMany({
      where: { uid },
      data: { revoked: true },
    });
  }

  async logout(user: User, res: Response) {
    await this.revokeAllRefreshTokens(user.uid);

    this.clearAuthCookie(res);

    logEvent(user, 'logout_success', null);
  }

  cookieOptions(key: string): CookieOptions {
    const baseOptions: CookieOptions = {
      domain: this.configService.get('auth.cookie.domain'),
      secure: Boolean(this.configService.get('auth.cookie.secure')),
      sameSite: this.configService.get('auth.cookie.sameSite'),
      path: '/',
    };

    switch (key) {
      case UID_COOKIE:
        return {
          ...baseOptions,
          expires: new Date(Date.now() + ms(this.configService.get('auth.jwt.refreshExpiresIn'))),
        };
      case EMAIL_COOKIE:
        return {
          ...baseOptions,
          expires: new Date(Date.now() + ms(this.configService.get('auth.jwt.refreshExpiresIn'))),
        };
      case ACCESS_TOKEN_COOKIE:
        return {
          ...baseOptions,
          httpOnly: true,
          expires: new Date(Date.now() + ms(this.configService.get('auth.jwt.expiresIn'))),
        };
      case REFRESH_TOKEN_COOKIE:
        return {
          ...baseOptions,
          httpOnly: true,
          expires: new Date(Date.now() + ms(this.configService.get('auth.jwt.refreshExpiresIn'))),
        };
      default:
        return baseOptions;
    }
  }

  setAuthCookie(res: Response, { uid, email, accessToken, refreshToken }: TokenData) {
    return res
      .cookie(UID_COOKIE, uid, this.cookieOptions(UID_COOKIE))
      .cookie(EMAIL_COOKIE, email, this.cookieOptions(EMAIL_COOKIE))
      .cookie(ACCESS_TOKEN_COOKIE, accessToken, this.cookieOptions(ACCESS_TOKEN_COOKIE))
      .cookie(REFRESH_TOKEN_COOKIE, refreshToken, this.cookieOptions(REFRESH_TOKEN_COOKIE));
  }

  clearAuthCookie(res: Response) {
    const clearOptions = omit(this.cookieOptions(UID_COOKIE), ['expires']);

    return res
      .clearCookie(UID_COOKIE, clearOptions)
      .clearCookie(ACCESS_TOKEN_COOKIE, clearOptions)
      .clearCookie(REFRESH_TOKEN_COOKIE, clearOptions);
  }

  async genUniqueUsername(candidate: string) {
    let name = candidate;
    let userExists = await this.prisma.user.findUnique({ where: { name } });
    while (userExists) {
      const randomSuffix = randomBytes(3).toString('hex');
      name = `${candidate}_${randomSuffix}`;
      userExists = await this.prisma.user.findUnique({ where: { name } });
    }
    return name;
  }

  async parseOAuthState(state: string) {
    this.logger.log(`parseOAuthState: ${state}`);

    // Parse state safely once
    const defaultRedirect = this.configService.get('auth.redirectUrl');
    let parsedState: { uid?: string; redirect?: string } | null = null;
    try {
      parsedState = state ? safeParseJSON(state) : null;
    } catch {
      this.logger.warn('Invalid state JSON received in Google OAuth callback');
    }
    // Build a safe redirect URL (allowlist by origin; fall back to default)
    const requested = parsedState?.redirect;
    let finalRedirect = defaultRedirect;
    try {
      if (typeof requested === 'string') {
        const allowed = this.configService.get<string[]>('auth.allowedRedirectOrigins') ?? [
          new URL(defaultRedirect).origin,
        ];
        const u = new URL(requested, defaultRedirect);
        if (allowed.includes(u.origin)) {
          finalRedirect = u.toString();
        }
      }
    } catch {
      // ignore and use default
    }

    return { parsedState, finalRedirect };
  }

  /**
   * General OAuth logic
   * @param accessToken
   * @param refreshToken
   * @param profile
   */
  async oauthValidate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    scopes: string[],
    uid?: string,
  ) {
    const { provider, id, emails, displayName, photos } = profile;

    this.logger.log(
      `oauth provider=${provider}, accountId=${id},uid=${uid},email=${emails}, scopes=${JSON.stringify(scopes)}`,
    );

    // Check if there is an authentication account record
    const account = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: id,
        },
      },
    });

    // If there is an authentication account record and corresponding user, return directly
    if (account) {
      this.logger.log(`account found for provider ${provider}, account id: ${id}`);

      // Check if account belongs to different user
      if (uid && account.uid !== uid) {
        this.logger.error(
          `OAuth account conflict: account uid ${account.uid} != provided uid ${uid}`,
        );
        throw new Error('You have already authorized on another account');
      }

      try {
        // Merge existing scopes with new scopes to avoid overwriting
        const existingScopes = account.scope ? safeParseJSON(account.scope) : [];
        const mergedScopes = [...new Set([...existingScopes, ...scopes])];

        // Prepare update data
        const updateData: any = {
          accessToken: accessToken,
          scope: JSON.stringify(mergedScopes),
        };

        // Only update refreshToken if it's not undefined (to preserve existing valid refresh token)
        if (refreshToken !== undefined) {
          updateData.refreshToken = refreshToken;
        }

        await this.prisma.account.update({
          where: { pk: account.pk },
          data: updateData,
        });
        this.logger.log(
          `Successfully updated account ${account.pk} with merged scopes: ${JSON.stringify(mergedScopes)}`,
        );
      } catch (error) {
        this.logger.error(`Failed to update account ${account.pk}:`, error);
        throw error;
      }
      const user = await this.prisma.user.findUnique({
        where: {
          uid: account.uid,
        },
      });
      if (user) {
        return user;
      }

      this.logger.log(`user ${account.uid} not found for provider ${provider} account id: ${id}`);
    }

    let email = '';
    // oauth profile returns no email, this is invalid
    if (emails?.length === 0) {
      this.logger.warn('emails is empty, invalid oauth');
      //throw new OAuthError();
    } else if (emails?.length > 0) {
      email = emails[0].value;
    }

    // Determine the uid to use
    let targetUid = uid;

    // If no uid provided, check if email is registered or create new user
    if (!targetUid) {
      // Return user if this email has been registered
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (user) {
        await this.prisma.account.upsert({
          where: {
            provider_providerAccountId: { provider, providerAccountId: id },
          },
          update: {
            accessToken,
            ...(refreshToken !== undefined ? { refreshToken } : {}),
            scope: JSON.stringify(scopes),
          },
          create: {
            type: 'oauth',
            uid: user.uid,
            provider,
            providerAccountId: id,
            accessToken,
            refreshToken,
            scope: JSON.stringify(scopes),
          },
        });
        this.logger.log(`user ${user.uid} already registered for email ${email}`);
        logEvent(user, 'login_success', provider);
        return user;
      }

      targetUid = genUID();
      const name = await this.genUniqueUsername(email.split('@')[0]);

      // download avatar if profile photo exists
      let avatar: string;
      try {
        if (photos?.length > 0) {
          avatar = (
            await this.miscService.dumpFileFromURL(
              { uid: targetUid },
              {
                url: photos[0].value,
                entityId: targetUid,
                entityType: 'user',
                visibility: 'public',
              },
            )
          ).url;
        }
      } catch (e) {
        this.logger.warn(`failed to download avatar: ${e}`);
      }

      const newUser = await this.prisma.user.create({
        data: {
          name,
          nickname: displayName || name,
          uid: targetUid,
          email,
          avatar,
          emailVerified: new Date(),
          outputLocale: 'auto',
          preferences: this.getUserPreferences(),
        },
      });
      await this.postCreateUser(newUser);
      this.logger.log(`user created: ${newUser.uid}`);
    }

    try {
      await this.prisma.account.create({
        data: {
          type: 'oauth',
          uid: targetUid,
          provider,
          providerAccountId: id,
          accessToken: accessToken,
          refreshToken: refreshToken,
          scope: JSON.stringify(scopes), // Default scope for login
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create account for ${targetUid}:`, error);
      throw error;
    }

    // Get the user for logging and return
    const finalUser = await this.prisma.user.findUnique({
      where: { uid: targetUid },
    });

    if (finalUser) {
      logEvent(finalUser, 'signup_success', provider);
      return finalUser;
    }

    throw new Error('Failed to find created user');
  }

  async emailSignup(
    email: string,
    password: string,
  ): Promise<{ tokenData?: TokenData; sessionId?: string }> {
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new EmailAlreadyRegistered();
    }

    const skipVerification = this.configService.get('auth.skipVerification');
    if (skipVerification) {
      const uid = genUID();
      const name = await this.genUniqueUsername(email.split('@')[0]);
      const hashedPassword = await argon2.hash(password);

      const [newUser] = await this.prisma.$transaction([
        this.prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            uid,
            name,
            nickname: name,
            emailVerified: new Date(),
            outputLocale: 'auto',
            preferences: this.getUserPreferences(),
          },
        }),
        this.prisma.account.create({
          data: {
            type: 'email',
            uid,
            provider: 'email',
            providerAccountId: email,
          },
        }),
      ]);
      await this.postCreateUser(newUser);

      return { tokenData: await this.login(newUser) };
    }

    const { sessionId } = await this.createVerification({ email, purpose: 'signup', password });
    return { sessionId };
  }

  private async postCreateUser(user: User) {
    await this.creditService.createRegistrationCreditRecharge(user.uid);
  }

  async emailLogin(email: string, password: string) {
    if (!email?.trim() || !password?.trim()) {
      throw new ParamsError('Email and password are required');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AccountNotFoundError();
    }

    try {
      const isPasswordValid = await argon2.verify(user.password, password);
      if (!isPasswordValid) {
        throw new PasswordIncorrect();
      }
    } catch (error) {
      this.logger.error(`Password verification failed: ${error.message}`);
      logEvent(user, 'login_failed', 'email', { reason: 'password_incorrect' });

      throw new PasswordIncorrect();
    }

    logEvent(user, 'login_success', 'email');

    return this.login(user);
  }

  async createVerification({ email, purpose, password }: CreateVerificationRequest) {
    const sessionId = genVerificationSessionID();

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    if (purpose === 'resetPassword' && !password) {
      throw new ParamsError('Password is required to reset password');
    }

    let hashedPassword: string;
    if (password) {
      hashedPassword = await argon2.hash(password);
    }

    const session = await this.prisma.verificationSession.create({
      data: {
        email,
        code,
        purpose,
        sessionId,
        hashedPassword,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Send verification email using notification service
    await this.sendVerificationEmail(sessionId, session);

    return session;
  }

  async sendVerificationEmail(sessionId: string, session?: VerificationSession) {
    const sessionToSend =
      session ??
      (await this.prisma.verificationSession.findUnique({
        where: { sessionId },
      }));

    await this.notificationService.sendEmail({
      to: sessionToSend.email,
      subject: 'Email Verification Code',
      html: `Your verification code is: ${sessionToSend.code}`,
    });
  }

  async checkVerification({ sessionId, code }: CheckVerificationRequest) {
    const verification = await this.prisma.verificationSession.findUnique({
      where: { sessionId, expiresAt: { gt: new Date() } },
    });

    if (!verification) {
      throw new InvalidVerificationSession();
    }

    if (verification.code !== code) {
      throw new IncorrectVerificationCode();
    }

    const { purpose, email, hashedPassword } = verification;

    let user: UserModel;
    if (purpose === 'signup') {
      const uid = genUID();
      const name = await this.genUniqueUsername(email.split('@')[0]);
      const [newUser] = await this.prisma.$transaction([
        this.prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            uid,
            name,
            nickname: name,
            emailVerified: new Date(),
            outputLocale: 'auto',
            preferences: this.getUserPreferences(),
          },
        }),
        this.prisma.account.create({
          data: {
            type: 'email',
            uid,
            provider: 'email',
            providerAccountId: email,
          },
        }),
      ]);
      user = newUser;
      await this.postCreateUser(user);

      logEvent(user, 'signup_success', 'email');
    } else if (purpose === 'resetPassword') {
      user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new AccountNotFoundError();
      }
      await this.prisma.user.update({
        where: { email },
        data: { password: hashedPassword },
      });

      logEvent(user, 'reset_password_success');
    } else {
      throw new ParamsError(`Invalid verification purpose: ${purpose}`);
    }

    return this.login(user);
  }

  /**
   * Tool OAuth validation - handles OAuth for tools with specific scopes
   * @param accessToken
   * @param refreshToken
   * @param profile
   */
  async toolOAuthValidate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    scopes: string[],
  ) {
    const { provider, id, emails } = profile;

    this.logger.log(`tool oauth provider=${provider}, accountId=${id}`);

    // Check if there is an authentication account record
    const account = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: id,
        },
      },
    });

    // If there is an authentication account record and corresponding user, update tokens and scope
    if (account) {
      this.logger.log(`account found for provider ${provider}, account id: ${id}`);

      // Update tokens and scope for tool OAuth
      await this.prisma.account.update({
        where: { pk: account.pk },
        data: {
          accessToken: accessToken,
          refreshToken: refreshToken, // 1 hour
          scope: JSON.stringify(scopes), // Tool scope
        },
      });

      const user = await this.prisma.user.findUnique({
        where: {
          uid: account.uid,
        },
      });
      if (user) {
        return user;
      }

      this.logger.log(`user ${account.uid} not found for provider ${provider} account id: ${id}`);
    }

    // For tool OAuth, we expect the user to already exist
    // oauth profile returns no email, this is invalid
    if (emails?.length === 0) {
      this.logger.warn('emails is empty, invalid oauth');
      throw new OAuthError();
    }
    const email = emails[0].value;

    // Return user if this email has been registered
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      this.logger.log(`user ${user.uid} already registered for email ${email}`);

      // Create or update account record for tool OAuth
      const existingAccount = await this.prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId: id,
          },
        },
      });

      if (existingAccount) {
        // Update existing account with new tokens and scope
        await this.prisma.account.update({
          where: { pk: existingAccount.pk },
          data: {
            accessToken: accessToken,
            refreshToken: refreshToken,
            scope: JSON.stringify(scopes),
          },
        });
      } else {
        // Create new account record
        await this.prisma.account.create({
          data: {
            type: 'oauth',
            uid: user.uid,
            provider,
            providerAccountId: id,
            accessToken: accessToken,
            refreshToken: refreshToken,
            scope: JSON.stringify(scopes),
          },
        });
      }

      return user;
    }

    // For tool OAuth, user must already exist
    throw new OAuthError('User not found for tool OAuth');
  }

  /**
   * Check if user has sufficient OAuth scope for tool
   * @param uid User ID
   * @param provider OAuth provider
   * @param requiredScope Required scope array
   */
  async checkToolOAuthStatus(
    uid: string,
    provider: string,
    requiredScope: string[],
  ): Promise<boolean> {
    try {
      const account = await this.prisma.account.findFirst({
        where: {
          uid,
          provider,
        },
      });

      if (!account || !account.scope) {
        return false;
      }

      const existingScope = safeParseJSON(account.scope);
      const hasRequiredScope = requiredScope.every((scope) => existingScope.includes(scope));

      return hasRequiredScope;
    } catch (error) {
      this.logger.error(`Error checking tool OAuth status for user ${uid}:`, error);
      return false;
    }
  }

  /**
   * Generate OAuth URL for tool authorization
   * @param provider OAuth provider
   * @param scope Required scope array
   * @param redirectUrl Redirect URL after authorization
   */
  async generateGoogleOAuthUrl(scope: string, redirect: string, uid: string): Promise<string> {
    this.logger.log(`generateGoogleOAuthUrl, scope: ${scope}, redirect: ${redirect}, uid: ${uid}`);

    const baseScope = ['profile', 'email'];
    const scopeArray = scope?.split(',') ?? [];
    const finalScope = [...baseScope, ...scopeArray];
    this.logger.log(`finalScope: ${finalScope}`);

    // Check if user-specified scope contains elements not found in baseScope
    const hasAdditionalScopes = scopeArray.some((s) => !baseScope.includes(s.trim()));

    // Use tool oauth client id if additional scopes are requested
    const clientId = hasAdditionalScopes
      ? (this.configService.get('tools.google.clientId') ??
        this.configService.get('auth.google.clientId'))
      : this.configService.get('auth.google.clientId');

    const callbackUrl = hasAdditionalScopes
      ? (this.configService.get('tools.google.callbackUrl') ??
        this.configService.get('auth.google.callbackUrl'))
      : this.configService.get('auth.google.callbackUrl');

    // Check if user already has Google OAuth with refresh token
    let prompt = 'consent';
    if (uid) {
      try {
        const existingAccount = await this.prisma.account.findFirst({
          where: {
            uid: uid,
            provider: 'google',
            type: 'oauth',
          },
        });

        // If account exists and has a valid refresh token, don't force consent
        if (
          existingAccount?.refreshToken &&
          existingAccount.refreshToken !== undefined &&
          scopeArray.length === 0
        ) {
          prompt = 'none';
        }
      } catch (error) {
        this.logger.warn('Failed to check existing Google OAuth account:', error);
        // Default to consent on error
      }
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: finalScope.join(' '),
      response_type: 'code',
      access_type: 'offline',
      prompt,
      state: JSON.stringify({
        redirect: redirect ?? this.configService.get('auth.redirectUrl'),
        uid: uid,
      }),
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async generateNotionOAuthUrl(uid: string, redirect?: string): Promise<string> {
    const clientId = this.configService.get('auth.notion.clientId');
    const callbackUrl = this.configService.get('auth.notion.callbackUrl');

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      owner: 'user',
      redirect_uri: callbackUrl,
      state: JSON.stringify({
        redirect: redirect ?? this.configService.get('auth.redirectUrl'),
        uid: uid,
      }),
    });

    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  }

  async generateTwitterOAuthUrl(uid: string, redirect?: string): Promise<string> {
    const clientId = this.configService.get('auth.twitter.clientId');
    const callbackUrl = this.configService.get('auth.twitter.callbackUrl');

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      owner: 'user',
      redirect_uri: callbackUrl,
      state: JSON.stringify({
        redirect: redirect ?? this.configService.get('auth.redirectUrl'),
        uid: uid,
      }),
    });

    return `https://api.x.com/2/oauth2/authorize?${params.toString()}`;
  }
}

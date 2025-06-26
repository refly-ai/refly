import { Injectable, Logger, UnauthorizedException, Optional } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import ms from 'ms';
import { Profile } from 'passport';
import { CookieOptions, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User as UserModel, VerificationSession } from '../../generated/client';
import { TokenData } from './auth.dto';
import {
  ACCESS_TOKEN_COOKIE,
  genUID,
  genVerificationSessionID,
  omit,
  pick,
  REFRESH_TOKEN_COOKIE,
  UID_COOKIE,
} from '@refly/utils';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';
import { Resend } from 'resend';
import {
  User,
  AuthConfigItem,
  CheckVerificationRequest,
  CreateVerificationRequest,
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
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { QUEUE_SEND_VERIFICATION_EMAIL } from '../../utils/const';
import { ProviderService } from '../provider/provider.service';
import { isDesktop } from '../../utils/runtime';

@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name);
  private resend: Resend;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private jwtService: JwtService,
    private miscService: MiscService,
    private providerService: ProviderService,
    @Optional() @InjectQueue(QUEUE_SEND_VERIFICATION_EMAIL) private emailQueue?: Queue,
  ) {
    this.resend = new Resend(this.configService.get('auth.email.resendApiKey'));
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
      accessToken,
      refreshToken,
    };
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

  setAuthCookie(res: Response, { uid, accessToken, refreshToken }: TokenData) {
    return res
      .cookie(UID_COOKIE, uid, this.cookieOptions(UID_COOKIE))
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

  /**
   * General OAuth logic
   * @param accessToken
   * @param refreshToken
   * @param profile
   */
  async oauthValidate(accessToken: string, refreshToken: string, profile: Profile) {
    this.logger.log(
      `oauth accessToken: ${accessToken}, refreshToken: ${refreshToken}, profile: ${JSON.stringify(
        profile,
      )}`,
    );
    const { provider, id, emails, displayName, photos } = profile;

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
      return user;
    }

    const uid = genUID();
    const name = await this.genUniqueUsername(email.split('@')[0]);

    // download avatar if profile photo exists
    let avatar: string;
    try {
      if (photos?.length > 0) {
        avatar = (
          await this.miscService.dumpFileFromURL(
            { uid },
            {
              url: photos[0].value,
              entityId: uid,
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
        uid,
        email,
        avatar,
        emailVerified: new Date(),
        outputLocale: 'auto',
      },
    });
    await this.postCreateUser(newUser);
    this.logger.log(`user created: ${newUser.uid}`);

    const newAccount = await this.prisma.account.create({
      data: {
        type: 'oauth',
        uid: newUser.uid,
        provider,
        providerAccountId: id,
        accessToken: accessToken,
        refreshToken: refreshToken,
      },
    });
    this.logger.log(`new account created for ${newAccount.uid}`);

    return newUser;
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
    await this.providerService.prepareGlobalProviderItemsForUser(user);
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
      throw new PasswordIncorrect();
    }

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

    await this.addSendVerificationEmailJob(sessionId);

    return session;
  }

  async addSendVerificationEmailJob(sessionId: string) {
    if (this.emailQueue) {
      await this.emailQueue.add('verifyEmail', { sessionId });
    } else if (isDesktop()) {
      // In desktop mode, send email directly since queue is not available
      await this.sendVerificationEmail(sessionId);
    } else {
      this.logger.warn('Email queue not available and not in desktop mode');
    }
  }

  async sendVerificationEmail(sessionId: string, _session?: VerificationSession) {
    let session = _session;
    if (!session) {
      session = await this.prisma.verificationSession.findUnique({ where: { sessionId } });
    }
    await this.resend.emails.send({
      from: this.configService.get('auth.email.sender'),
      to: session.email,
      subject: 'Email Verification Code',
      html: `Your verification code is: ${session.code}`,
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
    } else if (purpose === 'resetPassword') {
      user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new AccountNotFoundError();
      }
      await this.prisma.user.update({
        where: { email },
        data: { password: hashedPassword },
      });
    } else {
      throw new ParamsError(`Invalid verification purpose: ${purpose}`);
    }

    return this.login(user);
  }
}

import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createMock } from '@golevelup/ts-jest';
import type { User as UserModel } from '@prisma/client';
import type { Profile } from 'passport';
import argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';
import { NotificationService } from '../notification/notification.service';
import { CreditService } from '../credit/credit.service';
import appConfig from '../config/app.config';

jest.mock('../common/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('../misc/misc.service', () => ({ MiscService: jest.fn() }));
jest.mock('../notification/notification.service', () => ({ NotificationService: jest.fn() }));
jest.mock('../credit/credit.service', () => ({ CreditService: jest.fn() }));
jest.mock('@refly/telemetry-node', () => ({ logEvent: jest.fn() }));
jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
jest.mock('@refly/utils', () => ({
  genUID: () => 'new-user',
  genVerificationSessionID: () => 'verification-session',
  safeParseJSON: JSON.parse,
}));

const user = {
  uid: 'existing-user',
  email: 'existing@example.test',
  password: 'hash',
} as UserModel;
const profile = (provider = 'google'): Profile => ({
  provider,
  id: 'provider-account',
  displayName: 'New user',
  emails: [{ value: 'new@example.test' }],
  photos: [{ value: 'https://example.test/avatar.png' }],
});
const tokens = { uid: user.uid, email: user.email, accessToken: 'access', refreshToken: 'refresh' };

describe('AuthService registration control', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMock<PrismaService>>;
  let misc: ReturnType<typeof createMock<MiscService>>;
  let notification: ReturnType<typeof createMock<NotificationService>>;
  let credit: ReturnType<typeof createMock<CreditService>>;
  let values: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    values = { 'auth.registration.enabled': false };
    prisma = createMock<PrismaService>();
    misc = createMock<MiscService>();
    notification = createMock<NotificationService>();
    credit = createMock<CreditService>();
    const config = { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
    service = new AuthService(prisma, config, createMock<JwtService>(), misc, notification, credit);
    jest.mocked(prisma.account.findUnique).mockResolvedValue(null);
    jest.mocked(prisma.user.findUnique).mockResolvedValue(null);
    jest.spyOn(service, 'login').mockResolvedValue(tokens);
    jest.spyOn(service, 'genUniqueUsername').mockResolvedValue('new-user');
    jest.mocked(argon2.hash).mockResolvedValue('hash');
    jest.mocked(argon2.verify).mockResolvedValue(true);
  });

  const expectNoRegistrationWrites = () => {
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.account.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(notification.sendEmail).not.toHaveBeenCalled();
    expect(credit.createRegistrationCreditRecharge).not.toHaveBeenCalled();
    expect(misc.dumpFileFromURL).not.toHaveBeenCalled();
    expect(service.login).not.toHaveBeenCalled();
  };

  it.each([false, true])('rejects email signup with skipVerification=%s', async (skip) => {
    values['auth.skipVerification'] = skip;
    await expect(service.emailSignup('new@example.test', 'password')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(argon2.hash).not.toHaveBeenCalled();
    expectNoRegistrationWrites();
  });

  it('rejects direct signup verification before storing or sending a code', async () => {
    await expect(
      service.createVerification({
        email: 'new@example.test',
        purpose: 'signup',
        password: 'password',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.verificationSession.create).not.toHaveBeenCalled();
    expect(argon2.hash).not.toHaveBeenCalled();
    expectNoRegistrationWrites();
  });

  it('rejects a signup code issued before registration was disabled', async () => {
    jest.mocked(prisma.verificationSession.findUnique).mockResolvedValue({
      purpose: 'signup',
      email: 'new@example.test',
      code: '123456',
      hashedPassword: 'hash',
    } as never);
    await expect(
      service.checkVerification({ sessionId: 'old-session', code: '123456' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expectNoRegistrationWrites();
  });

  it.each(['google', 'github'])(
    'rejects a new %s OAuth user before any registration side effects',
    async (provider) => {
      await expect(
        service.oauthValidate('access', 'refresh', profile(provider), ['email']),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.genUniqueUsername).not.toHaveBeenCalled();
      expectNoRegistrationWrites();
    },
  );

  it('allows an existing provider account', async () => {
    jest
      .mocked(prisma.account.findUnique)
      .mockResolvedValue({ pk: 1n, uid: user.uid, scope: '["email"]' } as never);
    jest.mocked(prisma.user.findUnique).mockResolvedValue(user);
    await expect(service.oauthValidate('access', 'refresh', profile(), ['email'])).resolves.toEqual(
      user,
    );
    expect(prisma.account.update).toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('allows linking OAuth to an already registered email', async () => {
    jest.mocked(prisma.user.findUnique).mockResolvedValue(user);
    const existingProfile = { ...profile(), emails: [{ value: user.email }] };
    await expect(
      service.oauthValidate('access', 'refresh', existingProfile, ['email']),
    ).resolves.toEqual(user);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: user.email } });
    expect(prisma.account.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ uid: user.uid }),
      }),
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('allows an existing UID to authorize a tool', async () => {
    jest.mocked(prisma.user.findUnique).mockResolvedValue(user);
    await expect(
      service.oauthValidate('access', 'refresh', profile(), ['email'], user.uid),
    ).resolves.toEqual(user);
    expect(prisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ uid: user.uid }),
      }),
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('preserves existing email login', async () => {
    jest.mocked(prisma.user.findUnique).mockResolvedValue(user);
    await expect(service.emailLogin(user.email, 'password')).resolves.toEqual(tokens);
    expect(argon2.verify).toHaveBeenCalledWith(user.password, 'password');
  });

  it('preserves password reset creation and consumption', async () => {
    const reset = {
      purpose: 'resetPassword',
      email: user.email,
      code: '123456',
      hashedPassword: 'hash',
    };
    jest.mocked(prisma.verificationSession.create).mockResolvedValue(reset as never);
    await service.createVerification({
      email: user.email,
      purpose: 'resetPassword',
      password: 'new-password',
    });
    expect(notification.sendEmail).toHaveBeenCalled();
    jest.mocked(prisma.verificationSession.findUnique).mockResolvedValue(reset as never);
    jest.mocked(prisma.user.findUnique).mockResolvedValue(user);
    await expect(
      service.checkVerification({ sessionId: 'reset-session', code: '123456' }),
    ).resolves.toEqual(tokens);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { email: user.email },
      data: { password: 'hash' },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('preserves refresh of an existing valid session', async () => {
    jest.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
      uid: user.uid,
      revoked: false,
      expiresAt: new Date(Date.now() + 60_000),
      hashedToken: 'hash',
    } as never);
    jest.mocked(prisma.user.findUnique).mockResolvedValue(user);
    await expect(service.refreshAccessToken('jti.secret')).resolves.toEqual(tokens);
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { jti: 'jti' },
      data: { revoked: true },
    });
  });

  it.each([true, undefined])(
    'preserves email verification signup when enabled=%s',
    async (enabled) => {
      values['auth.registration.enabled'] = enabled;
      values['auth.skipVerification'] = false;
      jest
        .mocked(prisma.verificationSession.create)
        .mockResolvedValue({ sessionId: 'verification-session' } as never);
      await expect(service.emailSignup('new@example.test', 'password')).resolves.toEqual({
        sessionId: 'verification-session',
      });
      expect(notification.sendEmail).toHaveBeenCalled();
    },
  );

  it('preserves immediate email signup when registration is enabled', async () => {
    values['auth.registration.enabled'] = true;
    values['auth.skipVerification'] = true;
    jest.mocked(prisma.$transaction).mockResolvedValue([user] as never);
    await expect(service.emailSignup('new@example.test', 'password')).resolves.toEqual({
      tokenData: tokens,
    });
    expect(prisma.user.create).toHaveBeenCalled();
    expect(credit.createRegistrationCreditRecharge).toHaveBeenCalledWith(user.uid);
  });

  it('preserves new OAuth signup when registration is enabled', async () => {
    values['auth.registration.enabled'] = true;
    const newUser = { ...user, uid: 'new-user', email: 'new@example.test' };
    jest.mocked(prisma.user.findUnique).mockResolvedValueOnce(null).mockResolvedValueOnce(newUser);
    jest.mocked(prisma.user.create).mockResolvedValue(newUser);
    jest
      .mocked(misc.dumpFileFromURL)
      .mockResolvedValue({ url: 'https://example.test/avatar' } as never);
    await expect(service.oauthValidate('access', 'refresh', profile(), ['email'])).resolves.toEqual(
      newUser,
    );
    expect(prisma.user.create).toHaveBeenCalled();
    expect(credit.createRegistrationCreditRecharge).toHaveBeenCalledWith(newUser.uid);
  });
});

describe('registration environment switch', () => {
  const original = process.env.AUTH_REGISTRATION_ENABLED;
  afterEach(() => {
    if (original === undefined) Reflect.deleteProperty(process.env, 'AUTH_REGISTRATION_ENABLED');
    else process.env.AUTH_REGISTRATION_ENABLED = original;
  });
  it.each([
    [undefined, true],
    ['true', true],
    ['false', false],
  ])('parses %s as %s', (value, expected) => {
    if (value === undefined) Reflect.deleteProperty(process.env, 'AUTH_REGISTRATION_ENABLED');
    else process.env.AUTH_REGISTRATION_ENABLED = value as string;
    expect(appConfig().auth.registration.enabled).toBe(expected);
  });
});

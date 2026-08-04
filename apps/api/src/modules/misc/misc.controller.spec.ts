import { Test, TestingModule } from '@nestjs/testing';
import { MiscController } from './misc.controller';
import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MiscService } from '../misc/misc.service';
import { ApiKeyService } from '../auth/api-key.service';
import { PrismaService } from '../common/prisma.service';

describe('MiscController', () => {
  let controller: MiscController;

  const configService = createMock<ConfigService>();
  const jwtService = createMock<JwtService>();
  const miscService = createMock<MiscService>();
  const apiKeyService = createMock<ApiKeyService>();
  const prismaService = createMock<PrismaService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MiscController],
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: JwtService, useValue: jwtService },
        { provide: MiscService, useValue: miscService },
        { provide: ApiKeyService, useValue: apiKeyService },
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    controller = module.get<MiscController>(MiscController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('buildCorsHeaders', () => {
    const buildCorsHeaders = (origin?: string) =>
      (controller as any).buildCorsHeaders(origin) as Record<string, string>;

    beforeEach(() => {
      configService.get.mockReturnValue('https://app.refly.ai, https://refly.ai');
    });

    it('reflects origin and allows credentials for allowlisted origins', () => {
      const headers = buildCorsHeaders('https://app.refly.ai');
      expect(headers['Access-Control-Allow-Origin']).toBe('https://app.refly.ai');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
      expect(headers['Vary']).toBe('Origin');
      expect(headers['Cross-Origin-Resource-Policy']).toBe('cross-origin');
    });

    it('does not reflect non-allowlisted origins', () => {
      const headers = buildCorsHeaders('https://evil.example.com');
      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
      expect(headers['Access-Control-Allow-Credentials']).toBeUndefined();
      // no-cors embedding (e.g. <img>) must keep working
      expect(headers['Cross-Origin-Resource-Policy']).toBe('cross-origin');
    });

    it('omits CORS headers when no Origin header is present', () => {
      const headers = buildCorsHeaders(undefined);
      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
      expect(headers['Access-Control-Allow-Credentials']).toBeUndefined();
    });
  });
});

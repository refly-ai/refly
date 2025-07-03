import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MediaService } from './media.service';

describe('MediaController', () => {
  let controller: MediaController;

  const configService = createMock<ConfigService>();
  const jwtService = createMock<JwtService>();
  const mediaService = createMock<MediaService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: JwtService, useValue: jwtService },
        { provide: MediaService, useValue: mediaService },
      ],
    }).compile();

    controller = module.get<MediaController>(MediaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

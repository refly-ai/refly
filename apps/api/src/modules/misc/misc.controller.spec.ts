import { Test, TestingModule } from '@nestjs/testing';
import { MiscController } from './misc.controller';
import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MiscService } from '../misc/misc.service';

describe('MiscController', () => {
  let controller: MiscController;

  const configService = createMock<ConfigService>();
  const jwtService = createMock<JwtService>();
  const miscService = createMock<MiscService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MiscController],
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: JwtService, useValue: jwtService },
        { provide: MiscService, useValue: miscService },
      ],
    }).compile();

    controller = module.get<MiscController>(MiscController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

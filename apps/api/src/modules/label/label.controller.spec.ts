import { Test, TestingModule } from '@nestjs/testing';
import { LabelController } from './label.controller';
import { LabelService } from './label.service';
import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

describe('LabelController', () => {
  let controller: LabelController;

  const labelService = createMock<LabelService>();
  const configService = createMock<ConfigService>();
  const jwtService = createMock<JwtService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LabelController],
      providers: [
        { provide: LabelService, useValue: labelService },
        { provide: ConfigService, useValue: configService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    controller = module.get<LabelController>(LabelController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { SkillController } from './skill.controller';
import { SkillService } from '../skill/skill.service';
import { JwtService } from '@nestjs/jwt';
import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';

describe('SkillController', () => {
  let controller: SkillController;

  const jwtService = createMock<JwtService>();
  const skillService = createMock<SkillService>();
  const configService = createMock<ConfigService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SkillController],
      providers: [
        { provide: JwtService, useValue: jwtService },
        { provide: SkillService, useValue: skillService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    controller = module.get<SkillController>(SkillController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

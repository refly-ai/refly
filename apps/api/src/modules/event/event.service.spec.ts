import { Test, TestingModule } from '@nestjs/testing';
import { EventService } from './event.service';
import { createMock } from '@golevelup/ts-jest';
import { PrismaService } from '../common/prisma.service';
import { SkillService } from '../skill/skill.service';

describe('EventService', () => {
  let service: EventService;

  const prismaService = createMock<PrismaService>();
  const skillService = createMock<SkillService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: PrismaService, useValue: prismaService },
        { provide: SkillService, useValue: skillService },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

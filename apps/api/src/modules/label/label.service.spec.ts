import { Test, TestingModule } from '@nestjs/testing';
import { LabelService } from './label.service';
import { createMock } from '@golevelup/ts-jest';
import { PrismaService } from '../common/prisma.service';

describe('LabelService', () => {
  let service: LabelService;

  const prismaService = createMock<PrismaService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LabelService, { provide: PrismaService, useValue: prismaService }],
    }).compile();

    service = module.get<LabelService>(LabelService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

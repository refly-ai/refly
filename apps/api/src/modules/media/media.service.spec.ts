import { Test, TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import { MediaService } from './media.service';
import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { QUEUE_MEDIA } from '../../utils';
import { getQueueToken } from '@nestjs/bullmq';
import { ObjectStorageService, OSS_EXTERNAL } from '../common/object-storage';

describe('MediaService', () => {
  let service: MediaService;

  const configService = createMock<ConfigService>();
  const prismaService = createMock<PrismaService>();
  const ossService = createMock<ObjectStorageService>();

  const mockQueue = {
    add: jest.fn(),
  } as unknown as Queue;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prismaService },
        { provide: OSS_EXTERNAL, useValue: ossService },
        { provide: getQueueToken(QUEUE_MEDIA), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { CollabService } from './collab.service';
import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { RAGService } from '../rag/rag.service';
import { RedisService } from '../common/redis.service';
import { QUEUE_SYNC_CANVAS_ENTITY } from '../../utils/const';
import type { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { ObjectStorageService, OSS_INTERNAL } from '../common/object-storage';
import { FULLTEXT_SEARCH, FulltextSearchService } from '../common/fulltext-search';

describe('CollabService', () => {
  let service: CollabService;

  const configService = createMock<ConfigService>();
  const prismaService = createMock<PrismaService>();
  const ragService = createMock<RAGService>();
  const fulltextSearchService = createMock<FulltextSearchService>();
  const redisService = createMock<RedisService>();
  const ossService = createMock<ObjectStorageService>();

  const mockQueue = {
    add: jest.fn(),
  } as unknown as Queue;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollabService,
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prismaService },
        { provide: RAGService, useValue: ragService },
        { provide: FULLTEXT_SEARCH, useValue: fulltextSearchService },
        { provide: RedisService, useValue: redisService },
        { provide: OSS_INTERNAL, useValue: ossService },
        { provide: getQueueToken(QUEUE_SYNC_CANVAS_ENTITY), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<CollabService>(CollabService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

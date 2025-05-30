import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeService } from './knowledge.service';
import { createMock } from '@golevelup/ts-jest';
import { PrismaService } from '../common/prisma.service';
import { RAGService } from '../rag/rag.service';
import { MiscService } from '../misc/misc.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import {
  QUEUE_CLEAR_CANVAS_ENTITY,
  QUEUE_RESOURCE,
  QUEUE_SIMPLE_EVENT,
  QUEUE_SYNC_STORAGE_USAGE,
} from '../../utils/const';
import { ObjectStorageService, OSS_INTERNAL } from '../common/object-storage';
import { FULLTEXT_SEARCH, FulltextSearchService } from '../common/fulltext-search';

describe('KnowledgeService', () => {
  let service: KnowledgeService;

  const prismaService = createMock<PrismaService>();
  const fulltextSearchService = createMock<FulltextSearchService>();
  const ragService = createMock<RAGService>();
  const miscService = createMock<MiscService>();
  const ossService = createMock<ObjectStorageService>();
  const subscriptionService = createMock<SubscriptionService>();

  const mockQueue = {
    add: jest.fn(),
  } as unknown as Queue;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: PrismaService, useValue: prismaService },
        { provide: RAGService, useValue: ragService },
        { provide: MiscService, useValue: miscService },
        { provide: SubscriptionService, useValue: subscriptionService },
        { provide: OSS_INTERNAL, useValue: ossService },
        { provide: FULLTEXT_SEARCH, useValue: fulltextSearchService },
        { provide: getQueueToken(QUEUE_RESOURCE), useValue: mockQueue },
        { provide: getQueueToken(QUEUE_SIMPLE_EVENT), useValue: mockQueue },
        { provide: getQueueToken(QUEUE_SYNC_STORAGE_USAGE), useValue: mockQueue },
        { provide: getQueueToken(QUEUE_CLEAR_CANVAS_ENTITY), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<KnowledgeService>(KnowledgeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

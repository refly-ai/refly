import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '../common/prisma.service';
import { SkillService } from './skill.service';
import { Queue } from 'bullmq';
import { createMock } from '@golevelup/ts-jest';
import { LabelService } from '../label/label.service';
import { CollabService } from '../collab/collab.service';
import { CanvasService } from '../canvas/canvas.service';
import { RAGService } from '../rag/rag.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { SearchService } from '../search/search.service';
import {
  QUEUE_SKILL,
  QUEUE_SKILL_TIMEOUT_CHECK,
  QUEUE_SYNC_REQUEST_USAGE,
  QUEUE_SYNC_TOKEN_USAGE,
} from '../../utils';

describe('SkillService', () => {
  let service: SkillService;

  const configService = createMock<ConfigService>();
  const prismaService = createMock<PrismaService>();
  const labelService = createMock<LabelService>();
  const searchService = createMock<SearchService>();
  const knowledgeService = createMock<KnowledgeService>();
  const ragService = createMock<RAGService>();
  const canvasService = createMock<CanvasService>();
  const subscriptionService = createMock<SubscriptionService>();
  const collabService = createMock<CollabService>();

  const mockQueue = {
    add: jest.fn(),
  } as unknown as Queue;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillService,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: LabelService,
          useValue: labelService,
        },
        {
          provide: SearchService,
          useValue: searchService,
        },
        {
          provide: KnowledgeService,
          useValue: knowledgeService,
        },
        {
          provide: RAGService,
          useValue: ragService,
        },
        {
          provide: CanvasService,
          useValue: canvasService,
        },
        {
          provide: SubscriptionService,
          useValue: subscriptionService,
        },
        {
          provide: CollabService,
          useValue: collabService,
        },
        {
          provide: getQueueToken(QUEUE_SKILL),
          useValue: mockQueue,
        },
        {
          provide: getQueueToken(QUEUE_SKILL_TIMEOUT_CHECK),
          useValue: mockQueue,
        },
        {
          provide: getQueueToken(QUEUE_SYNC_TOKEN_USAGE),
          useValue: mockQueue,
        },
        {
          provide: getQueueToken(QUEUE_SYNC_REQUEST_USAGE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<SkillService>(SkillService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Add more test cases here as needed
});

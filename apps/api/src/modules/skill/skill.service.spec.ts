import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '../common/prisma.service';
import { SkillService } from './skill.service';
import { Queue } from 'bullmq';
import { createMock } from '@golevelup/ts-jest';
import { CollabService } from '../collab/collab.service';
import { CanvasService } from '../canvas/canvas.service';
import { RAGService } from '../rag/rag.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { DocumentService } from '../knowledge/document.service';
import { ResourceService } from '../knowledge/resource.service';
import { SearchService } from '../search/search.service';
import { QUEUE_SKILL, QUEUE_SYNC_REQUEST_USAGE, QUEUE_SYNC_TOKEN_USAGE } from '../../utils';

describe('SkillService', () => {
  let service: SkillService;

  const configService = createMock<ConfigService>();
  const prismaService = createMock<PrismaService>();
  const searchService = createMock<SearchService>();
  const documentService = createMock<DocumentService>();
  const resourceService = createMock<ResourceService>();
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
          provide: SearchService,
          useValue: searchService,
        },
        {
          provide: DocumentService,
          useValue: documentService,
        },
        {
          provide: ResourceService,
          useValue: resourceService,
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

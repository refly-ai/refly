import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowAppService } from './workflow-app.service';
import { PrismaService } from '../common/prisma.service';
import { CanvasService } from '../canvas/canvas.service';
import { MiscService } from '../misc/misc.service';
import { WorkflowService } from '../workflow/workflow.service';
import { ShareCommonService } from '../share/share-common.service';
import { ShareCreationService } from '../share/share-creation.service';

describe('WorkflowAppService', () => {
  let service: WorkflowAppService;
  let _prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowAppService,
        {
          provide: PrismaService,
          useValue: {
            workflowApp: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: CanvasService,
          useValue: {
            getCanvasRawData: jest.fn(),
          },
        },
        {
          provide: MiscService,
          useValue: {
            publishFile: jest.fn(),
            uploadBuffer: jest.fn(),
          },
        },
        {
          provide: WorkflowService,
          useValue: {
            initializeWorkflowExecution: jest.fn(),
          },
        },
        {
          provide: ShareCommonService,
          useValue: {},
        },
        {
          provide: ShareCreationService,
          useValue: {
            createShareForWorkflowApp: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WorkflowAppService>(WorkflowAppService);
    _prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateCategoryTags', () => {
    it('should return valid tags', () => {
      const result = (service as any).validateCategoryTags(['education', 'business']);
      expect(result).toEqual(['education', 'business']);
    });

    it('should filter out invalid tags', () => {
      const result = (service as any).validateCategoryTags(['education', 'invalid', 'business']);
      expect(result).toEqual(['education', 'business']);
    });

    it('should default to education if no valid tags', () => {
      const result = (service as any).validateCategoryTags(['invalid', 'also-invalid']);
      expect(result).toEqual(['education']);
    });

    it('should limit to 3 tags', () => {
      const result = (service as any).validateCategoryTags([
        'education',
        'business',
        'creative',
        'sales',
        'life',
      ]);
      expect(result).toEqual(['education', 'business', 'creative']);
    });

    it('should remove duplicates', () => {
      const result = (service as any).validateCategoryTags(['education', 'business', 'education']);
      expect(result).toEqual(['education', 'business']);
    });
  });
});

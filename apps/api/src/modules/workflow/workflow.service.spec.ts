import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowService } from './workflow.service';
import { PrismaService } from '../common/prisma.service';
import { SkillService } from '../skill/skill.service';
import { CanvasService } from '../canvas/canvas.service';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { CanvasSyncService } from '../canvas/canvas-sync.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_SYNC_WORKFLOW, QUEUE_RUN_WORKFLOW } from '../../utils/const';

describe('WorkflowService', () => {
  let service: WorkflowService;
  let prismaService: PrismaService;
  let canvasSyncService: CanvasSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        {
          provide: PrismaService,
          useValue: {
            workflowExecution: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            workflowNodeExecution: {
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              groupBy: jest.fn(),
              count: jest.fn(),
            },
            canvas: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: SkillService,
          useValue: {
            sendInvokeSkillTask: jest.fn(),
          },
        },
        {
          provide: CanvasService,
          useValue: {
            getCanvasRawData: jest.fn(),
          },
        },
        {
          provide: McpServerService,
          useValue: {
            listMcpServers: jest.fn(),
          },
        },
        {
          provide: CanvasSyncService,
          useValue: {
            getState: jest.fn(),
          },
        },
        {
          provide: getQueueToken(QUEUE_SYNC_WORKFLOW),
          useValue: {
            add: jest.fn(),
          },
        },
        {
          provide: getQueueToken(QUEUE_RUN_WORKFLOW),
          useValue: {
            add: jest.fn(),
            getJobs: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
    prismaService = module.get<PrismaService>(PrismaService);
    canvasSyncService = module.get<CanvasSyncService>(CanvasSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initializeWorkflowExecution', () => {
    it('should create workflow execution with node relationships', async () => {
      const mockUser = { uid: 'test-user' };
      const mockCanvasId = 'test-canvas';
      const mockCanvasState = {
        nodes: [
          { id: 'node1', type: 'skillResponse', data: { title: 'Node 1', entityId: 'entity1' } },
          { id: 'node2', type: 'skillResponse', data: { title: 'Node 2', entityId: 'entity2' } },
        ],
        edges: [{ source: 'node1', target: 'node2' }],
      };

      jest.spyOn(canvasSyncService, 'getState').mockResolvedValue(mockCanvasState as any);
      jest.spyOn(prismaService.workflowExecution, 'create').mockResolvedValue({
        executionId: 'we-test',
        uid: 'test-user',
        canvasId: 'test-canvas',
        title: 'Test Workflow',
        status: 'executing',
        totalNodes: 2,
      } as any);

      jest.spyOn(prismaService.workflowNodeExecution, 'create').mockResolvedValue({
        nodeExecutionId: 'wne-test',
        executionId: 'we-test',
        nodeId: 'node1',
        status: 'waiting',
      } as any);

      const result = await service.initializeWorkflowExecution(mockUser as any, mockCanvasId);

      expect(result).toBeDefined();
      expect(canvasSyncService.getState).toHaveBeenCalledWith(mockUser, { canvasId: mockCanvasId });
      expect(prismaService.workflowExecution.create).toHaveBeenCalled();
      expect(prismaService.workflowNodeExecution.create).toHaveBeenCalledTimes(2);
    });
  });
});

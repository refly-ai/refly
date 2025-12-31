import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowService } from './workflow.service';
import { PrismaService } from '../common/prisma.service';
import { SkillService } from '../skill/skill.service';
import { CanvasService } from '../canvas/canvas.service';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_RUN_WORKFLOW, QUEUE_POLL_WORKFLOW } from '../../utils/const';
import { RedisService } from '../common/redis.service';
import { ActionService } from '../action/action.service';
import { ToolInventoryService } from '../tool/inventory/inventory.service';
import { ToolService } from '../tool/tool.service';
import { CreditService } from '../credit/credit.service';
import { SkillInvokerService } from '../skill/skill-invoker.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowCompletedEvent, WorkflowFailedEvent } from './workflow.events';

jest.mock('@refly/skill-template', () => ({}));
jest.mock('../skill/skill-invoker.service');
jest.mock('../skill/skill.service');
jest.mock('../action/action.service');
jest.mock('../tool/tool.service');
jest.mock('../canvas-sync/canvas-sync.service');
jest.mock('../canvas/canvas.service');

describe('WorkflowService', () => {
  let service: WorkflowService;
  let prismaService: PrismaService;
  let eventEmitter: EventEmitter2;
  let _redisService: RedisService;

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
              updateMany: jest.fn(),
              groupBy: jest.fn(),
              count: jest.fn(),
              findMany: jest.fn(),
            },
            canvas: {
              findUnique: jest.fn(),
            },
            workflowApp: {
              // Mock workflowApp
              findUnique: jest.fn(),
            },
            $transaction: jest.fn((cb) => cb),
          },
        },
        {
          provide: RedisService,
          useValue: {
            acquireLock: jest.fn().mockResolvedValue(() => {}), // Mock lock acquisition
          },
        },
        { provide: SkillService, useValue: {} },
        { provide: ActionService, useValue: {} },
        { provide: CanvasService, useValue: { getCanvasRawData: jest.fn() } },
        { provide: McpServerService, useValue: {} },
        { provide: CanvasSyncService, useValue: { getState: jest.fn() } },
        { provide: ToolInventoryService, useValue: {} },
        { provide: ToolService, useValue: {} },
        { provide: CreditService, useValue: { countExecutionCreditUsageByExecutionId: jest.fn() } },
        { provide: SkillInvokerService, useValue: {} },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: getQueueToken(QUEUE_RUN_WORKFLOW),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QUEUE_POLL_WORKFLOW),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
    prismaService = module.get<PrismaService>(PrismaService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    _redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('pollWorkflow', () => {
    const mockUser = { uid: 'test-user', email: 'test@example.com' };
    const mockExecutionId = 'exec-id';

    it('should emit WorkflowCompletedEvent when scheduled workflow finishes', async () => {
      // Mock Workflow Execution found
      jest.spyOn(prismaService.workflowExecution, 'findUnique').mockResolvedValueOnce({
        executionId: mockExecutionId,
        status: 'executing',
        createdAt: new Date(),
        uid: 'test-user',
        workflowId: 'wf-id',
        scheduleRecordId: 'sch-rec-id',
        triggerType: 'scheduled',
        canvasId: 'canvas-id',
      } as any);

      // Mock node stats - all finished
      jest
        .spyOn(prismaService.workflowNodeExecution, 'findMany')
        .mockResolvedValue([{ nodeId: 'node1', status: 'finish' } as any]);
      jest.spyOn(prismaService.workflowNodeExecution, 'count').mockResolvedValue(0); // 0 pending

      // Mock DB updates
      jest.spyOn(prismaService.workflowExecution, 'findUnique').mockResolvedValueOnce({
        // Current status check inside logic
        executionId: mockExecutionId,
        status: 'executing',
        executedNodes: 0,
        failedNodes: 0,
      } as any);

      await service.pollWorkflow({
        user: mockUser as any,
        executionId: mockExecutionId,
        nodeBehavior: 'create',
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workflow.completed',
        expect.any(WorkflowCompletedEvent),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workflow.completed',
        expect.objectContaining({ executionId: mockExecutionId, scheduleId: 'sch-rec-id' }),
      );
    });

    it('should emit WorkflowFailedEvent when scheduled workflow fails', async () => {
      // Mock Workflow Execution found
      jest.spyOn(prismaService.workflowExecution, 'findUnique').mockResolvedValueOnce({
        executionId: mockExecutionId,
        status: 'executing',
        createdAt: new Date(),
        uid: 'test-user',
        workflowId: 'wf-id',
        scheduleRecordId: 'sch-rec-id',
        triggerType: 'scheduled',
        canvasId: 'canvas-id',
      } as any);

      // Mock node stats - one failed
      jest
        .spyOn(prismaService.workflowNodeExecution, 'findMany')
        .mockResolvedValue([
          { nodeId: 'node1', status: 'failed', errorMessage: 'Node Failed' } as any,
        ]);
      jest.spyOn(prismaService.workflowNodeExecution, 'count').mockResolvedValue(0); // 0 pending

      jest.spyOn(prismaService.workflowExecution, 'findUnique').mockResolvedValueOnce({
        // Current status check inside logic
        executionId: mockExecutionId,
        status: 'executing',
        executedNodes: 0,
        failedNodes: 0,
      } as any);

      jest.spyOn(prismaService.workflowNodeExecution, 'findFirst').mockResolvedValue({
        nodeId: 'node1',
        title: 'Node 1',
        errorMessage: 'Node Failed',
      } as any);

      await service.pollWorkflow({
        user: mockUser as any,
        executionId: mockExecutionId,
        nodeBehavior: 'create',
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workflow.failed',
        expect.any(WorkflowFailedEvent),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workflow.failed',
        expect.objectContaining({ executionId: mockExecutionId, scheduleId: 'sch-rec-id' }),
      );
    });

    it('should NOT emit events for non-scheduled workflows', async () => {
      // Mock Workflow Execution found - NO scheduleRecordId
      jest.spyOn(prismaService.workflowExecution, 'findUnique').mockResolvedValueOnce({
        executionId: mockExecutionId,
        status: 'executing',
        createdAt: new Date(),
        uid: 'test-user',
        workflowId: 'wf-id',
        // scheduleRecordId: undefined,
        triggerType: 'manual',
        canvasId: 'canvas-id',
      } as any);

      // Mock node stats - all finished
      jest
        .spyOn(prismaService.workflowNodeExecution, 'findMany')
        .mockResolvedValue([{ nodeId: 'node1', status: 'finish' } as any]);
      jest.spyOn(prismaService.workflowNodeExecution, 'count').mockResolvedValue(0);

      jest.spyOn(prismaService.workflowExecution, 'findUnique').mockResolvedValueOnce({
        executionId: mockExecutionId,
        status: 'executing',
      } as any);

      await service.pollWorkflow({
        user: mockUser as any,
        executionId: mockExecutionId,
        nodeBehavior: 'create',
      });

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});

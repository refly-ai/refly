import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { SchedulePriorityService } from './schedule-priority.service';
import { PrismaService } from '../common/prisma.service';
import {
  PLAN_PRIORITY_MAP,
  PRIORITY_ADJUSTMENTS,
  DEFAULT_SCHEDULE_CONFIG,
} from './schedule.constants';

describe('SchedulePriorityService', () => {
  let service: SchedulePriorityService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockPrisma = createMock<PrismaService>();
    const mockConfigService = createMock<ConfigService>();
    // Return undefined for all config.get calls to use defaults
    mockConfigService.get.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulePriorityService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SchedulePriorityService>(SchedulePriorityService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateExecutionPriority', () => {
    describe('subscription-based priority', () => {
      it('should return priority 1 for Max tier users', async () => {
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
          lookupKey: 'refly_max_yearly_stable_v3',
          status: 'active',
        });
        prismaService.workflowScheduleRecord.findMany = jest.fn().mockResolvedValue([]);
        prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);

        const priority = await service.calculateExecutionPriority('test-uid');
        expect(priority).toBe(1);
      });

      it('should return priority 3 for Plus tier users', async () => {
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
          lookupKey: 'refly_plus_yearly_stable_v2',
          status: 'active',
        });
        prismaService.workflowScheduleRecord.findMany = jest.fn().mockResolvedValue([]);
        prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);

        const priority = await service.calculateExecutionPriority('test-uid');
        expect(priority).toBe(3);
      });

      it('should return priority 5 for Starter tier users', async () => {
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
          lookupKey: 'refly_starter_monthly',
          status: 'active',
        });
        prismaService.workflowScheduleRecord.findMany = jest.fn().mockResolvedValue([]);
        prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);

        const priority = await service.calculateExecutionPriority('test-uid');
        expect(priority).toBe(5);
      });

      it('should return priority 7 for Maker tier users', async () => {
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
          lookupKey: 'refly_maker_monthly',
          status: 'active',
        });
        prismaService.workflowScheduleRecord.findMany = jest.fn().mockResolvedValue([]);
        prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);

        const priority = await service.calculateExecutionPriority('test-uid');
        expect(priority).toBe(7);
      });

      it('should return priority 10 (DEFAULT_PRIORITY) for free tier users', async () => {
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue(null);
        prismaService.workflowScheduleRecord.findMany = jest.fn().mockResolvedValue([]);
        prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);

        const priority = await service.calculateExecutionPriority('test-uid');
        expect(priority).toBe(DEFAULT_SCHEDULE_CONFIG.defaultPriority);
      });

      it('should return priority 10 for unknown subscription lookupKey', async () => {
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
          lookupKey: 'unknown_plan',
          status: 'active',
        });
        prismaService.workflowScheduleRecord.findMany = jest.fn().mockResolvedValue([]);
        prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);

        const priority = await service.calculateExecutionPriority('test-uid');
        expect(priority).toBe(DEFAULT_SCHEDULE_CONFIG.defaultPriority);
      });

      it('should return priority 8 for test/trial plans', async () => {
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
          lookupKey: 'refly_plus_yearly_test_v3',
          status: 'active',
        });
        prismaService.workflowScheduleRecord.findMany = jest.fn().mockResolvedValue([]);
        prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);

        const priority = await service.calculateExecutionPriority('test-uid');
        expect(priority).toBe(8);
      });
    });

    describe('failure penalty adjustments', () => {
      it('should add penalty for 1 consecutive failure', async () => {
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
          lookupKey: 'refly_plus_yearly_stable_v2',
          status: 'active',
        });
        prismaService.workflowScheduleRecord.findMany = jest
          .fn()
          .mockResolvedValue([{ status: 'failed' }]);
        prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);

        const priority = await service.calculateExecutionPriority('test-uid');
        // Base priority 3 + 1 failure penalty = 4
        expect(priority).toBe(3 + PRIORITY_ADJUSTMENTS.FAILURE_PENALTY);
      });

      it('should add penalty for 3 consecutive failures (max level)', async () => {
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
          lookupKey: 'refly_plus_yearly_stable_v2',
          status: 'active',
        });
        prismaService.workflowScheduleRecord.findMany = jest
          .fn()
          .mockResolvedValue([{ status: 'failed' }, { status: 'failed' }, { status: 'failed' }]);
        prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);

        const priority = await service.calculateExecutionPriority('test-uid');
        // Base priority 3 + 3 * failure penalty = 6
        expect(priority).toBe(
          3 + PRIORITY_ADJUSTMENTS.MAX_FAILURE_LEVELS * PRIORITY_ADJUSTMENTS.FAILURE_PENALTY,
        );
      });

      it('should cap failure penalty at MAX_FAILURE_LEVELS', async () => {
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
          lookupKey: 'refly_plus_yearly_stable_v2',
          status: 'active',
        });
        // 5 consecutive failures - should be capped at 3
        prismaService.workflowScheduleRecord.findMany = jest
          .fn()
          .mockResolvedValue([
            { status: 'failed' },
            { status: 'failed' },
            { status: 'failed' },
            { status: 'failed' },
            { status: 'failed' },
          ]);
        prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);

        const priority = await service.calculateExecutionPriority('test-uid');
        // Base priority 3 + capped 3 * failure penalty = 6
        expect(priority).toBe(
          3 + PRIORITY_ADJUSTMENTS.MAX_FAILURE_LEVELS * PRIORITY_ADJUSTMENTS.FAILURE_PENALTY,
        );
      });

      it('should stop counting failures after a success', async () => {
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
          lookupKey: 'refly_plus_yearly_stable_v2',
          status: 'active',
        });
        prismaService.workflowScheduleRecord.findMany = jest.fn().mockResolvedValue([
          { status: 'failed' },
          { status: 'success' }, // This breaks the consecutive count
          { status: 'failed' },
          { status: 'failed' },
        ]);
        prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);

        const priority = await service.calculateExecutionPriority('test-uid');
        // Only 1 consecutive failure, base 3 + 1 = 4
        expect(priority).toBe(3 + PRIORITY_ADJUSTMENTS.FAILURE_PENALTY);
      });

      it('should not add penalty when most recent is success', async () => {
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
          lookupKey: 'refly_plus_yearly_stable_v2',
          status: 'active',
        });
        prismaService.workflowScheduleRecord.findMany = jest
          .fn()
          .mockResolvedValue([{ status: 'success' }, { status: 'failed' }, { status: 'failed' }]);
        prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);

        const priority = await service.calculateExecutionPriority('test-uid');
        // No consecutive failure from latest, base = 3
        expect(priority).toBe(3);
      });
    });

    describe('high load penalty adjustments', () => {
      it('should not add penalty when active schedules <= threshold', async () => {
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
          lookupKey: 'refly_plus_yearly_stable_v2',
          status: 'active',
        });
        prismaService.workflowScheduleRecord.findMany = jest.fn().mockResolvedValue([]);
        prismaService.workflowSchedule.count = jest
          .fn()
          .mockResolvedValue(DEFAULT_SCHEDULE_CONFIG.highLoadThreshold);

        const priority = await service.calculateExecutionPriority('test-uid');
        expect(priority).toBe(3); // No penalty, still at threshold
      });

      it('should add penalty when active schedules > threshold', async () => {
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
          lookupKey: 'refly_plus_yearly_stable_v2',
          status: 'active',
        });
        prismaService.workflowScheduleRecord.findMany = jest.fn().mockResolvedValue([]);
        prismaService.workflowSchedule.count = jest
          .fn()
          .mockResolvedValue(DEFAULT_SCHEDULE_CONFIG.highLoadThreshold + 1);

        const priority = await service.calculateExecutionPriority('test-uid');
        // Base 3 + high load penalty
        expect(priority).toBe(3 + PRIORITY_ADJUSTMENTS.HIGH_LOAD_PENALTY);
      });
    });

    describe('combined adjustments', () => {
      it('should combine failure and high load penalties', async () => {
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
          lookupKey: 'refly_plus_yearly_stable_v2',
          status: 'active',
        });
        prismaService.workflowScheduleRecord.findMany = jest
          .fn()
          .mockResolvedValue([{ status: 'failed' }, { status: 'failed' }]);
        prismaService.workflowSchedule.count = jest
          .fn()
          .mockResolvedValue(DEFAULT_SCHEDULE_CONFIG.highLoadThreshold + 1);

        const priority = await service.calculateExecutionPriority('test-uid');
        // Base 3 + 2 failure + 1 high load = 6
        expect(priority).toBe(
          3 + 2 * PRIORITY_ADJUSTMENTS.FAILURE_PENALTY + PRIORITY_ADJUSTMENTS.HIGH_LOAD_PENALTY,
        );
      });
    });

    describe('boundary value tests', () => {
      it('should never return priority less than 1', async () => {
        // Even with highest tier (priority 1), it should stay at 1
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
          lookupKey: 'refly_max_yearly_stable_v3',
          status: 'active',
        });
        prismaService.workflowScheduleRecord.findMany = jest.fn().mockResolvedValue([]);
        prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);

        const priority = await service.calculateExecutionPriority('test-uid');
        expect(priority).toBeGreaterThanOrEqual(1);
      });

      it('should never return priority greater than MAX_PRIORITY', async () => {
        // Free tier + max failures + high load should still cap at 10
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue(null);
        prismaService.workflowScheduleRecord.findMany = jest
          .fn()
          .mockResolvedValue([
            { status: 'failed' },
            { status: 'failed' },
            { status: 'failed' },
            { status: 'failed' },
            { status: 'failed' },
          ]);
        prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(100);

        const priority = await service.calculateExecutionPriority('test-uid');
        expect(priority).toBeLessThanOrEqual(DEFAULT_SCHEDULE_CONFIG.maxPriority);
      });

      it('should return integer priority values', async () => {
        prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
          lookupKey: 'refly_plus_yearly_stable_v2',
          status: 'active',
        });
        prismaService.workflowScheduleRecord.findMany = jest.fn().mockResolvedValue([]);
        prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);

        const priority = await service.calculateExecutionPriority('test-uid');
        expect(Number.isInteger(priority)).toBe(true);
      });
    });
  });

  describe('PLAN_PRIORITY_MAP coverage', () => {
    // Ensure all mapped plans have valid priority values
    it('should have valid priority values for all plans', () => {
      for (const [_planKey, priority] of Object.entries(PLAN_PRIORITY_MAP)) {
        expect(priority).toBeGreaterThanOrEqual(1);
        expect(priority).toBeLessThanOrEqual(DEFAULT_SCHEDULE_CONFIG.maxPriority);
        expect(Number.isInteger(priority)).toBe(true);
      }
    });

    it('should have Max tier with highest priority (lowest number)', () => {
      const maxPriorities = [
        PLAN_PRIORITY_MAP.refly_max_yearly_stable_v3,
        PLAN_PRIORITY_MAP.refly_max_yearly_limited_offer,
      ];
      for (const p of maxPriorities) {
        expect(p).toBe(1);
      }
    });

    it('should have free tier with lowest priority (highest number)', () => {
      expect(PLAN_PRIORITY_MAP.free).toBe(10);
    });
  });
});

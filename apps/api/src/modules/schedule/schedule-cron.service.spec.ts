import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { ScheduleCronService } from './schedule-cron.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { SchedulePriorityService } from './schedule-priority.service';
import { ScheduleService } from './schedule.service';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_SCHEDULE_EXECUTION } from './schedule.constants';

import { NotificationService } from '../notification/notification.service';
import { ConfigService } from '@nestjs/config';

describe('ScheduleCronService', () => {
  let service: ScheduleCronService;
  let prismaService: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;
  let priorityService: jest.Mocked<SchedulePriorityService>;
  let scheduleService: jest.Mocked<ScheduleService>;
  let mockQueue: jest.Mocked<Queue>;

  const mockSchedule = {
    scheduleId: 'schedule-123',
    canvasId: 'canvas-456',
    uid: 'user-789',
    name: 'Test Schedule',
    cronExpression: '0 * * * *',
    timezone: 'Asia/Shanghai',
    isEnabled: true,
    nextRunAt: new Date(),
    deletedAt: null,
    scheduleConfig: null,
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockPrisma = createMock<PrismaService>();
    const mockRedis = createMock<RedisService>();
    const mockPriority = createMock<SchedulePriorityService>();
    const mockScheduleService = createMock<ScheduleService>();
    const mockNotificationService = createMock<NotificationService>();
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
      getJobs: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<Queue>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleCronService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: SchedulePriorityService, useValue: mockPriority },
        { provide: ScheduleService, useValue: mockScheduleService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: getQueueToken(QUEUE_SCHEDULE_EXECUTION), useValue: mockQueue },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'origin') return 'https://refly.ai';
              // Return undefined for schedule configs to trigger defaults
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ScheduleCronService>(ScheduleCronService);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);
    priorityService = module.get(SchedulePriorityService);
    scheduleService = module.get(ScheduleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scanAndTriggerSchedules', () => {
    it('should acquire lock and process due schedules', async () => {
      const releaseLock = jest.fn();
      redisService.acquireLock = jest.fn().mockResolvedValue(releaseLock);
      prismaService.workflowSchedule.findMany = jest.fn().mockResolvedValue([]);

      await service.scanAndTriggerSchedules();

      expect(redisService.acquireLock).toHaveBeenCalledWith('lock:schedule:scan', 120);
      expect(releaseLock).toHaveBeenCalled();
    });

    it('should skip processing if lock not acquired', async () => {
      redisService.acquireLock = jest.fn().mockResolvedValue(null);
      prismaService.workflowSchedule.findMany = jest.fn();

      await service.scanAndTriggerSchedules();

      expect(prismaService.workflowSchedule.findMany).not.toHaveBeenCalled();
    });

    it('should release lock even on error', async () => {
      const releaseLock = jest.fn();
      redisService.acquireLock = jest.fn().mockResolvedValue(releaseLock);
      prismaService.workflowSchedule.findMany = jest.fn().mockRejectedValue(new Error('DB error'));

      await service.scanAndTriggerSchedules();

      expect(releaseLock).toHaveBeenCalled();
    });

    it('should process multiple due schedules', async () => {
      const releaseLock = jest.fn();
      redisService.acquireLock = jest.fn().mockResolvedValue(releaseLock);
      prismaService.workflowSchedule.findMany = jest
        .fn()
        .mockResolvedValue([mockSchedule, { ...mockSchedule, scheduleId: 'schedule-456' }]);
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue({
        isEnabled: true,
        deletedAt: null,
      });
      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});
      prismaService.canvas.findUnique = jest.fn().mockResolvedValue({ title: 'Test' });
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue({ uid: 'user-789' });
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(1);
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);
      scheduleService.createOrUpdateScheduledRecord = jest.fn().mockResolvedValue(undefined);

      await service.scanAndTriggerSchedules();

      expect(mockQueue.add).toHaveBeenCalledTimes(2);
    });
  });

  describe('triggerSchedule (via processDueSchedules)', () => {
    beforeEach(() => {
      const releaseLock = jest.fn();
      redisService.acquireLock = jest.fn().mockResolvedValue(releaseLock);
      // Default mock for schedule status check at the start of triggerSchedule
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue({
        isEnabled: true,
        deletedAt: null,
      });
    });

    it('should auto-disable schedule with invalid cron expression', async () => {
      const invalidSchedule = {
        ...mockSchedule,
        cronExpression: 'invalid-cron-expression',
      };
      prismaService.workflowSchedule.findMany = jest.fn().mockResolvedValue([invalidSchedule]);
      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue({});

      await service.scanAndTriggerSchedules();

      expect(prismaService.workflowSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isEnabled: false,
            nextRunAt: null,
          }),
        }),
      );
    });

    it('should update nextRunAt and lastRunAt when triggering', async () => {
      prismaService.workflowSchedule.findMany = jest.fn().mockResolvedValue([mockSchedule]);
      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});
      prismaService.canvas.findUnique = jest.fn().mockResolvedValue({ title: 'Test' });
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue({ uid: 'user-789' });
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(1);
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);
      scheduleService.createOrUpdateScheduledRecord = jest.fn().mockResolvedValue(undefined);

      await service.scanAndTriggerSchedules();

      expect(prismaService.workflowSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastRunAt: expect.any(Date),
            nextRunAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should convert existing scheduled record to pending status', async () => {
      const existingRecord = {
        scheduleRecordId: 'record-123',
        status: 'scheduled',
        workflowExecutionId: null,
      };
      prismaService.workflowSchedule.findMany = jest.fn().mockResolvedValue([mockSchedule]);
      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue(mockSchedule);
      // Only one call to findFirst - to find scheduled record
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(existingRecord);
      prismaService.workflowScheduleRecord.update = jest.fn().mockResolvedValue({});
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue({ uid: 'user-789' });
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(1);
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);
      scheduleService.createOrUpdateScheduledRecord = jest.fn().mockResolvedValue(undefined);

      await service.scanAndTriggerSchedules();

      expect(prismaService.workflowScheduleRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { scheduleRecordId: 'record-123' },
          data: expect.objectContaining({
            status: 'pending',
            triggeredAt: expect.any(Date),
          }),
        }),
      );
      // Verify createOrUpdateScheduledRecord is called for next execution
      expect(scheduleService.createOrUpdateScheduledRecord).toHaveBeenCalledWith(
        mockSchedule.uid,
        mockSchedule.scheduleId,
        mockSchedule.canvasId,
        expect.any(Date),
      );
    });

    it('should create new pending record if none exists', async () => {
      prismaService.workflowSchedule.findMany = jest.fn().mockResolvedValue([mockSchedule]);
      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});
      prismaService.canvas.findUnique = jest.fn().mockResolvedValue({ title: 'Test' });
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue({ uid: 'user-789' });
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(1);
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);
      scheduleService.createOrUpdateScheduledRecord = jest.fn().mockResolvedValue(undefined);

      await service.scanAndTriggerSchedules();

      expect(prismaService.workflowScheduleRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending',
            uid: mockSchedule.uid,
            sourceCanvasId: mockSchedule.canvasId, // Source canvas (template)
            canvasId: '', // Empty initially, will be updated after execution
          }),
        }),
      );
    });

    it('should add job to queue with correct priority', async () => {
      prismaService.workflowSchedule.findMany = jest.fn().mockResolvedValue([mockSchedule]);
      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});
      prismaService.canvas.findUnique = jest.fn().mockResolvedValue({ title: 'Test' });
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue({ uid: 'user-789' });
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(1);
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(3);
      scheduleService.createOrUpdateScheduledRecord = jest.fn().mockResolvedValue(undefined);

      await service.scanAndTriggerSchedules();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'execute-scheduled-workflow',
        expect.objectContaining({
          scheduleId: mockSchedule.scheduleId,
          priority: 3,
        }),
        expect.objectContaining({
          priority: 3,
        }),
      );
    });

    it('should create scheduled record for next execution', async () => {
      prismaService.workflowSchedule.findMany = jest.fn().mockResolvedValue([mockSchedule]);
      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});
      prismaService.canvas.findUnique = jest.fn().mockResolvedValue({ title: 'Test' });
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue({ uid: 'user-789' });
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(1);
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);
      scheduleService.createOrUpdateScheduledRecord = jest.fn().mockResolvedValue(undefined);

      await service.scanAndTriggerSchedules();

      expect(scheduleService.createOrUpdateScheduledRecord).toHaveBeenCalledWith(
        mockSchedule.uid,
        mockSchedule.scheduleId,
        mockSchedule.canvasId,
        expect.any(Date),
      );
    });

    it('should store disable reason in scheduleConfig for invalid cron', async () => {
      const invalidSchedule = {
        ...mockSchedule,
        cronExpression: 'bad cron',
        scheduleConfig: JSON.stringify({ key: 'value' }),
      };
      prismaService.workflowSchedule.findMany = jest.fn().mockResolvedValue([invalidSchedule]);
      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue({});

      await service.scanAndTriggerSchedules();

      expect(prismaService.workflowSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scheduleConfig: expect.stringContaining('_disabledReason'),
          }),
        }),
      );
    });

    it('should create pending record and add to queue even if schedule has running task', async () => {
      // Note: The cron service doesn't check for running tasks - it just triggers schedules
      // Concurrency control is handled in the processor, not here
      prismaService.workflowSchedule.findMany = jest.fn().mockResolvedValue([mockSchedule]);
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue({ uid: 'user-789' });
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(1);
      prismaService.canvas.findUnique = jest.fn().mockResolvedValue({ title: 'Test Canvas' });
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);
      scheduleService.createOrUpdateScheduledRecord = jest.fn().mockResolvedValue(undefined);

      await service.scanAndTriggerSchedules();

      // The implementation creates a pending record and adds to queue
      // The processor will handle the concurrency check later
      expect(prismaService.workflowScheduleRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending',
            workflowTitle: 'Test Canvas',
          }),
        }),
      );
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should auto-disable excess schedules when quota exceeded', async () => {
      const otherSchedules = [
        { scheduleId: 'schedule-2', name: 'Schedule 2', createdAt: new Date('2024-01-02') },
        { scheduleId: 'schedule-3', name: 'Schedule 3', createdAt: new Date('2024-01-03') },
      ];

      // Mock findMany to return different results based on the where clause
      prismaService.workflowSchedule.findMany = jest.fn().mockImplementation((args: any) => {
        // First call: find due schedules
        if (args.where?.nextRunAt) {
          return Promise.resolve([mockSchedule]);
        }
        // Second call: find other schedules (with scheduleId: { not: ... })
        if (args.where?.scheduleId?.not) {
          return Promise.resolve(otherSchedules);
        }
        return Promise.resolve([]);
      });

      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowSchedule.updateMany = jest.fn().mockResolvedValue({ count: 2 });
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});
      prismaService.workflowScheduleRecord.updateMany = jest.fn().mockResolvedValue({ count: 0 });
      prismaService.canvas.findUnique = jest.fn().mockResolvedValue({ title: 'Test' });
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue(null); // Free tier
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(3); // 3 active schedules
      prismaService.user.findUnique = jest.fn().mockResolvedValue({
        uid: 'user-789',
        email: 'test@example.com',
        nickname: 'Test User',
      });
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);
      scheduleService.createOrUpdateScheduledRecord = jest.fn().mockResolvedValue(undefined);

      await service.scanAndTriggerSchedules();

      // Debugging why updateMany is not called
      // console.log('Count mock calls:', prismaService.workflowSchedule.count.mock.calls.length);
      // console.log('UpdateMany mock calls:', prismaService.workflowSchedule.updateMany.mock.calls.length);

      // Should disable 2 schedules (3 active - 1 limit = 2 to disable)
      expect(prismaService.workflowSchedule.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            scheduleId: { in: ['schedule-2', 'schedule-3'] },
          },
          data: {
            isEnabled: false,
            nextRunAt: null,
          },
        }),
      );

      // Should still execute the current schedule
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should remove pending jobs from queue when schedules are disabled', async () => {
      const otherSchedules = [
        { scheduleId: 'schedule-2', name: 'Schedule 2', createdAt: new Date('2024-01-02') },
      ];

      // Mock a pending job in the queue for the schedule that will be disabled
      const mockJob = {
        id: 'job-for-schedule-2',
        data: { scheduleId: 'schedule-2' },
        remove: jest.fn().mockResolvedValue(undefined),
      };
      mockQueue.getJobs = jest.fn().mockResolvedValue([mockJob]);

      prismaService.workflowSchedule.findMany = jest.fn().mockImplementation((args: any) => {
        if (args.where?.nextRunAt) {
          return Promise.resolve([mockSchedule]);
        }
        if (args.where?.scheduleId?.not) {
          return Promise.resolve(otherSchedules);
        }
        return Promise.resolve([]);
      });

      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowSchedule.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});
      prismaService.workflowScheduleRecord.updateMany = jest.fn().mockResolvedValue({ count: 0 });
      prismaService.canvas.findUnique = jest.fn().mockResolvedValue({ title: 'Test' });
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue(null); // Free tier (limit 1)
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(2); // 2 active schedules > 1 limit
      prismaService.user.findUnique = jest.fn().mockResolvedValue({
        uid: 'user-789',
        email: 'test@example.com',
        nickname: 'Test User',
      });
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);
      scheduleService.createOrUpdateScheduledRecord = jest.fn().mockResolvedValue(undefined);

      await service.scanAndTriggerSchedules();

      // Verify getJobs was called to find pending jobs
      expect(mockQueue.getJobs).toHaveBeenCalledWith(['waiting', 'delayed']);

      // Verify the job for the disabled schedule was removed
      expect(mockJob.remove).toHaveBeenCalled();
    });

    it('should skip schedules that were disabled during batch processing', async () => {
      // This test verifies that if schedule B is disabled by schedule A's quota check,
      // schedule B will be skipped when it's processed later in the same batch
      const scheduleA = { ...mockSchedule, scheduleId: 'schedule-A' };
      const scheduleB = { ...mockSchedule, scheduleId: 'schedule-B' };

      prismaService.workflowSchedule.findMany = jest.fn().mockResolvedValue([scheduleA, scheduleB]);

      // Track findUnique calls to simulate B being disabled after A's processing
      let findUniqueCallCount = 0;
      prismaService.workflowSchedule.findUnique = jest.fn().mockImplementation(() => {
        findUniqueCallCount++;
        // First call (for schedule A): enabled
        // Second call (for schedule B): disabled (simulating it was disabled by A's quota check)
        if (findUniqueCallCount === 1) {
          return Promise.resolve({ isEnabled: true, deletedAt: null });
        }
        return Promise.resolve({ isEnabled: false, deletedAt: null });
      });

      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});
      prismaService.canvas.findUnique = jest.fn().mockResolvedValue({ title: 'Test' });
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue({ uid: 'user-789' });
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(1);
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);
      scheduleService.createOrUpdateScheduledRecord = jest.fn().mockResolvedValue(undefined);

      await service.scanAndTriggerSchedules();

      // Only schedule A should be processed (added to queue)
      // Schedule B should be skipped because it was disabled
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'execute-scheduled-workflow',
        expect.objectContaining({ scheduleId: 'schedule-A' }),
        expect.any(Object),
      );
    });
  });

  describe('onModuleInit', () => {
    it('should log initialization message', () => {
      // This test just verifies no errors during initialization
      expect(() => service.onModuleInit()).not.toThrow();
    });
  });
});

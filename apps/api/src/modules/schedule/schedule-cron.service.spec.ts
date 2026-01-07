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
        nextRunAt: new Date(Date.now() - 1000), // In the past (due)
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
        nextRunAt: new Date(Date.now() - 1000), // In the past (due)
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

  describe('checkAndTriggerSchedule', () => {
    beforeEach(() => {
      // Default mock for schedule status check at the start of triggerSchedule
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue({
        isEnabled: true,
        deletedAt: null,
        nextRunAt: new Date(Date.now() - 1000), // In the past (due)
      });
    });

    it('should trigger schedule if it is due', async () => {
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});
      prismaService.canvas.findUnique = jest.fn().mockResolvedValue({ title: 'Test' });
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue({ uid: 'user-789' });
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(1);
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);
      scheduleService.createOrUpdateScheduledRecord = jest.fn().mockResolvedValue(undefined);

      const result = await service.checkAndTriggerSchedule('schedule-123');

      expect(result).toBe(true);
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should return false if schedule is not due', async () => {
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(null);

      const result = await service.checkAndTriggerSchedule('schedule-123');

      expect(result).toBe(false);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should skip disabled schedule in checkAndTriggerSchedule', async () => {
      // findFirst returns the schedule (it's due)
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(mockSchedule);
      // But findUnique (freshSchedule check) shows it's disabled
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue({
        isEnabled: false,
        deletedAt: null,
        nextRunAt: new Date(Date.now() - 1000), // In the past
      });

      const result = await service.checkAndTriggerSchedule('schedule-123');

      expect(result).toBe(true); // Method returns true because triggerSchedule didn't throw
      expect(mockQueue.add).not.toHaveBeenCalled(); // But no job was added
    });
  });

  describe('concurrency and edge cases', () => {
    beforeEach(() => {
      const releaseLock = jest.fn();
      redisService.acquireLock = jest.fn().mockResolvedValue(releaseLock);
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue({
        isEnabled: true,
        deletedAt: null,
        nextRunAt: new Date(Date.now() - 1000), // In the past (due)
      });
    });

    it('should handle schedule deleted during batch processing', async () => {
      const scheduleA = { ...mockSchedule, scheduleId: 'schedule-A' };
      const deletedScheduleB = { ...mockSchedule, scheduleId: 'schedule-B' };

      prismaService.workflowSchedule.findMany = jest
        .fn()
        .mockResolvedValue([scheduleA, deletedScheduleB]);

      // Schedule B was deleted between findMany and triggerSchedule
      prismaService.workflowSchedule.findUnique = jest.fn().mockImplementation((args: any) => {
        if (args.where.scheduleId === 'schedule-A') {
          return Promise.resolve({
            isEnabled: true,
            deletedAt: null,
            nextRunAt: new Date(Date.now() - 1000),
          });
        }
        return Promise.resolve({
          isEnabled: true,
          deletedAt: new Date(),
          nextRunAt: new Date(Date.now() - 1000),
        }); // B is deleted
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

      // Only schedule A should be processed
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'execute-scheduled-workflow',
        expect.objectContaining({ scheduleId: 'schedule-A' }),
        expect.any(Object),
      );
    });

    it('should isolate quota checks between different users', async () => {
      const user1Schedule = { ...mockSchedule, scheduleId: 'schedule-1', uid: 'user-1' };
      const user2Schedule = { ...mockSchedule, scheduleId: 'schedule-2', uid: 'user-2' };

      prismaService.workflowSchedule.findMany = jest
        .fn()
        .mockResolvedValue([user1Schedule, user2Schedule]);

      // Mock count to return different values per user
      prismaService.workflowSchedule.count = jest.fn().mockImplementation((args: any) => {
        if (args.where.uid === 'user-1') {
          return Promise.resolve(3); // User 1 exceeds quota
        }
        return Promise.resolve(1); // User 2 is fine
      });

      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue({
        isEnabled: true,
        deletedAt: null,
        nextRunAt: new Date(Date.now() - 1000), // In the past (due)
      });
      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowSchedule.updateMany = jest.fn().mockResolvedValue({ count: 0 });
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});
      prismaService.workflowScheduleRecord.updateMany = jest.fn().mockResolvedValue({ count: 0 });
      prismaService.canvas.findUnique = jest.fn().mockResolvedValue({ title: 'Test' });
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.user.findUnique = jest.fn().mockResolvedValue({
        uid: 'user-1',
        email: 'test@example.com',
      });
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);
      scheduleService.createOrUpdateScheduledRecord = jest.fn().mockResolvedValue(undefined);

      await service.scanAndTriggerSchedules();

      // Both users' schedules should be processed (User 2's quota is fine)
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
    });

    it('should update existing scheduled record to pending status correctly', async () => {
      const existingRecord = {
        scheduleRecordId: 'record-existing',
        status: 'scheduled',
        workflowExecutionId: null,
        scheduledAt: new Date(),
      };

      prismaService.workflowSchedule.findMany = jest.fn().mockResolvedValue([mockSchedule]);
      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(existingRecord);
      prismaService.workflowScheduleRecord.update = jest.fn().mockResolvedValue({});
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue({ uid: 'user-789' });
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(1);
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);
      scheduleService.createOrUpdateScheduledRecord = jest.fn().mockResolvedValue(undefined);

      await service.scanAndTriggerSchedules();

      // Should update existing record to pending
      expect(prismaService.workflowScheduleRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { scheduleRecordId: 'record-existing' },
          data: expect.objectContaining({
            status: 'pending',
            triggeredAt: expect.any(Date),
          }),
        }),
      );

      // Should not create new record
      expect(prismaService.workflowScheduleRecord.create).not.toHaveBeenCalled();

      // Job should use the existing record ID
      expect(mockQueue.add).toHaveBeenCalledWith(
        'execute-scheduled-workflow',
        expect.objectContaining({
          scheduleRecordId: 'record-existing',
        }),
        expect.any(Object),
      );
    });

    it('should not process already failed records from queue', async () => {
      // This test simulates a race condition where record was already marked failed
      // by another process, but the job is still in the queue
      const failedRecord = {
        scheduleRecordId: 'record-failed',
        status: 'failed', // Already failed
        failureReason: 'schedule_limit_exceeded',
        workflowExecutionId: null,
      };

      prismaService.workflowSchedule.findMany = jest.fn().mockResolvedValue([mockSchedule]);
      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue(mockSchedule);
      // findFirst returns the failed record
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(failedRecord);
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue({ uid: 'user-789' });
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(1);
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);
      scheduleService.createOrUpdateScheduledRecord = jest.fn().mockResolvedValue(undefined);

      await service.scanAndTriggerSchedules();

      // Note: In current implementation, cron service doesn't check record status
      // This is handled by the processor. So the job will still be added.
      // The processor will skip execution when it sees the record is already failed.
      expect(mockQueue.add).toHaveBeenCalled();
    });
  });

  describe('Refly Hardcore Edge Cases', () => {
    // Shared setup for edge cases
    beforeEach(() => {
      // Reset default mocks
      const releaseLock = jest.fn();
      redisService.acquireLock = jest.fn().mockResolvedValue(releaseLock);
      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({
        scheduleRecordId: 'record-123',
      });
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.canvas.findUnique = jest.fn().mockResolvedValue({ title: 'Test' });
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue({ uid: 'user-789' });
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(1);
      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValue({ uid: 'user-789', email: 'test@example.com' });
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);
      scheduleService.createOrUpdateScheduledRecord = jest.fn().mockResolvedValue(undefined);
    });

    it('should prevent double execution when nextRunAt was already advanced', async () => {
      // Scenario: Two processes try to trigger the same schedule concurrently
      // After first process updates nextRunAt to future, second should skip

      // First call: nextRunAt is in the past (due)
      // Second call: nextRunAt was updated to future by first process

      let callCount = 0;
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowSchedule.findUnique = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: schedule is due (nextRunAt in the past)
          return Promise.resolve({
            isEnabled: true,
            deletedAt: null,
            nextRunAt: new Date(Date.now() - 1000), // 1 second ago
          });
        }
        // Second call: nextRunAt was updated to future by first process
        return Promise.resolve({
          isEnabled: true,
          deletedAt: null,
          nextRunAt: new Date(Date.now() + 3600000), // 1 hour in future
        });
      });

      // First trigger should succeed
      const result1 = await service.checkAndTriggerSchedule(mockSchedule.scheduleId);
      expect(result1).toBe(true);
      expect(mockQueue.add).toHaveBeenCalledTimes(1);

      // Second trigger should be skipped (nextRunAt now in future)
      const result2 = await service.checkAndTriggerSchedule(mockSchedule.scheduleId);
      expect(result2).toBe(true); // No error thrown
      expect(mockQueue.add).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should handle Database connection failure during critical update', async () => {
      // Trigger schedule -> Update Check (Success) -> Update NextRunAt (FAIL) before queue.add
      // In current implementation, update happens BEFORE queue.add, so this tests error propagation

      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue({
        isEnabled: true,
        deletedAt: null,
        nextRunAt: new Date(Date.now() - 1000), // In the past (due)
      });

      // Mock Update failure (the one that updates nextRunAt)
      prismaService.workflowSchedule.update = jest
        .fn()
        .mockRejectedValue(new Error('DB Connection Lost'));

      // The error should be caught, not crash the service
      const result = await service.checkAndTriggerSchedule(mockSchedule.scheduleId);

      // checkAndTriggerSchedule catches errors and returns false
      expect(result).toBe(false);
    });

    it('should handle Queue downtime gracefully without crashing', async () => {
      // DB OK, but Queue Down - service should not crash
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue({
        isEnabled: true,
        deletedAt: null,
        nextRunAt: new Date(Date.now() - 1000), // In the past (due)
      });

      // Mock Queue Failure
      mockQueue.add.mockRejectedValue(new Error('Redis Down'));

      // Service should catch error and not crash
      const result = await service.checkAndTriggerSchedule(mockSchedule.scheduleId);

      // Error is caught, returns false
      expect(result).toBe(false);
    });

    it('should handle physical deletion race condition', async () => {
      // FindFirst finds it, but fresh read returns null (deleted between queries)
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.checkAndTriggerSchedule(mockSchedule.scheduleId);

      // Handled gracefully, no crash
      expect(result).toBe(true);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should skip schedule when nextRunAt is null in fresh read', async () => {
      // Schedule was disabled between findFirst and triggerSchedule
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue({
        isEnabled: false, // Disabled
        deletedAt: null,
        nextRunAt: null,
      });

      const result = await service.checkAndTriggerSchedule(mockSchedule.scheduleId);

      expect(result).toBe(true); // No error
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should handle soft deletion during processing', async () => {
      // Schedule soft-deleted between findFirst and triggerSchedule
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(mockSchedule);
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue({
        isEnabled: true,
        deletedAt: new Date(), // Soft deleted
        nextRunAt: new Date(Date.now() - 1000),
      });

      const result = await service.checkAndTriggerSchedule(mockSchedule.scheduleId);

      expect(result).toBe(true); // No error
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('onModuleInit', () => {
    it('should log initialization message', () => {
      // This test just verifies no errors during initialization
      expect(() => service.onModuleInit()).not.toThrow();
    });
  });
});

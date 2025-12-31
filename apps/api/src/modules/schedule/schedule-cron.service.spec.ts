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
    cronExpression: '0 * * * *',
    timezone: 'Asia/Shanghai',
    isEnabled: true,
    nextRunAt: new Date(),
    deletedAt: null,
    scheduleConfig: null,
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
            get: jest.fn().mockReturnValue('https://refly.ai'),
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
  });

  describe('onModuleInit', () => {
    it('should log initialization message', () => {
      // This test just verifies no errors during initialization
      expect(() => service.onModuleInit()).not.toThrow();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { ScheduleService } from './schedule.service';
import { ScheduleCronService } from './schedule-cron.service';
import { PrismaService } from '../common/prisma.service';
import { ObjectStorageService } from '../common/object-storage';
import { OSS_INTERNAL } from '../common/object-storage/tokens';
import { SchedulePriorityService } from './schedule-priority.service';
import { QUEUE_SCHEDULE_EXECUTION, DEFAULT_SCHEDULE_CONFIG } from './schedule.constants';

describe('ScheduleService', () => {
  let service: ScheduleService;
  let prismaService: jest.Mocked<PrismaService>;
  let ossService: jest.Mocked<ObjectStorageService>;
  let priorityService: jest.Mocked<SchedulePriorityService>;
  let mockQueue: jest.Mocked<Queue>;

  const mockUser = { uid: 'test-uid' };
  const mockScheduleId = 'schedule-123';
  const mockCanvasId = 'canvas-456';

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockPrisma = createMock<PrismaService>();
    const mockOss = createMock<ObjectStorageService>();
    const mockPriority = createMock<SchedulePriorityService>();
    const mockCronService = createMock<ScheduleCronService>();
    // Ensure checkAndTriggerSchedule returns a proper Promise
    mockCronService.checkAndTriggerSchedule = jest.fn().mockResolvedValue(true);
    const mockConfigService = createMock<ConfigService>();
    // Return undefined for all config.get calls to use defaults
    mockConfigService.get.mockReturnValue(undefined);
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    } as unknown as jest.Mocked<Queue>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OSS_INTERNAL, useValue: mockOss },
        { provide: getQueueToken(QUEUE_SCHEDULE_EXECUTION), useValue: mockQueue },
        { provide: SchedulePriorityService, useValue: mockPriority },
        { provide: ScheduleCronService, useValue: mockCronService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ScheduleService>(ScheduleService);
    prismaService = module.get(PrismaService);
    ossService = module.get(OSS_INTERNAL);
    priorityService = module.get(SchedulePriorityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSchedule', () => {
    const validDto = {
      canvasId: mockCanvasId,
      name: 'Test Schedule',
      cronExpression: '0 * * * *', // Every hour
      scheduleConfig: '{}',
      timezone: 'Asia/Shanghai',
      isEnabled: true,
    };

    it('should create a schedule successfully', async () => {
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);
      prismaService.canvas.findUnique = jest
        .fn()
        .mockResolvedValue({ title: 'Test Canvas', uid: mockUser.uid });
      prismaService.workflowSchedule.create = jest.fn().mockResolvedValue({
        scheduleId: mockScheduleId,
        ...validDto,
        nextRunAt: new Date(),
      });
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});

      const result = await service.createSchedule(mockUser.uid, validDto);

      expect(result.scheduleId).toBe(mockScheduleId);
      expect(prismaService.workflowSchedule.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid cron expression', async () => {
      const invalidDto = { ...validDto, cronExpression: 'invalid-cron' };

      await expect(service.createSchedule(mockUser.uid, invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update existing schedule if one exists for the canvas', async () => {
      const existingSchedule = {
        scheduleId: mockScheduleId,
        canvasId: mockCanvasId,
        uid: mockUser.uid,
        cronExpression: '0 0 * * *',
        isEnabled: false,
        nextRunAt: null,
        deletedAt: null,
      };

      prismaService.canvas.findUnique = jest
        .fn()
        .mockResolvedValue({ title: 'Test Canvas', uid: mockUser.uid });
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(existingSchedule);
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0); // Add count mock
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue(existingSchedule);
      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue({
        ...existingSchedule,
        ...validDto,
        nextRunAt: new Date(),
      });
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});

      const _result = await service.createSchedule(mockUser.uid, validDto);

      expect(prismaService.workflowSchedule.update).toHaveBeenCalled();
      expect(prismaService.workflowSchedule.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when quota exceeded for free user', async () => {
      prismaService.canvas.findUnique = jest
        .fn()
        .mockResolvedValue({ title: 'Test Canvas', uid: mockUser.uid });
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(null);
      // Free user (no subscription) has quota of 1
      prismaService.workflowSchedule.count = jest
        .fn()
        .mockResolvedValue(DEFAULT_SCHEDULE_CONFIG.freeMaxActiveSchedules);
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.createSchedule(mockUser.uid, validDto)).rejects.toThrow(
        'schedule_limit_exceeded',
      );
    });

    it('should throw BadRequestException when quota exceeded for paid user', async () => {
      prismaService.canvas.findUnique = jest
        .fn()
        .mockResolvedValue({ title: 'Test Canvas', uid: mockUser.uid });
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(null);
      // Paid user has quota of 20
      prismaService.workflowSchedule.count = jest
        .fn()
        .mockResolvedValue(DEFAULT_SCHEDULE_CONFIG.paidMaxActiveSchedules);
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
        lookupKey: 'refly_plus_monthly_stable_v2',
        status: 'active',
      });

      await expect(service.createSchedule(mockUser.uid, validDto)).rejects.toThrow(
        'schedule_limit_exceeded',
      );
    });

    it('should allow paid user to create more schedules than free user', async () => {
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(null);
      // 5 schedules - exceeds free limit (1) but under paid limit (20)
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(5);
      prismaService.subscription.findFirst = jest.fn().mockResolvedValue({
        lookupKey: 'refly_plus_monthly_stable_v2',
        status: 'active',
      });
      prismaService.canvas.findUnique = jest
        .fn()
        .mockResolvedValue({ title: 'Test Canvas', uid: mockUser.uid });
      prismaService.workflowSchedule.create = jest.fn().mockResolvedValue({
        scheduleId: mockScheduleId,
        ...validDto,
        nextRunAt: new Date(),
      });
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});

      // Should NOT throw for paid user with 5 schedules
      const result = await service.createSchedule(mockUser.uid, validDto);
      expect(result.scheduleId).toBe(mockScheduleId);
    });

    it('should use canvas title as default name if name not provided', async () => {
      const dtoWithoutName = { ...validDto, name: undefined };
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);
      prismaService.canvas.findUnique = jest
        .fn()
        .mockResolvedValue({ title: 'Canvas Title', uid: mockUser.uid });
      prismaService.workflowSchedule.create = jest.fn().mockImplementation((args) => {
        return Promise.resolve({
          scheduleId: mockScheduleId,
          ...args.data,
        });
      });
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});

      await service.createSchedule(mockUser.uid, dtoWithoutName as any);

      expect(prismaService.workflowSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Canvas Title',
          }),
        }),
      );
    });

    it('should not set nextRunAt when isEnabled is false', async () => {
      const disabledDto = { ...validDto, isEnabled: false };
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);
      prismaService.canvas.findUnique = jest
        .fn()
        .mockResolvedValue({ title: 'Test Canvas', uid: mockUser.uid });
      prismaService.workflowSchedule.create = jest.fn().mockImplementation((args) => {
        return Promise.resolve({
          scheduleId: mockScheduleId,
          ...args.data,
        });
      });

      await service.createSchedule(mockUser.uid, disabledDto);

      expect(prismaService.workflowSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nextRunAt: null,
          }),
        }),
      );
    });
  });

  describe('updateSchedule', () => {
    const existingSchedule = {
      scheduleId: mockScheduleId,
      canvasId: mockCanvasId,
      uid: mockUser.uid,
      cronExpression: '0 * * * *',
      timezone: 'Asia/Shanghai',
      isEnabled: true,
      nextRunAt: new Date(),
      deletedAt: null,
    };

    it('should update schedule successfully', async () => {
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue(existingSchedule);
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(existingSchedule);
      prismaService.canvas.findUnique = jest
        .fn()
        .mockResolvedValue({ title: 'Test Canvas', uid: mockUser.uid });
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);
      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue({
        ...existingSchedule,
        cronExpression: '0 0 * * *',
      });
      prismaService.canvas.update = jest.fn().mockResolvedValue({});
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});
      prismaService.workflowScheduleRecord.upsert = jest.fn().mockResolvedValue({});

      const _result = await service.updateSchedule(mockUser.uid, mockScheduleId, {
        cronExpression: '0 0 * * *',
      });

      expect(prismaService.workflowSchedule.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent schedule', async () => {
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        service.updateSchedule(mockUser.uid, mockScheduleId, { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for deleted schedule', async () => {
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue({
        ...existingSchedule,
        deletedAt: new Date(),
      });

      await expect(
        service.updateSchedule(mockUser.uid, mockScheduleId, { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when uid does not match', async () => {
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue({
        ...existingSchedule,
        uid: 'other-uid',
      });

      await expect(
        service.updateSchedule(mockUser.uid, mockScheduleId, { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid cron expression', async () => {
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue(existingSchedule);

      await expect(
        service.updateSchedule(mockUser.uid, mockScheduleId, { cronExpression: 'invalid' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set nextRunAt to null when disabling', async () => {
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue(existingSchedule);
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(existingSchedule);
      prismaService.canvas.findUnique = jest
        .fn()
        .mockResolvedValue({ title: 'Test Canvas', uid: mockUser.uid });
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);
      prismaService.workflowSchedule.update = jest.fn().mockImplementation((args) => {
        return Promise.resolve({ ...existingSchedule, ...args.data });
      });
      prismaService.canvas.update = jest.fn().mockResolvedValue({});
      prismaService.workflowScheduleRecord.deleteMany = jest.fn().mockResolvedValue({ count: 0 });

      await service.updateSchedule(mockUser.uid, mockScheduleId, { isEnabled: false });

      expect(prismaService.workflowSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nextRunAt: null,
          }),
        }),
      );
    });

    it('should recalculate nextRunAt when changing cron expression', async () => {
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue(existingSchedule);
      prismaService.workflowSchedule.findFirst = jest.fn().mockResolvedValue(existingSchedule);
      prismaService.canvas.findUnique = jest
        .fn()
        .mockResolvedValue({ title: 'Test Canvas', uid: mockUser.uid });
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);
      prismaService.workflowSchedule.update = jest.fn().mockImplementation((args) => {
        return Promise.resolve({ ...existingSchedule, ...args.data });
      });
      prismaService.canvas.update = jest.fn().mockResolvedValue({});
      prismaService.workflowScheduleRecord.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});
      prismaService.workflowScheduleRecord.upsert = jest.fn().mockResolvedValue({});

      await service.updateSchedule(mockUser.uid, mockScheduleId, { cronExpression: '0 0 * * *' });

      expect(prismaService.workflowSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nextRunAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('deleteSchedule', () => {
    const existingSchedule = {
      scheduleId: mockScheduleId,
      uid: mockUser.uid,
      deletedAt: null,
    };

    it('should soft delete schedule successfully', async () => {
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue(existingSchedule);
      prismaService.workflowSchedule.update = jest.fn().mockResolvedValue({
        ...existingSchedule,
        deletedAt: new Date(),
        isEnabled: false,
        nextRunAt: null,
      });

      const _result = await service.deleteSchedule(mockUser.uid, mockScheduleId);

      expect(prismaService.workflowSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
            isEnabled: false,
            nextRunAt: null,
          }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent schedule', async () => {
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.deleteSchedule(mockUser.uid, mockScheduleId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSchedule', () => {
    it('should return schedule when found', async () => {
      const schedule = {
        scheduleId: mockScheduleId,
        uid: mockUser.uid,
        deletedAt: null,
        pk: BigInt(1),
      };
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue(schedule);

      const result = await service.getSchedule(mockUser.uid, mockScheduleId);

      expect(result.scheduleId).toBe(mockScheduleId);
      expect(result).not.toHaveProperty('pk'); // Should exclude pk
    });

    it('should throw NotFoundException for non-existent schedule', async () => {
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getSchedule(mockUser.uid, mockScheduleId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('triggerScheduleManually', () => {
    const schedule = {
      scheduleId: mockScheduleId,
      canvasId: mockCanvasId,
      uid: mockUser.uid,
      deletedAt: null,
    };

    it('should trigger schedule manually and add to queue', async () => {
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue(schedule);
      prismaService.canvas.findUnique = jest.fn().mockResolvedValue({ title: 'Test Canvas' });
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({
        scheduleRecordId: 'record-123',
      });
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);

      const result = await service.triggerScheduleManually(mockUser.uid, mockScheduleId);

      expect(result.scheduleId).toBe(mockScheduleId);
      expect(result.priority).toBe(5);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'execute-scheduled-workflow',
        expect.objectContaining({
          scheduleId: mockScheduleId,
          canvasId: mockCanvasId,
          priority: 5,
        }),
        expect.any(Object),
      );
    });

    it('should throw NotFoundException for non-existent schedule', async () => {
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.triggerScheduleManually(mockUser.uid, mockScheduleId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create schedule record with pending status', async () => {
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue(schedule);
      prismaService.canvas.findUnique = jest.fn().mockResolvedValue({ title: 'Test Canvas' });
      prismaService.workflowScheduleRecord.create = jest.fn().mockResolvedValue({});
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);

      await service.triggerScheduleManually(mockUser.uid, mockScheduleId);

      expect(prismaService.workflowScheduleRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending',
            priority: 5,
          }),
        }),
      );
    });
  });

  describe('retryScheduleRecord', () => {
    const failedRecord = {
      scheduleRecordId: 'record-123',
      scheduleId: mockScheduleId,
      canvasId: mockCanvasId,
      uid: mockUser.uid,
      status: 'failed',
      snapshotStorageKey: 'schedules/test-uid/record-123/snapshot.json',
    };

    const schedule = {
      scheduleId: mockScheduleId,
      deletedAt: null,
    };

    it('should retry failed record successfully', async () => {
      prismaService.workflowScheduleRecord.findUnique = jest.fn().mockResolvedValue(failedRecord);
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue(schedule);
      prismaService.workflowScheduleRecord.update = jest.fn().mockResolvedValue({});
      priorityService.calculateExecutionPriority = jest.fn().mockResolvedValue(5);

      const result = await service.retryScheduleRecord(mockUser.uid, failedRecord.scheduleRecordId);

      expect(result.status).toBe('pending');
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent record', async () => {
      prismaService.workflowScheduleRecord.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        service.retryScheduleRecord(mockUser.uid, 'non-existent-record'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for non-failed record', async () => {
      prismaService.workflowScheduleRecord.findUnique = jest.fn().mockResolvedValue({
        ...failedRecord,
        status: 'success',
      });

      await expect(
        service.retryScheduleRecord(mockUser.uid, failedRecord.scheduleRecordId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no snapshot available', async () => {
      prismaService.workflowScheduleRecord.findUnique = jest.fn().mockResolvedValue({
        ...failedRecord,
        snapshotStorageKey: null,
      });

      await expect(
        service.retryScheduleRecord(mockUser.uid, failedRecord.scheduleRecordId),
      ).rejects.toThrow('No snapshot available for retry');
    });

    it('should throw NotFoundException when associated schedule is deleted', async () => {
      prismaService.workflowScheduleRecord.findUnique = jest.fn().mockResolvedValue(failedRecord);
      prismaService.workflowSchedule.findUnique = jest.fn().mockResolvedValue({
        ...schedule,
        deletedAt: new Date(),
      });

      await expect(
        service.retryScheduleRecord(mockUser.uid, failedRecord.scheduleRecordId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listSchedules', () => {
    it('should return paginated schedules', async () => {
      const schedules = [
        { scheduleId: 'schedule-1', pk: BigInt(1) },
        { scheduleId: 'schedule-2', pk: BigInt(2) },
      ];
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(2);
      prismaService.workflowSchedule.findMany = jest.fn().mockResolvedValue(schedules);

      const result = await service.listSchedules(mockUser.uid, undefined, 1, 10);

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).not.toHaveProperty('pk');
    });

    it('should filter by canvasId when provided', async () => {
      prismaService.workflowSchedule.count = jest.fn().mockResolvedValue(0);
      prismaService.workflowSchedule.findMany = jest.fn().mockResolvedValue([]);

      await service.listSchedules(mockUser.uid, mockCanvasId, 1, 10);

      expect(prismaService.workflowSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            canvasId: mockCanvasId,
          }),
        }),
      );
    });
  });

  describe('getRecordSnapshot', () => {
    it('should return parsed snapshot', async () => {
      const record = {
        scheduleRecordId: 'record-123',
        uid: mockUser.uid,
        snapshotStorageKey: 'schedules/test-uid/record-123/snapshot.json',
      };
      const snapshotData = { title: 'Test Canvas', nodes: [], edges: [] };

      prismaService.workflowScheduleRecord.findUnique = jest.fn().mockResolvedValue(record);
      ossService.getObject = jest.fn().mockResolvedValue({
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify(snapshotData));
        },
      });

      const result = await service.getRecordSnapshot(mockUser.uid, record.scheduleRecordId);

      expect(result).toEqual(snapshotData);
    });

    it('should throw NotFoundException when no snapshot key', async () => {
      prismaService.workflowScheduleRecord.findUnique = jest.fn().mockResolvedValue({
        scheduleRecordId: 'record-123',
        uid: mockUser.uid,
        snapshotStorageKey: null,
      });

      await expect(service.getRecordSnapshot(mockUser.uid, 'record-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid JSON', async () => {
      const record = {
        scheduleRecordId: 'record-123',
        uid: mockUser.uid,
        snapshotStorageKey: 'schedules/test-uid/record-123/snapshot.json',
      };

      prismaService.workflowScheduleRecord.findUnique = jest.fn().mockResolvedValue(record);
      ossService.getObject = jest.fn().mockResolvedValue({
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('invalid-json');
        },
      });

      await expect(
        service.getRecordSnapshot(mockUser.uid, record.scheduleRecordId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

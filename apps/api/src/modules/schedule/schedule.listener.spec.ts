import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleEventListener } from './schedule.listener';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { NotificationService } from '../notification/notification.service';
import { CreditService } from '../credit/credit.service';
import { ConfigService } from '@nestjs/config';
import { WorkflowCompletedEvent, WorkflowFailedEvent } from '../workflow/workflow.events';
import { CanvasDeletedEvent } from '../canvas/canvas.events';
import {
  generateScheduleSuccessEmail,
  generateScheduleFailedEmail,
} from './schedule-email-templates';
import { ScheduleFailureReason } from './schedule.constants';

// Mock schedule-email-templates
jest.mock('./schedule-email-templates', () => ({
  generateScheduleSuccessEmail: jest.fn().mockReturnValue({
    subject: 'Success Subject',
    html: 'Success HTML',
  }),
  generateScheduleFailedEmail: jest.fn().mockReturnValue({
    subject: 'Failed Subject',
    html: 'Failed HTML',
  }),
  formatDateTime: jest.fn().mockReturnValue('2026-01-05 12:00:00'),
}));

describe('ScheduleEventListener', () => {
  let listener: ScheduleEventListener;
  let prismaService: PrismaService;
  let notificationService: NotificationService;
  let creditService: CreditService;
  let redisService: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleEventListener,
        {
          provide: PrismaService,
          useValue: {
            workflowScheduleRecord: {
              update: jest.fn(),
              updateMany: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            workflowSchedule: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              updateMany: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            decr: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendEmail: jest.fn(),
          },
        },
        {
          provide: CreditService,
          useValue: {
            countExecutionCreditUsageByExecutionId: jest.fn().mockResolvedValue(100),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('https://refly.ai'),
          },
        },
      ],
    }).compile();

    listener = module.get<ScheduleEventListener>(ScheduleEventListener);
    prismaService = module.get<PrismaService>(PrismaService);
    notificationService = module.get<NotificationService>(NotificationService);
    creditService = module.get<CreditService>(CreditService);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  describe('handleWorkflowCompleted', () => {
    it('should ignore events without scheduleId', async () => {
      const event = new WorkflowCompletedEvent(
        'exec-1',
        'canvas-1',
        'user-1',
        'manual',
        {},
        1000,
        undefined,
      );
      await listener.handleWorkflowCompleted(event);
      expect(prismaService.workflowScheduleRecord.update).not.toHaveBeenCalled();
    });

    it('should update schedule record and send success email', async () => {
      const event = new WorkflowCompletedEvent(
        'exec-1',
        'canvas-1',
        'user-1',
        'scheduled',
        {},
        1000,
        'schedule-record-1',
      );

      const mockUser = {
        uid: 'user-1',
        email: 'test@example.com',
        nickname: 'Test User',
      };

      const mockScheduleRecord = {
        scheduleRecordId: 'schedule-record-1',
        workflowTitle: 'My Workflow',
        scheduleId: 'schedule-1',
      };

      // Mock getScheduleRecord (first call - returns uid only)
      // First call: getScheduleRecord - returns uid only (has select field)
      // Second call: sendEmail - returns full schedule record (no select)
      jest
        .spyOn(prismaService.workflowScheduleRecord, 'findUnique')
        .mockResolvedValueOnce({ uid: 'user-1' } as any)
        .mockResolvedValueOnce(mockScheduleRecord as any);

      // Mock sendEmail calls
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prismaService.workflowSchedule, 'findUnique').mockResolvedValue({
        scheduleId: 'schedule-1',
        cronExpression: '0 8 * * *',
        timezone: 'UTC',
      } as any);

      await listener.handleWorkflowCompleted(event);

      // Verify Redis counter decrement
      expect(redisService.decr).toHaveBeenCalled();

      // Verify credit usage calculation
      expect(creditService.countExecutionCreditUsageByExecutionId).toHaveBeenCalledWith(
        { uid: 'user-1' },
        'exec-1',
      );

      // Verify DB update with credit usage
      expect(prismaService.workflowScheduleRecord.update).toHaveBeenCalledWith({
        where: { scheduleRecordId: 'schedule-record-1' },
        data: expect.objectContaining({
          status: 'success',
          completedAt: expect.any(Date),
          creditUsed: 100,
        }),
      });

      // Verify Email Sending
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({ where: { uid: 'user-1' } });
      expect(generateScheduleSuccessEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          userName: 'Test User',
          scheduleName: 'My Workflow',
          nextRunTime: expect.not.stringMatching('Check Dashboard'),
        }),
      );
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        {
          to: 'test@example.com',
          subject: 'Success Subject',
          html: 'Success HTML',
        },
        mockUser,
      );
    });

    it('should handle missing schedule record gracefully', async () => {
      const event = new WorkflowCompletedEvent(
        'exec-1',
        'canvas-1',
        'user-1',
        'scheduled',
        {},
        1000,
        'schedule-record-1',
      );

      jest.spyOn(prismaService.workflowScheduleRecord, 'findUnique').mockResolvedValueOnce(null);

      await listener.handleWorkflowCompleted(event);

      expect(prismaService.workflowScheduleRecord.update).not.toHaveBeenCalled();
      expect(creditService.countExecutionCreditUsageByExecutionId).not.toHaveBeenCalled();
    });

    it('should handle credit calculation failure gracefully', async () => {
      const event = new WorkflowCompletedEvent(
        'exec-1',
        'canvas-1',
        'user-1',
        'scheduled',
        {},
        1000,
        'schedule-record-1',
      );

      jest
        .spyOn(creditService, 'countExecutionCreditUsageByExecutionId')
        .mockRejectedValueOnce(new Error('Credit calculation failed'));

      // Mock sendEmail calls
      const mockUser = {
        uid: 'user-1',
        email: 'test@example.com',
        nickname: 'Test User',
      };
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      // Mock findUnique calls: first for getScheduleRecord, second for sendEmail
      jest
        .spyOn(prismaService.workflowScheduleRecord, 'findUnique')
        .mockResolvedValueOnce({ uid: 'user-1' } as any)
        .mockResolvedValueOnce({
          scheduleRecordId: 'schedule-record-1',
          workflowTitle: 'My Workflow',
        } as any);
      jest.spyOn(prismaService.workflowSchedule, 'findUnique').mockResolvedValue({
        scheduleId: 'schedule-1',
        cronExpression: '0 8 * * *',
        timezone: 'UTC',
      } as any);

      await listener.handleWorkflowCompleted(event);

      // Should still update with creditUsed = 0 when calculation fails
      expect(prismaService.workflowScheduleRecord.update).toHaveBeenCalledWith({
        where: { scheduleRecordId: 'schedule-record-1' },
        data: expect.objectContaining({
          status: 'success',
          creditUsed: 0,
        }),
      });
    });
  });

  describe('handleWorkflowFailed', () => {
    it('should ignore events without scheduleId', async () => {
      const event = new WorkflowFailedEvent(
        'exec-1',
        'canvas-1',
        'user-1',
        'manual',
        {},
        1000,
        undefined,
      );
      await listener.handleWorkflowFailed(event);
      expect(prismaService.workflowScheduleRecord.update).not.toHaveBeenCalled();
    });

    it('should update schedule record with failure reason and send failed email', async () => {
      const errorDetails = { errorMessage: 'Some error' };
      const event = new WorkflowFailedEvent(
        'exec-1',
        'canvas-1',
        'user-1',
        'scheduled',
        errorDetails,
        1000,
        'schedule-record-1',
      );

      const mockUser = {
        uid: 'user-1',
        email: 'test@example.com',
        nickname: 'Test User',
      };

      const mockScheduleRecord = {
        scheduleRecordId: 'schedule-record-1',
        workflowTitle: 'My Workflow',
        scheduleId: 'schedule-1',
      };

      // Mock getScheduleRecord (first call - returns uid only)
      // First call: getScheduleRecord - returns uid only (has select field)
      // Second call: sendEmail - returns full schedule record (no select)
      jest
        .spyOn(prismaService.workflowScheduleRecord, 'findUnique')
        .mockResolvedValueOnce({ uid: 'user-1' } as any)
        .mockResolvedValueOnce(mockScheduleRecord as any);

      // Mock sendEmail calls
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prismaService.workflowSchedule, 'findUnique').mockResolvedValue({
        scheduleId: 'schedule-1',
        cronExpression: '0 8 * * *',
        timezone: 'UTC',
      } as any);

      await listener.handleWorkflowFailed(event);

      // Verify Redis counter decrement
      expect(redisService.decr).toHaveBeenCalled();

      // Verify credit usage calculation
      expect(creditService.countExecutionCreditUsageByExecutionId).toHaveBeenCalledWith(
        { uid: 'user-1' },
        'exec-1',
      );

      // Verify DB update with credit usage and error details
      expect(prismaService.workflowScheduleRecord.update).toHaveBeenCalledWith({
        where: { scheduleRecordId: 'schedule-record-1' },
        data: expect.objectContaining({
          status: 'failed',
          completedAt: expect.any(Date),
          creditUsed: 100,
          failureReason: expect.any(String),
          errorDetails: JSON.stringify(errorDetails),
        }),
      });

      // Verify Email Sending
      expect(generateScheduleFailedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          userName: 'Test User',
          scheduleName: 'My Workflow',
          nextRunTime: expect.not.stringMatching('Check Dashboard'),
        }),
      );
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        {
          to: 'test@example.com',
          subject: 'Failed Subject',
          html: 'Failed HTML',
        },
        mockUser,
      );
    });

    it('should handle Redis counter decrement failure gracefully', async () => {
      const event = new WorkflowFailedEvent(
        'exec-1',
        'canvas-1',
        'user-1',
        'scheduled',
        { errorMessage: 'Some error' },
        1000,
        'schedule-record-1',
      );

      jest.spyOn(redisService, 'decr').mockRejectedValueOnce(new Error('Redis error'));

      // Mock sendEmail calls
      const mockUser = {
        uid: 'user-1',
        email: 'test@example.com',
        nickname: 'Test User',
      };
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      // Mock findUnique calls: first for getScheduleRecord, second for sendEmail
      jest
        .spyOn(prismaService.workflowScheduleRecord, 'findUnique')
        .mockResolvedValueOnce({ uid: 'user-1' } as any)
        .mockResolvedValueOnce({
          scheduleRecordId: 'schedule-record-1',
          workflowTitle: 'My Workflow',
        } as any);
      jest.spyOn(prismaService.workflowSchedule, 'findUnique').mockResolvedValue({
        scheduleId: 'schedule-1',
        cronExpression: '0 8 * * *',
        timezone: 'UTC',
      } as any);

      await listener.handleWorkflowFailed(event);

      // Should still proceed with update despite Redis failure
      expect(prismaService.workflowScheduleRecord.update).toHaveBeenCalled();
    });
  });

  describe('handleCanvasDeleted', () => {
    it('should handle canvas with no associated schedules', async () => {
      const event = new CanvasDeletedEvent('canvas-1', 'user-1');

      jest.spyOn(prismaService.workflowSchedule, 'findMany').mockResolvedValue([]);

      // Spy on the actual method to verify it's called
      const handleCanvasDeletedSpy = jest.spyOn(listener, 'handleCanvasDeleted');

      await listener.handleCanvasDeleted(event);

      // Verify the real method was called
      expect(handleCanvasDeletedSpy).toHaveBeenCalledWith(event);
      expect(handleCanvasDeletedSpy).toHaveBeenCalledTimes(1);

      expect(prismaService.workflowSchedule.findMany).toHaveBeenCalledWith({
        where: { canvasId: 'canvas-1', uid: 'user-1', deletedAt: null },
        select: { scheduleId: true },
      });
      expect(prismaService.workflowSchedule.updateMany).not.toHaveBeenCalled();
      expect(prismaService.workflowScheduleRecord.updateMany).not.toHaveBeenCalled();
    });

    it('should disable schedules and skip pending records when canvas is deleted', async () => {
      const event = new CanvasDeletedEvent('canvas-1', 'user-1');

      const mockSchedules = [{ scheduleId: 'schedule-1' }, { scheduleId: 'schedule-2' }];

      jest
        .spyOn(prismaService.workflowSchedule, 'findMany')
        .mockResolvedValue(mockSchedules as any);
      jest
        .spyOn(prismaService.workflowSchedule, 'updateMany')
        .mockResolvedValue({ count: 2 } as any);
      jest
        .spyOn(prismaService.workflowScheduleRecord, 'updateMany')
        .mockResolvedValue({ count: 3 } as any);
      jest.spyOn(prismaService.workflowScheduleRecord, 'count').mockResolvedValue(0);

      await listener.handleCanvasDeleted(event);

      // Verify schedules are disabled and soft-deleted
      expect(prismaService.workflowSchedule.updateMany).toHaveBeenCalledWith({
        where: { canvasId: 'canvas-1', uid: 'user-1', deletedAt: null },
        data: {
          isEnabled: false,
          deletedAt: expect.any(Date),
          nextRunAt: null,
        },
      });

      // Verify pending/scheduled records are failed
      expect(prismaService.workflowScheduleRecord.updateMany).toHaveBeenCalledWith({
        where: {
          scheduleId: { in: ['schedule-1', 'schedule-2'] },
          status: { in: ['pending', 'scheduled'] },
        },
        data: {
          status: 'failed',
          failureReason: ScheduleFailureReason.CANVAS_DELETED,
          errorDetails: expect.stringContaining('Canvas was deleted'),
          completedAt: expect.any(Date),
        },
      });

      // Verify processing/running count check
      expect(prismaService.workflowScheduleRecord.count).toHaveBeenCalledWith({
        where: {
          scheduleId: { in: ['schedule-1', 'schedule-2'] },
          status: { in: ['processing', 'running'] },
        },
      });
    });

    it('should log processing/running tasks without interrupting them', async () => {
      const event = new CanvasDeletedEvent('canvas-1', 'user-1');

      const mockSchedules = [{ scheduleId: 'schedule-1' }];

      jest
        .spyOn(prismaService.workflowSchedule, 'findMany')
        .mockResolvedValue(mockSchedules as any);
      jest
        .spyOn(prismaService.workflowSchedule, 'updateMany')
        .mockResolvedValue({ count: 1 } as any);
      jest
        .spyOn(prismaService.workflowScheduleRecord, 'updateMany')
        .mockResolvedValue({ count: 0 } as any);
      jest.spyOn(prismaService.workflowScheduleRecord, 'count').mockResolvedValue(2); // 2 tasks processing/running

      await listener.handleCanvasDeleted(event);

      // Verify schedules are still disabled
      expect(prismaService.workflowSchedule.updateMany).toHaveBeenCalled();

      // Verify processing/running tasks are counted but not updated
      expect(prismaService.workflowScheduleRecord.count).toHaveBeenCalledWith({
        where: {
          scheduleId: { in: ['schedule-1'] },
          status: { in: ['processing', 'running'] },
        },
      });

      // Only pending/scheduled records should be updated, not processing/running
      expect(prismaService.workflowScheduleRecord.updateMany).toHaveBeenCalledWith({
        where: {
          scheduleId: { in: ['schedule-1'] },
          status: { in: ['pending', 'scheduled'] },
        },
        data: expect.objectContaining({
          status: 'failed',
        }),
      });
    });

    it('should handle errors gracefully without throwing', async () => {
      const event = new CanvasDeletedEvent('canvas-1', 'user-1');

      jest
        .spyOn(prismaService.workflowSchedule, 'findMany')
        .mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(listener.handleCanvasDeleted(event)).resolves.not.toThrow();
    });

    it('should handle schedule update failure gracefully', async () => {
      const event = new CanvasDeletedEvent('canvas-1', 'user-1');

      const mockSchedules = [{ scheduleId: 'schedule-1' }];

      jest
        .spyOn(prismaService.workflowSchedule, 'findMany')
        .mockResolvedValue(mockSchedules as any);
      jest
        .spyOn(prismaService.workflowSchedule, 'updateMany')
        .mockRejectedValue(new Error('Update failed'));

      // Should not throw
      await expect(listener.handleCanvasDeleted(event)).resolves.not.toThrow();
    });
  });
});

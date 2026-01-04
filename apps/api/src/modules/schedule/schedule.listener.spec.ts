import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleEventListener } from './schedule.listener';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { NotificationService } from '../notification/notification.service';
import { CreditService } from '../credit/credit.service';
import { ConfigService } from '@nestjs/config';
import { WorkflowCompletedEvent, WorkflowFailedEvent } from '../workflow/workflow.events';
import {
  generateScheduleSuccessEmail,
  generateScheduleFailedEmail,
} from './schedule-email-templates';

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
              findUnique: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            workflowSchedule: {
              findUnique: jest.fn(),
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
      jest.spyOn(prismaService.workflowScheduleRecord, 'findUnique').mockResolvedValueOnce({
        uid: 'user-1',
      } as any);

      // Mock sendEmail calls
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prismaService.workflowScheduleRecord, 'findUnique').mockResolvedValueOnce({
        ...mockScheduleRecord,
      } as any);
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

      jest.spyOn(prismaService.workflowScheduleRecord, 'findUnique').mockResolvedValueOnce({
        uid: 'user-1',
      } as any);
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
      jest.spyOn(prismaService.workflowScheduleRecord, 'findUnique').mockResolvedValueOnce({
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
      jest.spyOn(prismaService.workflowScheduleRecord, 'findUnique').mockResolvedValueOnce({
        uid: 'user-1',
      } as any);

      // Mock sendEmail calls
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prismaService.workflowScheduleRecord, 'findUnique').mockResolvedValueOnce({
        ...mockScheduleRecord,
      } as any);
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

      jest.spyOn(prismaService.workflowScheduleRecord, 'findUnique').mockResolvedValueOnce({
        uid: 'user-1',
      } as any);
      jest.spyOn(redisService, 'decr').mockRejectedValueOnce(new Error('Redis error'));

      // Mock sendEmail calls
      const mockUser = {
        uid: 'user-1',
        email: 'test@example.com',
        nickname: 'Test User',
      };
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prismaService.workflowScheduleRecord, 'findUnique').mockResolvedValueOnce({
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
});

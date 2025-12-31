import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleEventListener } from './schedule.listener';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { NotificationService } from '../notification/notification.service';
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
      };

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prismaService.workflowScheduleRecord, 'findUnique').mockResolvedValue({
        ...mockScheduleRecord,
        scheduleId: 'schedule-1',
      } as any);
      jest.spyOn(prismaService.workflowSchedule, 'findUnique').mockResolvedValue({
        scheduleId: 'schedule-1',
        cronExpression: '0 8 * * *',
        timezone: 'UTC',
      } as any);

      await listener.handleWorkflowCompleted(event);

      // Verify DB update
      expect(prismaService.workflowScheduleRecord.update).toHaveBeenCalledWith({
        where: { scheduleRecordId: 'schedule-record-1' },
        data: expect.objectContaining({
          status: 'success',
          completedAt: expect.any(Date),
        }),
      });

      // Verify Email Sending
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({ where: { uid: 'user-1' } });
      expect(prismaService.workflowScheduleRecord.findUnique).toHaveBeenCalledWith({
        where: { scheduleRecordId: 'schedule-record-1' },
      });
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
      };

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prismaService.workflowScheduleRecord, 'findUnique').mockResolvedValue({
        ...mockScheduleRecord,
        scheduleId: 'schedule-1',
      } as any);
      jest.spyOn(prismaService.workflowSchedule, 'findUnique').mockResolvedValue({
        scheduleId: 'schedule-1',
        cronExpression: '0 8 * * *',
        timezone: 'UTC',
      } as any);

      await listener.handleWorkflowFailed(event);

      // Verify DB update
      expect(prismaService.workflowScheduleRecord.update).toHaveBeenCalledWith({
        where: { scheduleRecordId: 'schedule-record-1' },
        data: expect.objectContaining({
          status: 'failed',
          completedAt: expect.any(Date),
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
  });
});

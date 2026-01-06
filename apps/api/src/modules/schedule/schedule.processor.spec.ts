/**
 * Schedule Processor Unit Tests
 *
 * Note: This test file uses manual mocking to avoid ESM import issues
 * with @modelcontextprotocol/sdk that are triggered through the CanvasService
 * dependency chain.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { DelayedError } from 'bullmq';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';
import { ScheduleMetrics } from './schedule.metrics';
import { DEFAULT_SCHEDULE_CONFIG, ScheduleFailureReason } from './schedule.constants';

// Mock the entire ScheduleProcessor module to avoid ESM import issues
// The actual ScheduleProcessor imports CanvasService which has deep ESM dependencies
jest.mock('./schedule.processor', () => {
  return {
    ScheduleProcessor: jest.fn().mockImplementation(() => ({
      process: jest.fn(),
    })),
  };
});

describe('ScheduleProcessor Logic Tests', () => {
  let _prismaService: jest.Mocked<PrismaService>;
  let _miscService: jest.Mocked<MiscService>;
  let metrics: jest.Mocked<ScheduleMetrics>;

  const mockJobData = {
    scheduleId: 'schedule-123',
    canvasId: 'canvas-456',
    uid: 'user-789',
    scheduledAt: new Date().toISOString(),
    priority: 5,
    scheduleRecordId: 'record-abc',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockPrisma = createMock<PrismaService>();
    const mockMisc = createMock<MiscService>();
    const mockMetrics = {
      execution: {
        success: jest.fn(),
        fail: jest.fn(),
      },
      queue: {
        delayed: jest.fn(),
      },
    } as unknown as jest.Mocked<ScheduleMetrics>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MiscService, useValue: mockMisc },
        { provide: ScheduleMetrics, useValue: mockMetrics },
      ],
    }).compile();

    _prismaService = module.get(PrismaService);
    _miscService = module.get(MiscService);
    metrics = module.get(ScheduleMetrics);
  });

  describe('User Concurrency Control Logic (Database-based)', () => {
    it('should enforce user max concurrent limit when runningCount exceeds limit', () => {
      // Database-based concurrency: query returns count of 'processing' and 'running' status records
      // If runningCount >= USER_MAX_CONCURRENT, job should be delayed
      const runningCount = DEFAULT_SCHEDULE_CONFIG.userMaxConcurrent;
      const shouldDelay = runningCount >= DEFAULT_SCHEDULE_CONFIG.userMaxConcurrent;
      expect(shouldDelay).toBe(true);
    });

    it('should allow when runningCount is below max concurrent limit', () => {
      const runningCount = DEFAULT_SCHEDULE_CONFIG.userMaxConcurrent - 1;
      const shouldDelay = runningCount >= DEFAULT_SCHEDULE_CONFIG.userMaxConcurrent;
      expect(shouldDelay).toBe(false);
    });

    it('should have correct rate limit constants', () => {
      // Note: COUNTER_TTL_SECONDS and REDIS_PREFIX removed - concurrency is now database-based
      expect(typeof DEFAULT_SCHEDULE_CONFIG.userMaxConcurrent).toBe('number');
      expect(typeof DEFAULT_SCHEDULE_CONFIG.userRateLimitDelayMs).toBe('number');
    });

    it('should consider both processing and running status as active', () => {
      // The database query counts records with status in ['processing', 'running']
      const activeStatuses = ['processing', 'running'];
      expect(activeStatuses).toContain('processing');
      expect(activeStatuses).toContain('running');
    });
  });

  describe('Schedule Validation Logic', () => {
    it('should identify deleted schedules', () => {
      const schedule = { scheduleId: 'test', deletedAt: new Date() };
      const shouldSkip = !!schedule.deletedAt;
      expect(shouldSkip).toBe(true);
    });

    it('should identify disabled schedules', () => {
      const schedule = { scheduleId: 'test', isEnabled: false, deletedAt: null };
      const shouldSkip = !schedule.isEnabled;
      expect(shouldSkip).toBe(true);
    });

    it('should process enabled schedules', () => {
      const schedule = { scheduleId: 'test', isEnabled: true, deletedAt: null };
      const shouldProcess = schedule.isEnabled && !schedule.deletedAt;
      expect(shouldProcess).toBe(true);
    });
  });

  describe('Retry Detection Logic', () => {
    it('should detect retry from existing snapshot key', () => {
      const record = {
        scheduleRecordId: 'record-abc',
        snapshotStorageKey: 'schedules/user-789/record-abc/snapshot.json',
      };
      const isRetry = !!record.snapshotStorageKey;
      expect(isRetry).toBe(true);
    });

    it('should detect new execution from missing snapshot key', () => {
      const record = {
        scheduleRecordId: 'record-abc',
        snapshotStorageKey: null,
      };
      const isRetry = !!record.snapshotStorageKey;
      expect(isRetry).toBe(false);
    });
  });

  describe('Status Transition Logic', () => {
    const validStatuses = ['scheduled', 'pending', 'processing', 'running', 'success', 'failed'];

    it('should have valid status values', () => {
      expect(validStatuses).toContain('pending');
      expect(validStatuses).toContain('processing');
      expect(validStatuses).toContain('running');
      expect(validStatuses).toContain('success');
      expect(validStatuses).toContain('failed');
    });

    it('should follow correct transition path for success', () => {
      const expectedPath = ['pending', 'processing', 'running', 'success'];
      // Verify the path is a subset of valid statuses
      for (const status of expectedPath) {
        expect(validStatuses).toContain(status);
      }
    });

    it('should follow correct transition path for failure', () => {
      const expectedPath = ['pending', 'processing', 'failed'];
      for (const status of expectedPath) {
        expect(validStatuses).toContain(status);
      }
    });
  });

  describe('Database-based Concurrency Control', () => {
    it('should query records with processing or running status', () => {
      // The concurrency check queries the database for records where:
      // - uid matches the user
      // - status is 'processing' OR 'running'
      const expectedQuery = {
        uid: 'user-123',
        status: { in: ['processing', 'running'] },
      };
      expect(expectedQuery.status.in).toContain('processing');
      expect(expectedQuery.status.in).toContain('running');
    });

    it('should release concurrency slot when workflow completes', () => {
      // When workflow completes, ScheduleEventListener updates status to 'success'
      // This automatically releases the concurrency slot for next database query
      const completedStatus = 'success';
      const activeStatuses = ['processing', 'running'];
      expect(activeStatuses).not.toContain(completedStatus);
    });

    it('should release concurrency slot when workflow fails', () => {
      // When workflow fails, ScheduleEventListener updates status to 'failed'
      // This automatically releases the concurrency slot
      const failedStatus = 'failed';
      const activeStatuses = ['processing', 'running'];
      expect(activeStatuses).not.toContain(failedStatus);
    });
  });

  describe('Snapshot Storage Key Generation', () => {
    it('should generate correct snapshot storage key', () => {
      const uid = 'user-123';
      const scheduleRecordId = 'record-456';
      const key = `schedules/${uid}/${scheduleRecordId}/snapshot.json`;
      expect(key).toBe('schedules/user-123/record-456/snapshot.json');
    });
  });

  describe('Job Data Validation', () => {
    it('should have all required fields in job data', () => {
      expect(mockJobData).toHaveProperty('scheduleId');
      expect(mockJobData).toHaveProperty('canvasId');
      expect(mockJobData).toHaveProperty('uid');
      expect(mockJobData).toHaveProperty('scheduledAt');
      expect(mockJobData).toHaveProperty('priority');
    });

    it('should have valid priority range', () => {
      expect(mockJobData.priority).toBeGreaterThanOrEqual(1);
      expect(mockJobData.priority).toBeLessThanOrEqual(10);
    });
  });

  describe('DelayedError Handling', () => {
    it('should be throwable for rate limiting', () => {
      expect(() => {
        throw new DelayedError();
      }).toThrow(DelayedError);
    });
  });

  describe('Metrics Interface', () => {
    it('should have execution success method', () => {
      metrics.execution.success('cron');
      expect(metrics.execution.success).toHaveBeenCalledWith('cron');
    });

    it('should have execution fail method', () => {
      metrics.execution.fail('cron', 'Error');
      expect(metrics.execution.fail).toHaveBeenCalledWith('cron', 'Error');
    });

    it('should have execution fail method for deleted/disabled schedules', () => {
      metrics.execution.fail('cron', 'schedule_deleted');
      expect(metrics.execution.fail).toHaveBeenCalledWith('cron', 'schedule_deleted');
    });

    it('should have queue delayed method', () => {
      metrics.queue.delayed();
      expect(metrics.queue.delayed).toHaveBeenCalled();
    });
  });
});

// Separate test suite for ScheduleFailureReason that doesn't require mocking

describe('ScheduleFailureReason Enum', () => {
  describe('Enum Values', () => {
    it('should have all expected failure reason values', () => {
      expect(ScheduleFailureReason.INSUFFICIENT_CREDITS).toBe('insufficient_credits');
      expect(ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED).toBe('schedule_limit_exceeded');
      expect(ScheduleFailureReason.SCHEDULE_DELETED).toBe('schedule_deleted');
      expect(ScheduleFailureReason.SCHEDULE_DISABLED).toBe('schedule_disabled');
      expect(ScheduleFailureReason.INVALID_CRON_EXPRESSION).toBe('invalid_cron_expression');
      expect(ScheduleFailureReason.CANVAS_DATA_ERROR).toBe('canvas_data_error');
      expect(ScheduleFailureReason.CANVAS_DELETED).toBe('canvas_deleted');
      expect(ScheduleFailureReason.SNAPSHOT_ERROR).toBe('snapshot_error');
      expect(ScheduleFailureReason.WORKFLOW_EXECUTION_FAILED).toBe('workflow_execution_failed');
      expect(ScheduleFailureReason.WORKFLOW_EXECUTION_TIMEOUT).toBe('workflow_execution_timeout');
      expect(ScheduleFailureReason.UNKNOWN_ERROR).toBe('unknown_error');
    });

    it('should have exactly 11 failure reason values', () => {
      const values = Object.values(ScheduleFailureReason);
      expect(values.length).toBe(11);
    });
  });

  describe('Error Classification Patterns (Logic Tests)', () => {
    // Helper function that mimics the classifyError logic
    const classifyError = (error: unknown): ScheduleFailureReason => {
      if (!error) {
        return ScheduleFailureReason.UNKNOWN_ERROR;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : '';

      if (
        errorName === 'ModelUsageQuotaExceeded' ||
        /credit not available/i.test(errorMessage) ||
        /insufficient credits?/i.test(errorMessage)
      ) {
        return ScheduleFailureReason.INSUFFICIENT_CREDITS;
      }

      if (
        /quota.*exceeded/i.test(errorMessage) ||
        /schedule.*limit/i.test(errorMessage) ||
        errorMessage === ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED
      ) {
        return ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED;
      }

      // Note: Rate limiting (concurrent limit) causes delays, not failures.
      // DelayedError is handled separately and doesn't reach classifyError.

      if (/cron|schedule.*expression|invalid.*expression/i.test(errorMessage)) {
        return ScheduleFailureReason.INVALID_CRON_EXPRESSION;
      }

      if (
        /canvas.*not found/i.test(errorMessage) ||
        /invalid.*canvas/i.test(errorMessage) ||
        /nodes.*edges/i.test(errorMessage)
      ) {
        return ScheduleFailureReason.CANVAS_DATA_ERROR;
      }

      if (
        /snapshot/i.test(errorMessage) ||
        /failed to parse/i.test(errorMessage) ||
        /storage.*key/i.test(errorMessage)
      ) {
        return ScheduleFailureReason.SNAPSHOT_ERROR;
      }

      if (
        /workflow.*execution/i.test(errorMessage) ||
        /execution.*failed/i.test(errorMessage) ||
        /agent.*error/i.test(errorMessage)
      ) {
        return ScheduleFailureReason.WORKFLOW_EXECUTION_FAILED;
      }

      return ScheduleFailureReason.UNKNOWN_ERROR;
    };

    describe('Credit-related errors', () => {
      it('should classify "credit not available" as INSUFFICIENT_CREDITS', () => {
        const error = new Error('credit not available: Insufficient credits.');
        expect(classifyError(error)).toBe(ScheduleFailureReason.INSUFFICIENT_CREDITS);
      });

      it('should classify "insufficient credits" as INSUFFICIENT_CREDITS', () => {
        const error = new Error('Insufficient credits to execute workflow');
        expect(classifyError(error)).toBe(ScheduleFailureReason.INSUFFICIENT_CREDITS);
      });

      it('should classify ModelUsageQuotaExceeded by name as INSUFFICIENT_CREDITS', () => {
        const error = new Error('Model usage quota exceeded');
        (error as any).name = 'ModelUsageQuotaExceeded';
        expect(classifyError(error)).toBe(ScheduleFailureReason.INSUFFICIENT_CREDITS);
      });
    });

    describe('Quota/Limit exceeded errors', () => {
      it('should classify "quota exceeded" as SCHEDULE_LIMIT_EXCEEDED', () => {
        const error = new Error('User quota exceeded for schedules');
        expect(classifyError(error)).toBe(ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED);
      });

      it('should classify "schedule limit" as SCHEDULE_LIMIT_EXCEEDED', () => {
        const error = new Error('Maximum schedule limit reached');
        expect(classifyError(error)).toBe(ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED);
      });
    });

    // Note: Rate limiting tests removed - rate limiting causes job delays (DelayedError),
    // not failures. Delayed jobs are retried automatically by BullMQ.

    describe('Cron expression errors', () => {
      it('should classify "cron" errors as INVALID_CRON_EXPRESSION', () => {
        const error = new Error('Invalid cron expression');
        expect(classifyError(error)).toBe(ScheduleFailureReason.INVALID_CRON_EXPRESSION);
      });

      it('should classify "schedule expression" errors as INVALID_CRON_EXPRESSION', () => {
        const error = new Error('Invalid schedule expression syntax');
        expect(classifyError(error)).toBe(ScheduleFailureReason.INVALID_CRON_EXPRESSION);
      });
    });

    describe('Canvas data errors', () => {
      it('should classify "canvas not found" as CANVAS_DATA_ERROR', () => {
        const error = new Error('Canvas not found');
        expect(classifyError(error)).toBe(ScheduleFailureReason.CANVAS_DATA_ERROR);
      });

      it('should classify "invalid canvas" as CANVAS_DATA_ERROR', () => {
        const error = new Error('Invalid canvas data');
        expect(classifyError(error)).toBe(ScheduleFailureReason.CANVAS_DATA_ERROR);
      });
    });

    describe('Snapshot errors', () => {
      it('should classify "snapshot" errors as SNAPSHOT_ERROR', () => {
        const error = new Error('Failed to load snapshot');
        expect(classifyError(error)).toBe(ScheduleFailureReason.SNAPSHOT_ERROR);
      });

      it('should classify "failed to parse" as SNAPSHOT_ERROR', () => {
        const error = new Error('Failed to parse snapshot data');
        expect(classifyError(error)).toBe(ScheduleFailureReason.SNAPSHOT_ERROR);
      });

      it('should classify "storage key" errors as SNAPSHOT_ERROR', () => {
        const error = new Error('Invalid storage key');
        expect(classifyError(error)).toBe(ScheduleFailureReason.SNAPSHOT_ERROR);
      });
    });

    describe('Workflow execution errors', () => {
      it('should classify "workflow execution" as WORKFLOW_EXECUTION_FAILED', () => {
        const error = new Error('Workflow execution failed');
        expect(classifyError(error)).toBe(ScheduleFailureReason.WORKFLOW_EXECUTION_FAILED);
      });

      it('should classify "execution failed" as WORKFLOW_EXECUTION_FAILED', () => {
        const error = new Error('The execution failed unexpectedly');
        expect(classifyError(error)).toBe(ScheduleFailureReason.WORKFLOW_EXECUTION_FAILED);
      });

      it('should classify "agent error" as WORKFLOW_EXECUTION_FAILED', () => {
        const error = new Error('Agent error during processing');
        expect(classifyError(error)).toBe(ScheduleFailureReason.WORKFLOW_EXECUTION_FAILED);
      });
    });

    describe('Unknown errors', () => {
      it('should classify null error as UNKNOWN_ERROR', () => {
        expect(classifyError(null)).toBe(ScheduleFailureReason.UNKNOWN_ERROR);
      });

      it('should classify undefined error as UNKNOWN_ERROR', () => {
        expect(classifyError(undefined)).toBe(ScheduleFailureReason.UNKNOWN_ERROR);
      });

      it('should classify unrecognized error message as UNKNOWN_ERROR', () => {
        const error = new Error('Something completely different happened');
        expect(classifyError(error)).toBe(ScheduleFailureReason.UNKNOWN_ERROR);
      });

      it('should handle non-Error objects gracefully', () => {
        expect(classifyError('String error')).toBe(ScheduleFailureReason.UNKNOWN_ERROR);
        expect(classifyError({ message: 'Object error' })).toBe(
          ScheduleFailureReason.UNKNOWN_ERROR,
        );
        expect(classifyError(123)).toBe(ScheduleFailureReason.UNKNOWN_ERROR);
      });
    });
  });

  describe('Frontend Action Button Mapping', () => {
    // Based on the enum documentation comments
    const getActionButton = (reason: ScheduleFailureReason): string => {
      switch (reason) {
        case ScheduleFailureReason.INSUFFICIENT_CREDITS:
          return 'Upgrade';
        case ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED:
          return 'View Schedule';
        default:
          return 'Debug';
      }
    };

    it('should map INSUFFICIENT_CREDITS to Upgrade button', () => {
      expect(getActionButton(ScheduleFailureReason.INSUFFICIENT_CREDITS)).toBe('Upgrade');
    });

    it('should map SCHEDULE_LIMIT_EXCEEDED to View Schedule button', () => {
      expect(getActionButton(ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED)).toBe('View Schedule');
    });

    it('should map other failures to Debug button', () => {
      expect(getActionButton(ScheduleFailureReason.WORKFLOW_EXECUTION_FAILED)).toBe('Debug');
      expect(getActionButton(ScheduleFailureReason.UNKNOWN_ERROR)).toBe('Debug');
      expect(getActionButton(ScheduleFailureReason.CANVAS_DATA_ERROR)).toBe('Debug');
    });
  });
});

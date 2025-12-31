import type { ConfigService } from '@nestjs/config';

// Queue name for schedule execution
export const QUEUE_SCHEDULE_EXECUTION = 'scheduleExecution';

// Redis key prefix (code constant, not configurable)
export const SCHEDULE_REDIS_KEYS = {
  // Prefix for user concurrency counter: schedule:concurrent:user:{uid}
  USER_CONCURRENT_PREFIX: 'schedule:concurrent:user:',
} as const;

// Default job options for BullMQ schedule execution queue
export const SCHEDULE_JOB_OPTIONS = {
  attempts: 1, // No automatic retry, user must manually retry
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
} as const;

/**
 * Schedule configuration interface (matches app.config.ts schedule section)
 */
export interface ScheduleConfig {
  globalMaxConcurrent: number;
  rateLimitMax: number;
  rateLimitDurationMs: number;
  userMaxConcurrent: number;
  userRateLimitDelayMs: number;
  userConcurrentTtl: number;
  freeMaxActiveSchedules: number;
  paidMaxActiveSchedules: number;
  defaultPriority: number;
  highLoadThreshold: number;
  maxPriority: number;
}

/**
 * Default schedule configuration values (used as fallback)
 */
export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  globalMaxConcurrent: 50,
  rateLimitMax: 100,
  rateLimitDurationMs: 60 * 1000,
  userMaxConcurrent: 20,
  userRateLimitDelayMs: 10 * 1000,
  userConcurrentTtl: 2 * 60 * 60,
  freeMaxActiveSchedules: 1,
  paidMaxActiveSchedules: 20,
  defaultPriority: 10,
  highLoadThreshold: 5,
  maxPriority: 10,
};

/**
 * Get schedule configuration from ConfigService
 * Falls back to defaults if config is not available
 */
export function getScheduleConfig(configService: ConfigService): ScheduleConfig {
  return {
    globalMaxConcurrent:
      configService.get<number>('schedule.globalMaxConcurrent') ??
      DEFAULT_SCHEDULE_CONFIG.globalMaxConcurrent,
    rateLimitMax:
      configService.get<number>('schedule.rateLimitMax') ?? DEFAULT_SCHEDULE_CONFIG.rateLimitMax,
    rateLimitDurationMs:
      configService.get<number>('schedule.rateLimitDurationMs') ??
      DEFAULT_SCHEDULE_CONFIG.rateLimitDurationMs,
    userMaxConcurrent:
      configService.get<number>('schedule.userMaxConcurrent') ??
      DEFAULT_SCHEDULE_CONFIG.userMaxConcurrent,
    userRateLimitDelayMs:
      configService.get<number>('schedule.userRateLimitDelayMs') ??
      DEFAULT_SCHEDULE_CONFIG.userRateLimitDelayMs,
    userConcurrentTtl:
      configService.get<number>('schedule.userConcurrentTtl') ??
      DEFAULT_SCHEDULE_CONFIG.userConcurrentTtl,
    freeMaxActiveSchedules:
      configService.get<number>('schedule.freeMaxActiveSchedules') ??
      DEFAULT_SCHEDULE_CONFIG.freeMaxActiveSchedules,
    paidMaxActiveSchedules:
      configService.get<number>('schedule.paidMaxActiveSchedules') ??
      DEFAULT_SCHEDULE_CONFIG.paidMaxActiveSchedules,
    defaultPriority:
      configService.get<number>('schedule.defaultPriority') ??
      DEFAULT_SCHEDULE_CONFIG.defaultPriority,
    highLoadThreshold:
      configService.get<number>('schedule.highLoadThreshold') ??
      DEFAULT_SCHEDULE_CONFIG.highLoadThreshold,
    maxPriority:
      configService.get<number>('schedule.maxPriority') ?? DEFAULT_SCHEDULE_CONFIG.maxPriority,
  };
}

/**
 * Get maximum active schedules quota for a given plan
 * @param planType - The subscription plan lookup key (e.g., 'free', 'refly_plus_monthly_stable_v2')
 * @param config - Schedule configuration (from getScheduleConfig)
 * @returns Maximum number of active schedules allowed
 */
export function getScheduleQuota(
  planType: string | null | undefined,
  config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG,
): number {
  // Free tier or no plan
  if (!planType || planType === 'free') {
    return config.freeMaxActiveSchedules;
  }
  // All paid plans get the same quota
  return config.paidMaxActiveSchedules;
}

/**
 * Priority range: 1-10 (lower number = higher priority, matching BullMQ convention)
 * Priority order: Max > Plus > Starter > Maker > Free
 */
export const PLAN_PRIORITY_MAP: Record<string, number> = {
  // Max tier - highest priority (1)
  refly_max_yearly_stable_v3: 1,
  refly_max_yearly_limited_offer: 1, // early bird max

  // Plus tier - high priority (3)
  refly_plus_yearly_stable_v2: 3,
  refly_plus_monthly_stable_v2: 3,
  refly_plus_monthly_stable: 3,
  refly_plus_yearly_limited_offer: 3, // early bird plus

  // Starter tier - medium priority (5)
  refly_starter_monthly: 5,

  // Maker tier - low-medium priority (7)
  refly_maker_monthly: 7,

  // Test/Trial plans - lower priority (8)
  refly_plus_yearly_test_v3: 8,
  refly_plus_monthly_test_v3: 8,
  refly_plus_yearly_test_v4: 8,

  // Free tier - lowest priority (10)
  free: 10,
} as const;

// Priority adjustment factors (penalties increase priority number = lower priority)
// Note: HIGH_LOAD_THRESHOLD and MAX_PRIORITY are now in ScheduleConfig
export const PRIORITY_ADJUSTMENTS = {
  FAILURE_PENALTY: 1, // Per consecutive failure (added to priority)
  HIGH_LOAD_PENALTY: 1, // When user has > highLoadThreshold active schedules (added to priority)
  MAX_FAILURE_LEVELS: 3, // Max penalty levels for failures
} as const;

/**
 * Schedule execution failure reasons
 * Used for frontend display and error tracking
 *
 * Frontend action buttons mapping:
 * - INSUFFICIENT_CREDITS -> "Upgrade" button
 * - SCHEDULE_LIMIT_EXCEEDED -> "View Schedule" button
 * - Others -> "Debug" button
 *
 * Note: User rate limiting (concurrent limit) causes job delays, not failures.
 * Delayed jobs are retried automatically by BullMQ, so no failure reason is needed.
 */
export enum ScheduleFailureReason {
  /** Insufficient credits - user needs to recharge */
  INSUFFICIENT_CREDITS = 'insufficient_credits',

  /** Exceeded subscription plan's schedule limit */
  SCHEDULE_LIMIT_EXCEEDED = 'schedule_limit_exceeded',

  /** Schedule was deleted */
  SCHEDULE_DELETED = 'schedule_deleted',

  /** Schedule was disabled */
  SCHEDULE_DISABLED = 'schedule_disabled',

  /** Invalid cron expression */
  INVALID_CRON_EXPRESSION = 'invalid_cron_expression',

  /** Canvas data error (missing nodes/edges) */
  CANVAS_DATA_ERROR = 'canvas_data_error',

  /** Snapshot creation or loading failed */
  SNAPSHOT_ERROR = 'snapshot_error',

  /** Workflow execution failed */
  WORKFLOW_EXECUTION_FAILED = 'workflow_execution_failed',

  /** Workflow execution timeout */
  WORKFLOW_EXECUTION_TIMEOUT = 'workflow_execution_timeout',

  /** Other unknown error */
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Classify error into standardized failure reason
 * This helps frontend display appropriate error messages and action buttons
 *
 * @param error - Error object or error message string
 * @returns ScheduleFailureReason - Standardized failure reason
 */
export function classifyScheduleError(error: unknown): ScheduleFailureReason {
  if (!error) {
    return ScheduleFailureReason.UNKNOWN_ERROR;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : '';

  // Check for credit-related errors
  if (
    errorName === 'ModelUsageQuotaExceeded' ||
    /credit not available/i.test(errorMessage) ||
    /insufficient credits?/i.test(errorMessage) ||
    /ModelUsageQuotaExceeded/i.test(errorMessage)
  ) {
    return ScheduleFailureReason.INSUFFICIENT_CREDITS;
  }

  // Check for quota/limit exceeded errors
  if (
    /quota.*exceeded/i.test(errorMessage) ||
    /schedule.*limit/i.test(errorMessage) ||
    errorMessage === ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED
  ) {
    return ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED;
  }

  // Check for timeout errors
  if (/timeout/i.test(errorMessage)) {
    return ScheduleFailureReason.WORKFLOW_EXECUTION_TIMEOUT;
  }

  // Check for cron expression errors
  if (/cron|schedule.*expression|invalid.*expression/i.test(errorMessage)) {
    return ScheduleFailureReason.INVALID_CRON_EXPRESSION;
  }

  // Check for canvas data errors
  if (
    /canvas.*not found/i.test(errorMessage) ||
    /invalid.*canvas/i.test(errorMessage) ||
    /nodes.*edges/i.test(errorMessage)
  ) {
    return ScheduleFailureReason.CANVAS_DATA_ERROR;
  }

  // Check for snapshot errors
  if (
    /snapshot/i.test(errorMessage) ||
    /failed to parse/i.test(errorMessage) ||
    /storage.*key/i.test(errorMessage)
  ) {
    return ScheduleFailureReason.SNAPSHOT_ERROR;
  }

  // Check for workflow execution errors
  if (
    /workflow.*execution/i.test(errorMessage) ||
    /execution.*failed/i.test(errorMessage) ||
    /agent.*error/i.test(errorMessage)
  ) {
    return ScheduleFailureReason.WORKFLOW_EXECUTION_FAILED;
  }

  // Default to unknown error
  return ScheduleFailureReason.UNKNOWN_ERROR;
}

/**
 * Schedule period types for analytics tracking
 */
export const SchedulePeriodType = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom', // For complex schedules or when parsing fails
} as const;

export type SchedulePeriodTypeValue = (typeof SchedulePeriodType)[keyof typeof SchedulePeriodType];

/**
 * Analytics event names for schedule module
 */
export const ScheduleAnalyticsEvents = {
  /** Schedule execution triggered at Next Run Time */
  SCHEDULE_RUN_TRIGGERED: 'schedule_run_triggered',
} as const;

import { Injectable, OnModuleInit } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { metrics } from '@opentelemetry/api';
import type { Counter } from '@opentelemetry/api';

/**
 * Schedule execution metrics service
 *
 * Provides business-friendly API for recording schedule execution metrics.
 * Automatically exports to Prometheus via OpenTelemetry.
 *
 * Metrics produced:
 * - schedule.execution.count{status, trigger_type} - Execution counter
 * - schedule.queue.delayed.count - Delayed (rate limited) job counter
 *
 * Usage:
 *   this.metrics.execution.success('cron')
 *   this.metrics.execution.fail('cron', 'workflow_error')
 *   this.metrics.execution.skipped('schedule_deleted')
 *   this.metrics.queue.delayed()
 */
@Injectable()
export class ScheduleMetrics implements OnModuleInit {
  private meter = metrics.getMeter('refly-api');

  // OpenTelemetry metrics instances
  private executionCounter!: Counter;
  private queueDelayedCounter!: Counter;

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ScheduleMetrics.name);
  }

  async onModuleInit() {
    this.logger.info('Initializing Schedule metrics monitoring');
    this.initializeMetrics();
  }

  private initializeMetrics() {
    this.executionCounter = this.meter.createCounter('schedule.execution.count', {
      description: 'Total number of schedule executions',
    });

    this.queueDelayedCounter = this.meter.createCounter('schedule.queue.delayed.count', {
      description: 'Number of jobs delayed due to rate limiting',
    });

    this.logger.info('Schedule metrics initialized successfully');
  }

  /**
   * Public API for schedule execution metrics
   */
  execution = {
    /**
     * Record successful execution
     * @param triggerType - 'cron' | 'manual' | 'retry'
     */
    success: (triggerType: 'cron' | 'manual' | 'retry'): void => {
      this.executionCounter.add(1, { status: 'success', trigger_type: triggerType });
    },

    /**
     * Record failed execution
     * @param triggerType - 'cron' | 'manual' | 'retry'
     * @param errorType - Error classification
     */
    fail: (triggerType: 'cron' | 'manual' | 'retry', errorType: string): void => {
      this.executionCounter.add(1, {
        status: 'failed',
        trigger_type: triggerType,
        error_type: errorType,
      });
    },

    /**
     * Record skipped execution
     * @param reason - 'schedule_deleted' | 'schedule_disabled'
     */
    skipped: (reason: string): void => {
      this.executionCounter.add(1, { status: 'skipped', reason });
    },
  };

  /**
   * Public API for queue metrics
   */
  queue = {
    /**
     * Record job delayed due to rate limiting
     */
    delayed: (): void => {
      this.queueDelayedCounter.add(1);
    },
  };
}

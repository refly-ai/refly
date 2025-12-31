import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { ScheduleCronService } from './schedule-cron.service';
import { SchedulePriorityService } from './schedule-priority.service';
import { ScheduleProcessor } from './schedule.processor';
import { ScheduleMetrics } from './schedule.metrics';
import { QUEUE_SCHEDULE_EXECUTION } from './schedule.constants';
import { CommonModule } from '../common/common.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CreditModule } from '../credit/credit.module';
import { CanvasModule } from '../canvas/canvas.module';
import { MiscModule } from '../misc/misc.module';
import { WorkflowAppModule } from '../workflow-app/workflow-app.module';
import { NotificationModule } from '../notification/notification.module';
import { ScheduleEventListener } from './schedule.listener';

@Module({
  imports: [
    CommonModule,
    NestScheduleModule.forRoot(), // For @Cron
    BullModule.registerQueue({
      name: QUEUE_SCHEDULE_EXECUTION,
      // Rate limiter configuration:
      // - Jobs exceeding the limit will be delayed (queued), not rejected
      // - BullMQ handles this transparently: jobs wait until rate limit allows
      defaultJobOptions: {
        attempts: 1, // No automatic retry on failure, user must manually retry
        removeOnComplete: true,
        removeOnFail: false, // Keep failed jobs for debugging/retry
      },
    }),
    WorkflowModule,
    SubscriptionModule, // For priority check
    CreditModule, // For credit check
    CanvasModule,
    MiscModule,
    NotificationModule,
    forwardRef(() => WorkflowAppModule), // For executeFromCanvasData
  ],
  controllers: [ScheduleController],
  providers: [
    ScheduleService,
    ScheduleCronService,
    SchedulePriorityService,
    ScheduleProcessor,
    ScheduleMetrics,
    ScheduleEventListener,
  ],
  exports: [ScheduleService],
})
export class ScheduleModule {}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import {
  PLAN_PRIORITY_MAP,
  PRIORITY_ADJUSTMENTS,
  getScheduleConfig,
  type ScheduleConfig,
} from './schedule.constants';

interface PriorityFactors {
  consecutiveFailures: number;
  activeScheduleCount: number;
}

@Injectable()
export class SchedulePriorityService {
  private readonly logger = new Logger(SchedulePriorityService.name);
  private readonly scheduleConfig: ScheduleConfig;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.scheduleConfig = getScheduleConfig(configService);
  }

  /**
   * Calculate execution priority for a user
   * @param uid - User ID
   * @returns Priority value (1-10, lower number = higher priority, matching BullMQ convention)
   */
  async calculateExecutionPriority(uid: string): Promise<number> {
    // 1. Get user's current subscription
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        uid,
        status: 'active',
        OR: [{ cancelAt: null }, { cancelAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Get base priority from plan type
    const planType = subscription?.lookupKey ?? 'free';
    const basePriority = PLAN_PRIORITY_MAP[planType] ?? this.scheduleConfig.defaultPriority;

    // 3. Get priority adjustment factors
    const factors = await this.getPriorityFactors(uid);

    // 4. Apply priority adjustments (penalties increase priority number = lower priority)
    const adjustedPriority = this.applyPriorityAdjustments(basePriority, factors);

    // 5. Ensure priority is within valid range (1-10, where 1 is highest priority)
    const finalPriority = Math.max(1, Math.min(this.scheduleConfig.maxPriority, adjustedPriority));

    this.logger.debug(
      `Priority calculated for user ${uid}: base=${basePriority}, adjusted=${finalPriority}, factors=${JSON.stringify(factors)}`,
    );

    return finalPriority;
  }

  private async getPriorityFactors(uid: string): Promise<PriorityFactors> {
    // 1. Check recent failures (last 20 completed records)
    // Only query completed records (success/failed) to avoid interference from pending/processing/running
    const recentRecords = await this.prisma.workflowScheduleRecord.findMany({
      where: {
        uid,
        status: { in: ['success', 'failed'] }, // Only completed records
      },
      orderBy: { completedAt: 'desc' }, // Use completedAt for accurate ordering of finished records
      take: 20, // Increased from 5 to get more accurate picture
      select: { status: true },
    });

    // Count consecutive failures from the latest completed record
    let consecutiveFailures = 0;
    for (const record of recentRecords) {
      if (record.status === 'failed') {
        consecutiveFailures++;
      } else {
        break; // Stop at first non-failed record
      }
    }

    // 2. Check active schedule count
    const activeScheduleCount = await this.prisma.workflowSchedule.count({
      where: { uid, isEnabled: true, deletedAt: null },
    });

    return {
      consecutiveFailures,
      activeScheduleCount,
    };
  }

  private applyPriorityAdjustments(basePriority: number, factors: PriorityFactors): number {
    let priority = basePriority;

    // Penalty for consecutive failures (increase priority number = lower priority)
    if (factors.consecutiveFailures > 0) {
      const penalty =
        Math.min(factors.consecutiveFailures, PRIORITY_ADJUSTMENTS.MAX_FAILURE_LEVELS) *
        PRIORITY_ADJUSTMENTS.FAILURE_PENALTY;
      priority += penalty;
    }

    // Penalty for high load (many active schedules) - increase priority number = lower priority
    if (factors.activeScheduleCount > this.scheduleConfig.highLoadThreshold) {
      priority += PRIORITY_ADJUSTMENTS.HIGH_LOAD_PENALTY;
    }

    return Math.floor(priority);
  }
}

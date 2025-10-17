import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { User } from '@refly/openapi-schema';
import { CreditBilling, CreditRecharge, CreditUsage } from '@refly/openapi-schema';
import {
  CheckRequestCreditUsageResult,
  SyncMediaCreditUsageJobData,
  SyncBatchTokenCreditUsageJobData,
  ModelUsageDetail,
  SyncToolCreditUsageJobData,
} from './credit.dto';
import {
  genCreditUsageId,
  genCreditDebtId,
  safeParseJSON,
  genDailyCreditRechargeId,
  genSubscriptionRechargeId,
} from '@refly/utils';
import { CreditBalance } from './credit.dto';

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(
    protected readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Create daily gift credit recharge for a user
   * This method handles debt payment first, then creates a new credit recharge record
   */
  async createDailyGiftCreditRecharge(
    uid: string,
    creditAmount: number,
    description?: string,
    now: Date = new Date(),
  ): Promise<void> {
    // Check for existing debts
    const activeDebts = await this.prisma.creditDebt.findMany({
      where: {
        uid,
        enabled: true,
        balance: {
          gt: 0,
        },
      },
      orderBy: {
        createdAt: 'asc', // Pay off oldest debts first
      },
    });

    let remainingCredits = creditAmount;
    const debtPaymentOperations = [];

    // Pay off debts first
    for (const debt of activeDebts) {
      if (remainingCredits <= 0) break;

      const paymentAmount = Math.min(debt.balance, remainingCredits);
      const newDebtBalance = debt.balance - paymentAmount;

      debtPaymentOperations.push(
        this.prisma.creditDebt.update({
          where: { pk: debt.pk },
          data: {
            balance: newDebtBalance,
            enabled: newDebtBalance > 0, // Disable if fully paid
            updatedAt: now,
          },
        }),
      );

      remainingCredits -= paymentAmount;
    }

    // Create recharge record only if there are remaining credits after debt payment
    const operations = [...debtPaymentOperations];
    let expiresAt: Date | undefined;

    if (remainingCredits > 0) {
      // Set created time to start of today (00:00:00)
      const createdAt = new Date(now);
      createdAt.setHours(0, 0, 0, 0);

      // Set expires time to start of tomorrow (00:00:00)
      expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 1);
      expiresAt.setHours(0, 0, 0, 0);

      operations.push(
        this.prisma.creditRecharge.createMany({
          data: [
            {
              rechargeId: genDailyCreditRechargeId(uid, now),
              uid,
              amount: remainingCredits,
              balance: remainingCredits,
              enabled: true,
              source: 'gift',
              description: description ?? 'Daily gift credit recharge',
              createdAt: createdAt,
              updatedAt: now,
              expiresAt: expiresAt,
            },
          ],
          skipDuplicates: true,
        }),
      );
    }

    // Execute all operations in a transaction
    await this.prisma.$transaction(operations);

    this.logger.log(
      `Processed daily gift credit recharge for user ${uid}: ${creditAmount} credits total, ` +
        `${creditAmount - remainingCredits} used for debt payment, ` +
        `${remainingCredits} added as new balance, expires at ${expiresAt?.toISOString() ?? 'N/A'}`,
    );
  }

  /**
   * Create subscription credit recharge for a user
   * This method handles debt payment first, then creates a new credit recharge record
   */
  async createSubscriptionCreditRecharge(
    uid: string,
    creditAmount: number,
    expiresAt: Date,
    description?: string,
    now: Date = new Date(),
  ): Promise<void> {
    // Check for existing debts
    const activeDebts = await this.prisma.creditDebt.findMany({
      where: {
        uid,
        enabled: true,
        balance: {
          gt: 0,
        },
      },
      orderBy: {
        createdAt: 'asc', // Pay off oldest debts first
      },
    });

    let remainingCredits = creditAmount;
    const debtPaymentOperations = [];

    // Pay off debts first
    for (const debt of activeDebts) {
      if (remainingCredits <= 0) break;

      const paymentAmount = Math.min(debt.balance, remainingCredits);
      const newDebtBalance = debt.balance - paymentAmount;

      debtPaymentOperations.push(
        this.prisma.creditDebt.update({
          where: { pk: debt.pk },
          data: {
            balance: newDebtBalance,
            enabled: newDebtBalance > 0, // Disable if fully paid
            updatedAt: now,
          },
        }),
      );

      remainingCredits -= paymentAmount;
    }

    // Create recharge record only if there are remaining credits after debt payment
    const operations = [...debtPaymentOperations];

    if (remainingCredits > 0) {
      operations.push(
        this.prisma.creditRecharge.createMany({
          data: [
            {
              rechargeId: genSubscriptionRechargeId(uid, now),
              uid,
              amount: remainingCredits,
              balance: remainingCredits,
              enabled: true,
              source: 'subscription',
              description,
              createdAt: now,
              updatedAt: now,
              expiresAt,
            },
          ],
          skipDuplicates: true,
        }),
      );
    }

    // Execute all operations in a transaction
    await this.prisma.$transaction(operations);

    this.logger.log(
      `Processed credit recharge for user ${uid}: ${creditAmount} credits total, ` +
        `${creditAmount - remainingCredits} used for debt payment, ` +
        `${remainingCredits} added as new balance, expires at ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Lazy load daily gift credits for user if needed
   * This method first checks if there's already a gift credit recharge for today,
   * then checks if user has active subscription and daily gift quota,
   * and creates a new gift credit recharge if needed
   * Uses distributed lock to prevent concurrent creation of gift credits
   */
  private async lazyLoadDailyGiftCredits(uid: string): Promise<void> {
    const lockKey = `gift_credit_lock:${uid}`;

    // Try to acquire distributed lock
    const releaseLock = await this.redis.acquireLock(lockKey);

    if (!releaseLock) {
      return; // Another process is handling this user
    }

    try {
      const now = new Date();

      // Step 1: Check if there's an active gift credit recharge for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existingGiftRecharge = await this.prisma.creditRecharge.findFirst({
        where: {
          uid,
          source: 'gift',
          enabled: true,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      if (existingGiftRecharge) {
        return; // Already has gift credits for today
      }

      // Step 2: Check if user has active subscription
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          uid,
          status: 'active',
          OR: [{ cancelAt: null }, { cancelAt: { gt: now } }],
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Step 3: Find plan quota for daily gift credit amount
      let plan: any = null;

      if (subscription) {
        // User has active subscription, check override plan first
        if (subscription.overridePlan) {
          const overridePlan = safeParseJSON(subscription.overridePlan);
          if (
            overridePlan &&
            typeof overridePlan.dailyGiftCreditQuota === 'number' &&
            overridePlan.dailyGiftCreditQuota > 0
          ) {
            plan = overridePlan;
          }
        }

        if (!plan) {
          const subscriptionPlan = await this.prisma.subscriptionPlan.findFirst({
            where: {
              planType: subscription.planType,
              interval: subscription.interval,
            },
          });
          if (subscriptionPlan && subscriptionPlan.dailyGiftCreditQuota > 0) {
            plan = {
              dailyGiftCreditQuota: subscriptionPlan.dailyGiftCreditQuota,
            };
          }
        }
      } else {
        // Free user without subscription, check for free plan
        const freePlan = await this.prisma.subscriptionPlan.findFirst({
          where: {
            planType: 'free',
            interval: null,
          },
        });
        if (freePlan && freePlan.dailyGiftCreditQuota > 0) {
          plan = {
            dailyGiftCreditQuota: freePlan.dailyGiftCreditQuota,
          };
        }
      }

      if (!plan || plan.dailyGiftCreditQuota <= 0) {
        return; // No daily gift quota
      }

      // Use the new method to create daily gift credit recharge
      await this.createDailyGiftCreditRecharge(
        uid,
        plan.dailyGiftCreditQuota,
        `Daily gift credit recharge for plan ${subscription?.planType ?? 'free'}`,
        now,
      );
    } catch (error) {
      this.logger.error(`Error in lazyLoadDailyGiftCredits for user ${uid}: ${error.message}`);
      // Don't throw error to avoid breaking the main flow
    } finally {
      // Always release the lock
      try {
        await releaseLock();
      } catch (lockError) {
        this.logger.warn(`Error releasing lock for user ${uid}: ${lockError.message}`);
      }
    }
  }

  async checkRequestCreditUsage(
    user: User,
    creditBilling: CreditBilling,
  ): Promise<CheckRequestCreditUsageResult> {
    const result: CheckRequestCreditUsageResult = {
      canUse: false,
      message: '',
    };

    try {
      // Check if user is early bird and model is early bird free
      const isEarlyBirdUser = await this.isEarlyBirdUser(user);
      if (isEarlyBirdUser && creditBilling?.isEarlyBirdFree) {
        result.canUse = true;
        result.message = 'Early bird user with early bird model - direct access granted';
        return result;
      }

      // Lazy load daily gift credits
      await this.lazyLoadDailyGiftCredits(user.uid);

      // Query all active credit recharge records for the user
      const creditRecharges = await this.prisma.creditRecharge.findMany({
        where: {
          uid: user.uid,
          enabled: true,
          balance: {
            gt: 0, // Only records with positive balance
          },
          expiresAt: {
            gte: new Date(),
          },
        },
        orderBy: {
          createdAt: 'asc', // Order by creation time (oldest first)
        },
      });

      // Calculate total available credit balance
      const totalBalance = creditRecharges.reduce((sum, record) => {
        return sum + record.balance;
      }, 0);

      // Check if total balance is greater than minimum charge
      const minCharge = creditBilling.minCharge;

      if (totalBalance >= minCharge) {
        result.canUse = true;
        result.message = `Available credits: ${totalBalance}, Required minimum: ${minCharge}`;
      } else {
        result.canUse = false;
        result.message = `Insufficient credits. Available: ${totalBalance}, Required minimum: ${minCharge}`;
      }
    } catch (error) {
      result.canUse = false;
      result.message = `Error checking credit balance: ${error.message}`;
    }
    return result;
  }

  /**
   * Deduct credits from user's recharge records and create usage record
   * If insufficient credits, create debt record instead of negative balance
   */
  private async deductCreditsAndCreateUsage(
    uid: string,
    creditCost: number,
    usageData: {
      usageId: string;
      actionResultId: string;
      providerItemId?: string;
      modelName?: string;
      usageType?: string;
      modelUsageDetails?: string;
      createdAt: Date;
    },
  ): Promise<void> {
    // Lazy load daily gift recharge
    await this.lazyLoadDailyGiftCredits(uid);

    // Get available credit recharge records ordered by expiresAt (oldest first)
    const creditRecharges = await this.prisma.creditRecharge.findMany({
      where: {
        uid,
        enabled: true,
        expiresAt: {
          gte: new Date(),
        },
        balance: {
          gt: 0,
        },
      },
      orderBy: {
        expiresAt: 'asc', // Deduct from earliest records first
      },
    });

    // Prepare deduction operations
    const deductionOperations = [];
    let remainingCost = creditCost;

    // Deduct from available credits first
    for (const recharge of creditRecharges) {
      if (remainingCost <= 0) break;

      const deductAmount = Math.min(recharge.balance, remainingCost);
      const newBalance = recharge.balance - deductAmount;

      deductionOperations.push(
        this.prisma.creditRecharge.update({
          where: { pk: recharge.pk },
          data: { balance: newBalance },
        }),
      );

      remainingCost -= deductAmount;
    }

    // If there's still remaining cost, create a debt record
    const transactionOperations = [
      // Create credit usage record
      this.prisma.creditUsage.create({
        data: {
          uid,
          usageId: usageData.usageId,
          providerItemId: usageData.providerItemId,
          actionResultId: usageData.actionResultId,
          modelName: usageData.modelName,
          usageType: usageData.usageType,
          modelUsageDetails: usageData.modelUsageDetails,
          amount: creditCost,
          createdAt: usageData.createdAt,
        },
      }),
      // Execute all deduction operations
      ...deductionOperations,
    ];

    // Add debt creation if needed
    if (remainingCost > 0) {
      transactionOperations.push(
        this.prisma.creditDebt.create({
          data: {
            debtId: genCreditDebtId(),
            uid,
            amount: remainingCost,
            balance: remainingCost,
            enabled: true,
            source: 'usage_overdraft',
            description: `Overdraft from usage: ${usageData.actionResultId}`,
            createdAt: usageData.createdAt,
            updatedAt: usageData.createdAt,
          },
        }),
      );
    }

    // Execute transaction
    await this.prisma.$transaction(transactionOperations);
  }

  private async isEarlyBirdUser(user: User) {
    // Get user's subscription to check if they are early bird user
    const userSubscription = await this.prisma.subscription.findFirst({
      where: {
        uid: user.uid,
        status: 'active',
        OR: [{ cancelAt: null }, { cancelAt: { gt: new Date() } }],
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (userSubscription?.overridePlan) {
      const overridePlan = safeParseJSON(userSubscription.overridePlan);
      return Boolean(overridePlan?.isEarlyBird);
    }
    return false;
  }

  async syncToolCreditUsage(data: SyncToolCreditUsageJobData) {
    const { uid, creditCost, timestamp, resultId, toolsetName, toolName } = data;

    // Find user
    const user = await this.prisma.user.findUnique({ where: { uid } });
    if (!user) {
      throw new Error(`No user found for uid ${uid}`);
    }

    // If no credit cost, just create usage record
    if (creditCost <= 0) {
      await this.prisma.creditUsage.create({
        data: {
          uid,
          usageId: genCreditUsageId(),
          actionResultId: resultId,
          usageType: 'tool_call',
          amount: 0,
          createdAt: timestamp,
          modelUsageDetails: JSON.stringify([
            {
              toolsetName,
              toolName,
            },
          ]),
        },
      });
      return;
    }

    // Use the extracted method to handle credit deduction
    await this.deductCreditsAndCreateUsage(uid, creditCost, {
      usageId: genCreditUsageId(),
      actionResultId: resultId,
      usageType: 'tool_call',
      createdAt: timestamp,
    });
  }

  async syncMediaCreditUsage(data: SyncMediaCreditUsageJobData) {
    const { uid, creditBilling, timestamp, resultId } = data;

    // Find user
    const user = await this.prisma.user.findUnique({ where: { uid } });
    if (!user) {
      throw new Error(`No user found for uid ${uid}`);
    }

    // Calculate credit cost directly from unitCost
    const creditCost = creditBilling?.unitCost || 0;

    // If no credit cost, just create usage record
    if (creditCost <= 0) {
      await this.prisma.creditUsage.create({
        data: {
          uid,
          usageId: genCreditUsageId(),
          actionResultId: resultId,
          usageType: 'media_generation',
          amount: 0,
          createdAt: timestamp,
        },
      });
      return;
    }

    // Use the extracted method to handle credit deduction
    await this.deductCreditsAndCreateUsage(uid, creditCost, {
      usageId: genCreditUsageId(),
      actionResultId: resultId,
      usageType: 'media_generation',
      createdAt: timestamp,
    });
  }

  async syncBatchTokenCreditUsage(data: SyncBatchTokenCreditUsageJobData) {
    const { uid, creditUsageSteps, timestamp, resultId } = data;

    // Find user
    const user = await this.prisma.user.findUnique({ where: { uid } });
    if (!user) {
      throw new Error(`No user found for uid ${uid}`);
    }

    // Check if user is early bird user
    const isEarlyBirdUser = await this.isEarlyBirdUser(user);

    // Calculate total credit cost for all usages
    let totalCreditCost = 0;
    const modelUsageDetails: ModelUsageDetail[] = [];

    for (const step of creditUsageSteps) {
      const { usage, creditBilling } = step;

      // Calculate tokens for this usage
      const totalTokens = usage.inputTokens + usage.outputTokens;

      // Calculate credit cost for this usage
      let creditCost = 0;
      if (creditBilling && creditBilling.unit === '5k_tokens') {
        // Round up to nearest 5k tokens (not enough 5K counts as 5K)
        const tokenUnits = Math.ceil(totalTokens / 5000);
        creditCost = tokenUnits * (creditBilling.unitCost || 0);
      }

      // Check if user is early bird and credit billing is free for early bird users
      if (isEarlyBirdUser && creditBilling?.isEarlyBirdFree) {
        this.logger.log(
          `Early bird user ${uid} skipping credit billing for model ${usage.modelName}`,
        );
        creditCost = 0;
      }

      totalCreditCost += creditCost;

      // Add to model usage details - model name, total tokens, and credit cost
      modelUsageDetails.push({
        modelName: usage.modelName,
        totalTokens: usage.inputTokens + usage.outputTokens,
        creditCost: creditCost,
      });
    }

    // If no credit cost, just create usage record with details
    if (totalCreditCost <= 0) {
      await this.prisma.creditUsage.create({
        data: {
          uid,
          usageId: genCreditUsageId(),
          actionResultId: resultId,
          amount: 0,
          modelUsageDetails: JSON.stringify(modelUsageDetails),
          createdAt: timestamp,
        },
      });
      return;
    }

    // Use the extracted method to handle credit deduction with model usage details
    await this.deductCreditsAndCreateUsage(uid, totalCreditCost, {
      usageId: genCreditUsageId(),
      actionResultId: resultId,
      modelUsageDetails: JSON.stringify(modelUsageDetails),
      createdAt: timestamp,
    });
  }

  async getCreditRecharge(
    user: User,
    pagination?: { page: number; pageSize: number },
  ): Promise<{ data: CreditRecharge[]; total: number; page: number; pageSize: number }> {
    await this.lazyLoadDailyGiftCredits(user.uid);

    const { page = 1, pageSize = 20 } = pagination ?? {};
    const skip = (page - 1) * pageSize;

    // Get total count
    const total = await this.prisma.creditRecharge.count({
      where: {
        uid: user.uid,
      },
    });

    // Get paginated records
    const records = await this.prisma.creditRecharge.findMany({
      where: {
        uid: user.uid,
      },
      select: {
        rechargeId: true,
        uid: true,
        amount: true,
        balance: true,
        enabled: true,
        source: true,
        description: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    });

    const data = records.map((record) => ({
      ...record,
      amount: Number(record.amount), // Convert BigInt to number
      balance: Number(record.balance), // Convert BigInt to number
      source: record.source as 'purchase' | 'gift' | 'promotion' | 'refund',
      expiresAt: record.expiresAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }));

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  async getCreditUsage(
    user: User,
    pagination?: { page: number; pageSize: number },
  ): Promise<{ data: CreditUsage[]; total: number; page: number; pageSize: number }> {
    const { page = 1, pageSize = 20 } = pagination ?? {};
    const skip = (page - 1) * pageSize;

    // Get total count
    const total = await this.prisma.creditUsage.count({
      where: {
        uid: user.uid,
      },
    });

    // Get paginated records
    const records = await this.prisma.creditUsage.findMany({
      where: {
        uid: user.uid,
      },
      select: {
        usageId: true,
        uid: true,
        amount: true,
        providerItemId: true,
        modelName: true,
        usageType: true,
        actionResultId: true,
        pilotSessionId: true,
        description: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc', // Order by creation time, newest first
      },
      skip,
      take: pageSize,
    });

    const data = records.map((record) => ({
      ...record,
      amount: Number(record.amount), // Convert BigInt to number
      usageType: record.usageType as
        | 'model_call'
        | 'media_generation'
        | 'embedding'
        | 'reranking'
        | 'other',
      createdAt: record.createdAt.toISOString(),
    }));

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  async getCreditBalance(user: User): Promise<CreditBalance> {
    // Lazy load daily gift credits
    await this.lazyLoadDailyGiftCredits(user.uid);

    // Query all active (unexpired) credit recharge records
    const activeRecharges = await this.prisma.creditRecharge.findMany({
      where: {
        uid: user.uid,
        enabled: true,
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
      select: {
        amount: true,
        balance: true,
      },
      orderBy: {
        expiresAt: 'asc',
      },
    });

    // Query active debts
    const activeDebts = await this.prisma.creditDebt.findMany({
      where: {
        uid: user.uid,
        enabled: true,
        balance: {
          gt: 0,
        },
      },
      select: {
        balance: true,
      },
    });

    // Calculate total balance and total amount
    const totalBalance = activeRecharges.reduce((sum, record) => {
      return sum + Number(record.balance); // Convert BigInt to number
    }, 0);

    const totalAmount = activeRecharges.reduce((sum, record) => {
      return sum + Number(record.amount); // Convert BigInt to number
    }, 0);

    const totalDebt = activeDebts.reduce((sum, debt) => {
      return sum + Number(debt.balance);
    }, 0);

    // Net balance is positive balance minus debt
    const netBalance = totalBalance - totalDebt;

    return {
      creditAmount: totalAmount,
      creditBalance: netBalance,
    };
  }
}

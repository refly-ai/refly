import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { CreditRechargeExtraData, CreditUsageExtraData, User } from '@refly/openapi-schema';
import { CreditBilling, CreditRecharge, CreditUsage, RawCanvasData } from '@refly/openapi-schema';
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
  genCreditPackRechargeId,
  genCommissionCreditUsageId,
  genCommissionCreditRechargeId,
  genRegistrationCreditRechargeId,
  genInvitationActivationCreditRechargeId,
} from '@refly/utils';

import { CreditBalance } from './credit.dto';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { ConfigService } from '@nestjs/config';
import { WorkflowAppNotFoundError } from '@refly/errors';
@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(
    protected readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly canvasSyncService: CanvasSyncService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Process credit recharge with debt payment
   * This method handles debt payment first, then creates a new credit recharge record
   */
  private async processCreditRecharge(
    uid: string,
    creditAmount: number,
    rechargeData: {
      rechargeId: string;
      source: 'gift' | 'subscription' | 'commission' | 'invitation' | 'purchase';
      description?: string;
      createdAt: Date;
      expiresAt: Date;
    },
    now: Date = new Date(),
    extraData?: CreditRechargeExtraData,
    appId?: string,
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
              rechargeId: rechargeData.rechargeId,
              uid,
              amount: remainingCredits,
              balance: remainingCredits,
              enabled: true,
              source: rechargeData.source,
              description: rechargeData.description,
              createdAt: rechargeData.createdAt,
              updatedAt: now,
              expiresAt: rechargeData.expiresAt,
              appId,
              extraData: JSON.stringify(extraData),
            },
          ],
          skipDuplicates: true,
        }),
      );
    }

    // Execute all operations in a transaction
    await this.prisma.$transaction(operations);

    this.logger.log(
      `Processed ${rechargeData.source} credit recharge for user ${uid}: ${creditAmount} credits total, ` +
        `${creditAmount - remainingCredits} used for debt payment, ` +
        `${remainingCredits} added as new balance, expires at ${rechargeData.expiresAt.toISOString()}`,
    );
  }

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
    // Set created time to start of today (00:00:00)
    const createdAt = new Date(now);
    createdAt.setHours(0, 0, 0, 0);

    // Set expires time to start of tomorrow (00:00:00)
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 1);
    expiresAt.setHours(0, 0, 0, 0);

    await this.processCreditRecharge(
      uid,
      creditAmount,
      {
        rechargeId: genDailyCreditRechargeId(uid, now),
        source: 'gift',
        description: description ?? 'Daily gift credit recharge',
        createdAt,
        expiresAt,
      },
      now,
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
    await this.processCreditRecharge(
      uid,
      creditAmount,
      {
        rechargeId: genSubscriptionRechargeId(uid, now),
        source: 'subscription',
        description,
        createdAt: now,
        expiresAt,
      },
      now,
    );
  }

  async createCreditPackRecharge(
    uid: string,
    creditAmount: number,
    sessionId: string,
    description?: string,
    now: Date = new Date(),
  ): Promise<void> {
    const expiresInDays = this.configService.get('credit.creditPackExpiresInDays');
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    await this.processCreditRecharge(
      uid,
      creditAmount,
      {
        rechargeId: genCreditPackRechargeId(uid, sessionId),
        source: 'purchase',
        description: description ?? 'Credit pack purchase',
        createdAt: now,
        expiresAt,
      },
      now,
    );
  }

  async createCommissionCreditUsageAndRecharge(
    uid: string,
    shareUserId: string,
    executionId: string,
    creditUsage: number,
    appId?: string,
    title?: string,
    shareId?: string,
  ): Promise<void> {
    const creditUsageId = genCommissionCreditUsageId(executionId);
    const creditRechargeId = genCommissionCreditRechargeId(executionId);

    // Calculate expiresAt for commission credit (1 month from now)
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(
      expiresAt.getMonth() + this.configService.get('credit.commissionCreditExpiresIn'),
    );

    await this.processCreditRecharge(
      shareUserId,
      creditUsage,
      {
        rechargeId: creditRechargeId,
        source: 'commission',
        description: `Commission credit for sharing execution ${executionId} from app ${appId}`,
        createdAt: now,
        expiresAt,
      },
      now,
      {
        executionId,
        shareId,
        title,
        appId,
        commissionRate: this.configService.get('credit.canvasCreditCommissionRate'),
      },
      appId,
    );
    await this.deductCreditsAndCreateUsage(
      uid,
      creditUsage,
      {
        usageId: creditUsageId,
        usageType: 'commission',
        createdAt: now,
        description: `Commission credit for sharing execution ${executionId} from app ${appId}`,
        appId,
      },
      creditUsage,
      {
        executionId,
        shareId,
        title,
        appId,
        commissionRate: this.configService.get('credit.canvasCreditCommissionRate'),
      },
    );
  }

  /**
   * Create registration credit recharge for a user
   * This method creates a one-time configurable credit registration bonus
   * Each user can only receive this bonus once (uid unique constraint)
   */
  async createRegistrationCreditRecharge(uid: string, now: Date = new Date()): Promise<void> {
    // Check if user already has registration bonus
    const existingBonus = await this.prisma.creditRecharge.findFirst({
      where: {
        uid,
        source: 'gift',
        description: 'Registration bonus credit recharge',
        enabled: true,
      },
    });

    if (existingBonus) {
      this.logger.log(`User ${uid} already has registration bonus, skipping`);
      return;
    }

    const bonusCreditAmount = this.configService.get('auth.registration.bonusCreditAmount');
    const bonusCreditExpiresInMonths = this.configService.get(
      'auth.registration.bonusCreditExpiresInMonths',
    );

    // Calculate expiration date
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + bonusCreditExpiresInMonths);

    await this.processCreditRecharge(
      uid,
      bonusCreditAmount,
      {
        rechargeId: genRegistrationCreditRechargeId(uid),
        source: 'gift',
        description: 'Registration bonus credit recharge',
        createdAt: now,
        expiresAt,
      },
      now,
    );

    this.logger.log(
      `Created registration bonus: ${uid} received ${bonusCreditAmount} credits, expires at ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Create invitation activation credit recharge for both inviter and invitee
   * Credit amounts and expiration periods are configurable
   */
  async createInvitationActivationCreditRecharge(
    inviterUid: string,
    inviteeUid: string,
    now: Date = new Date(),
  ): Promise<void> {
    const inviterCreditAmount = this.configService.get('auth.invitation.inviterCreditAmount');
    const inviteeCreditAmount = this.configService.get('auth.invitation.inviteeCreditAmount');
    const inviterCreditExpiresInMonths = this.configService.get(
      'auth.invitation.inviterCreditExpiresInMonths',
    );
    const inviteeCreditExpiresInMonths = this.configService.get(
      'auth.invitation.inviteeCreditExpiresInMonths',
    );

    // Calculate expiration dates
    const inviterExpiresAt = new Date(now);
    inviterExpiresAt.setMonth(inviterExpiresAt.getMonth() + inviterCreditExpiresInMonths);

    const inviteeExpiresAt = new Date(now);
    inviteeExpiresAt.setMonth(inviteeExpiresAt.getMonth() + inviteeCreditExpiresInMonths);

    // Create recharge for inviter
    await this.processCreditRecharge(
      inviterUid,
      inviterCreditAmount,
      {
        rechargeId: genInvitationActivationCreditRechargeId(inviterUid, inviteeUid),
        source: 'invitation',
        description: `Invitation activation bonus for inviting user ${inviteeUid}`,
        createdAt: now,
        expiresAt: inviterExpiresAt,
      },
      now,
    );

    // Create recharge for invitee
    await this.processCreditRecharge(
      inviteeUid,
      inviteeCreditAmount,
      {
        rechargeId: genInvitationActivationCreditRechargeId(inviteeUid, inviterUid),
        source: 'invitation',
        description: `Invitation activation bonus for being invited by user ${inviterUid}`,
        createdAt: now,
        expiresAt: inviteeExpiresAt,
      },
      now,
    );

    this.logger.log(
      `Created invitation activation credits: ${inviterUid} received ${inviterCreditAmount} credits (expires at ${inviterExpiresAt.toISOString()}), ${inviteeUid} received ${inviteeCreditAmount} credits (expires at ${inviteeExpiresAt.toISOString()})`,
    );
  }

  /**
   * Extract workflow app data from description
   * Returns title and shareId if description contains appId pattern
   */
  private async extractWorkflowAppData(
    description?: string,
  ): Promise<{ title?: string; shareId?: string }> {
    if (!description) {
      return {};
    }

    // Extract appId from description if it matches the pattern
    const appIdMatch = description.match(/from app ([\w-]+)$/);
    if (!appIdMatch) {
      return {};
    }

    const appId = appIdMatch[1];
    try {
      const workflowData = await this.getWorkflowTitleAndShareId(appId);
      return {
        title: workflowData.title,
        shareId: workflowData.shareId,
      };
    } catch (error) {
      // If workflow app not found or any other error, just return empty object
      this.logger.warn(`Failed to get workflow data for appId ${appId}: ${error.message}`);
      return {};
    }
  }

  async getWorkflowTitleAndShareId(appId: string) {
    const workflowApp = await this.prisma.workflowApp.findFirst({
      where: { appId },
    });
    if (!workflowApp) {
      throw new WorkflowAppNotFoundError();
    }

    // If the workflow app is deleted, don't return shareId
    const shareId = workflowApp.deletedAt ? undefined : workflowApp.shareId;

    return { title: workflowApp.title, shareId };
  }

  /**
   * Batch get workflow data for multiple appIds
   */
  private async batchGetWorkflowData(
    appIds: string[],
  ): Promise<Record<string, { title: string; shareId?: string }>> {
    if (appIds.length === 0) {
      return {};
    }

    const workflowApps = await this.prisma.workflowApp.findMany({
      where: {
        appId: {
          in: appIds,
        },
      },
    });

    const result: Record<string, { title: string; shareId?: string }> = {};
    for (const workflowApp of workflowApps) {
      // If the workflow app is deleted, don't return shareId
      const shareId = workflowApp.deletedAt ? undefined : workflowApp.shareId;
      result[workflowApp.appId] = { title: workflowApp.title, shareId };
    }

    return result;
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
   * @returns true if balance is zero or has debt after deduction, false otherwise
   */
  private async deductCreditsAndCreateUsage(
    uid: string,
    creditCost: number,
    usageData: {
      usageId: string;
      version?: number;
      actionResultId?: string;
      providerItemId?: string;
      modelName?: string;
      usageType?: string;
      modelUsageDetails?: string;
      createdAt: Date;
      description?: string;
      appId?: string;
    },
    dueAmount?: number,
    extraData?: CreditUsageExtraData,
  ): Promise<boolean> {
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
          version: usageData.version,
          modelName: usageData.modelName,
          usageType: usageData.usageType,
          modelUsageDetails: usageData.modelUsageDetails,
          amount: creditCost,
          dueAmount: dueAmount,
          createdAt: usageData.createdAt,
          description: usageData.description,
          appId: usageData.appId,
          extraData: JSON.stringify(extraData),
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
            description: `${usageData.description ?? ''} overdraft from usage: ${usageData.actionResultId}`,
            createdAt: usageData.createdAt,
            updatedAt: usageData.createdAt,
          },
        }),
      );
    }

    // Execute transaction
    await this.prisma.$transaction(transactionOperations);

    // Return true if balance is zero or has debt (remainingCost >= 0 indicates balance is zero or debt was created)
    return remainingCost >= 0;
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
    const { uid, creditCost, timestamp, resultId, toolsetName, toolName, version } = data;

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
          version,
          usageType: 'tool_call',
          amount: 0,
          createdAt: timestamp,
          description: `Tool call: ${toolsetName} ${toolName}`,
        },
      });
      return;
    }

    // Use the extracted method to handle credit deduction
    await this.deductCreditsAndCreateUsage(uid, creditCost, {
      usageId: genCreditUsageId(),
      actionResultId: resultId,
      version,
      usageType: 'tool_call',
      createdAt: timestamp,
      description: `Tool call: ${toolsetName} ${toolName}`,
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

  async syncBatchTokenCreditUsage(data: SyncBatchTokenCreditUsageJobData): Promise<boolean> {
    const { uid, creditUsageSteps, timestamp, resultId, version } = data;

    // Find user
    const user = await this.prisma.user.findUnique({ where: { uid } });
    if (!user) {
      throw new Error(`No user found for uid ${uid}`);
    }

    // Check if user is early bird user
    const isEarlyBirdUser = await this.isEarlyBirdUser(user);

    // Calculate total credit cost for all usages
    let totalCreditCost = 0;
    let originalDueAmount = 0; // Track original due amount regardless of early bird status
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

      // Track original due amount before early bird discount
      originalDueAmount += creditCost;

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

    // Always record the original due amount, even for early bird users
    const dueAmount = originalDueAmount > 0 ? originalDueAmount : totalCreditCost;

    // If no credit cost, just create usage record with details
    if (totalCreditCost <= 0) {
      await this.prisma.creditUsage.create({
        data: {
          uid,
          usageId: genCreditUsageId(),
          actionResultId: resultId,
          version,
          amount: 0,
          dueAmount,
          modelUsageDetails: JSON.stringify(modelUsageDetails),
          createdAt: timestamp,
        },
      });
      return;
    }

    // Use the extracted method to handle credit deduction with model usage details
    const requireRecharge = await this.deductCreditsAndCreateUsage(
      uid,
      totalCreditCost,
      {
        usageId: genCreditUsageId(),
        actionResultId: resultId,
        version,
        modelUsageDetails: JSON.stringify(modelUsageDetails),
        createdAt: timestamp,
      },
      dueAmount,
    );
    return requireRecharge;
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
        extraData: true,
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

    // Collect appIds that need to be queried for workflow data
    const appIdsToQuery: string[] = [];
    const recordAppIdMap: Record<string, string> = {};

    for (const record of records) {
      const extraData = record.extraData ? safeParseJSON(record.extraData) : null;

      // If extraData doesn't have title and shareId, extract appId from description
      if (!extraData?.title || !extraData?.shareId) {
        const appIdMatch = record.description?.match(/from app ([\w-]+)$/);
        if (appIdMatch) {
          const appId = appIdMatch[1];
          appIdsToQuery.push(appId);
          recordAppIdMap[record.rechargeId] = appId;
        }
      }
    }

    // Batch query workflow data
    const workflowDataMap = await this.batchGetWorkflowData(appIdsToQuery);

    const data = records.map((record) => {
      const extraData = record.extraData ? safeParseJSON(record.extraData) : null;
      let workflowData: { title?: string; shareId?: string } = {};

      // Use title and shareId from extraData if available
      if (extraData?.title && extraData?.shareId) {
        workflowData = {
          title: extraData.title,
          shareId: extraData.shareId,
        };
      } else {
        // Otherwise, use data from batch query
        const appId = recordAppIdMap[record.rechargeId];
        if (appId && workflowDataMap[appId]) {
          workflowData = workflowDataMap[appId];
        }
      }

      // Exclude extraData from the returned object as it's not part of the CreditRecharge type
      const { extraData: _, ...recordWithoutExtraData } = record;

      return {
        ...recordWithoutExtraData,
        amount: Number(record.amount), // Convert BigInt to number
        balance: Number(record.balance), // Convert BigInt to number
        source: record.source as 'purchase' | 'gift' | 'promotion' | 'refund',
        expiresAt: record.expiresAt.toISOString(),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        ...workflowData,
      };
    });

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
        extraData: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc', // Order by creation time, newest first
      },
      skip,
      take: pageSize,
    });

    // Collect appIds that need to be queried for workflow data
    const appIdsToQuery: string[] = [];
    const recordAppIdMap: Record<string, string> = {};

    for (const record of records) {
      const extraData = record.extraData ? safeParseJSON(record.extraData) : null;

      // If extraData doesn't have title and shareId, extract appId from description
      if (!extraData?.title || !extraData?.shareId) {
        const appIdMatch = record.description?.match(/from app ([\w-]+)$/);
        if (appIdMatch) {
          const appId = appIdMatch[1];
          appIdsToQuery.push(appId);
          recordAppIdMap[record.usageId] = appId;
        }
      }
    }

    // Batch query workflow data
    const workflowDataMap = await this.batchGetWorkflowData(appIdsToQuery);

    const data = records.map((record) => {
      const extraData = record.extraData ? safeParseJSON(record.extraData) : null;
      let workflowData: { title?: string; shareId?: string } = {};

      // Use title and shareId from extraData if available
      if (extraData?.title && extraData?.shareId) {
        workflowData = {
          title: extraData.title,
          shareId: extraData.shareId,
        };
      } else {
        // Otherwise, use data from batch query
        const appId = recordAppIdMap[record.usageId];
        if (appId && workflowDataMap[appId]) {
          workflowData = workflowDataMap[appId];
        }
      }

      // Exclude extraData from the returned object as it's not part of the CreditUsage type
      const { extraData: _, ...recordWithoutExtraData } = record;

      return {
        ...recordWithoutExtraData,
        amount: Number(record.amount), // Convert BigInt to number
        usageType: record.usageType as
          | 'model_call'
          | 'media_generation'
          | 'embedding'
          | 'reranking'
          | 'other',
        createdAt: record.createdAt.toISOString(),
        ...workflowData,
      };
    });

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
        source: true,
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

    // Calculate regular credits and template earnings credits
    const regularCredits =
      activeRecharges
        .filter((record) => record.source !== 'commission')
        .reduce((sum, record) => sum + Number(record.balance), 0) - totalDebt;

    const templateEarningsCredits = activeRecharges
      .filter((record) => record.source === 'commission')
      .reduce((sum, record) => sum + Number(record.balance), 0);

    return {
      creditAmount: totalAmount,
      creditBalance: netBalance,
      regularCredits: regularCredits,
      templateEarningsCredits: templateEarningsCredits,
    };
  }

  async countResultCreditUsage(user: User, resultId: string, version?: number): Promise<number> {
    // If version is specified, query for exact version
    if (version !== undefined) {
      const usages = await this.prisma.creditUsage.findMany({
        where: {
          uid: user.uid,
          actionResultId: resultId,
          version: version,
        },
      });

      // If no usage found for the specified version, return 0
      if (usages.length === 0) {
        return 0;
      }

      return usages.reduce((sum, usage) => {
        const dueAmount = usage.dueAmount ? Number(usage.dueAmount) : 0;
        return sum + (dueAmount > 0 ? dueAmount : Number(usage.amount));
      }, 0);
    }

    // If version is not specified, get the latest version
    const actionResult = await this.prisma.actionResult.findFirst({
      where: {
        resultId,
        uid: user.uid,
      },
      orderBy: {
        version: 'desc',
      },
    });

    if (!actionResult) {
      return 0;
    }

    // First try to find usages by the latest version
    const usages = await this.prisma.creditUsage.findMany({
      where: {
        actionResultId: resultId,
        version: actionResult.version,
      },
    });

    if (usages.length > 0) {
      return usages.reduce((sum, usage) => {
        const dueAmount = usage.dueAmount ? Number(usage.dueAmount) : 0;
        return sum + (dueAmount > 0 ? dueAmount : Number(usage.amount));
      }, 0);
    }

    // For backward compatibility with old data without version,
    // query all usages for this actionResultId and divide by version count
    const allUsages = await this.prisma.creditUsage.findMany({
      where: {
        actionResultId: resultId,
      },
    });

    if (allUsages.length === 0) {
      return 0;
    }

    const totalUsage = allUsages.reduce((sum, usage) => {
      const dueAmount = usage.dueAmount ? Number(usage.dueAmount) : 0;
      return sum + (dueAmount > 0 ? dueAmount : Number(usage.amount));
    }, 0);

    // Get the total number of versions for this resultId
    const versionCount = await this.prisma.actionResult.count({
      where: {
        resultId,
        uid: user.uid,
      },
    });

    // If no versions found, return total usage as is
    if (versionCount === 0) {
      return totalUsage;
    }

    // Return total usage divided by version count (ceiled to ensure integer)
    return Math.ceil(totalUsage / versionCount);
  }

  async countCanvasCreditUsage(user: User, canvasData: RawCanvasData): Promise<number> {
    const skillResponseNodes = canvasData.nodes.filter((node) => node.type === 'skillResponse');

    const creditCosts = await Promise.all(
      skillResponseNodes.map(async (node) => {
        const resultCreditUsage = await this.countResultCreditUsage(user, node.data.entityId);
        if (resultCreditUsage > 0) {
          return resultCreditUsage;
        }
        return typeof node.data?.metadata?.creditCost === 'number'
          ? node.data.metadata.creditCost
          : 0;
      }),
    );

    return creditCosts.reduce((sum, cost) => sum + cost, 0);
  }

  async countExecutionCreditUsageByExecutionId(user: User, executionId: string): Promise<number> {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: {
        executionId,
        uid: user.uid,
      },
    });
    if (!execution) {
      return 0;
    }
    const results = await this.prisma.actionResult.findMany({
      where: {
        targetId: execution.canvasId,
      },
    });
    const total = await Promise.all(
      results.map((result) => this.countResultCreditUsage(user, result.resultId)),
    );
    return total.reduce((sum, total) => {
      return sum + total;
    }, 0);
  }

  async countCanvasCreditUsageByCanvasId(user: User, canvasId: string): Promise<number> {
    const canvasData = await this.canvasSyncService.getCanvasData(user, { canvasId });
    const creditUsage = await this.countCanvasCreditUsage(user, canvasData);

    return creditUsage;
  }
}

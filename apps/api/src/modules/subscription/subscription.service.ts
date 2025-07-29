import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import Stripe from 'stripe';
import { InjectStripeClient } from '@golevelup/nestjs-stripe';
import { PrismaService } from '../common/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateCheckoutSessionRequest, SubscriptionUsageData, User } from '@refly/openapi-schema';
import {
  genTokenUsageMeterID,
  genStorageUsageMeterID,
  genCreditRechargeId,
  safeParseJSON,
} from '@refly/utils';
import {
  CreateSubscriptionParam,
  SyncTokenUsageJobData,
  SyncStorageUsageJobData,
  tokenUsageMeterPO2DTO,
  storageUsageMeterPO2DTO,
  CheckRequestUsageResult,
  CheckStorageUsageResult,
  SyncRequestUsageJobData,
  CheckFileParseUsageResult,
  PlanQuota,
} from '../subscription/subscription.dto';
import { pick } from '../../utils';
import {
  Subscription as SubscriptionModel,
  ModelInfo as ModelInfoModel,
} from '../../generated/client';
import { ConfigService } from '@nestjs/config';
import { OperationTooFrequent, ParamsError } from '@refly/errors';
import {
  QUEUE_CHECK_CANCELED_SUBSCRIPTIONS,
  QUEUE_EXPIRE_AND_RECHARGE_CREDITS,
} from '../../utils/const';
import { RedisService } from '../common/redis.service';

@Injectable()
export class SubscriptionService implements OnModuleInit {
  private logger = new Logger(SubscriptionService.name);
  private readonly INIT_TIMEOUT = 10000; // 10 seconds timeout

  private modelList: ModelInfoModel[];
  private modelListSyncedAt: Date | null = null;
  private modelListPromise: Promise<ModelInfoModel[]> | null = null;

  constructor(
    protected readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    @Optional() @InjectStripeClient() private readonly stripeClient?: Stripe,
    @Optional()
    @InjectQueue(QUEUE_CHECK_CANCELED_SUBSCRIPTIONS)
    private readonly checkCanceledSubscriptionsQueue?: Queue,
    @Optional()
    @InjectQueue(QUEUE_EXPIRE_AND_RECHARGE_CREDITS)
    private readonly expireAndRechargeCreditsQueue?: Queue,
  ) {}

  async onModuleInit() {
    if (this.checkCanceledSubscriptionsQueue) {
      const initPromise = this.setupSubscriptionCheckJobs();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(`Subscription cronjob timed out after ${this.INIT_TIMEOUT}ms`);
        }, this.INIT_TIMEOUT);
      });

      try {
        await Promise.race([initPromise, timeoutPromise]);
        this.logger.log('Subscription cronjob scheduled successfully');
      } catch (error) {
        this.logger.error(`Failed to schedule subscription cronjob: ${error}`);
        throw error;
      }
    } else {
      this.logger.log('Subscription queue not available, skipping cronjob setup');
    }

    if (this.expireAndRechargeCreditsQueue) {
      const initPromise = this.setupExpireAndRechargeCreditsJobs();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(`Credit cronjob timed out after ${this.INIT_TIMEOUT}ms`);
        }, this.INIT_TIMEOUT);
      });

      try {
        await Promise.race([initPromise, timeoutPromise]);
        this.logger.log('Credit cronjob scheduled successfully');
      } catch (error) {
        this.logger.error(`Failed to schedule credit cronjob: ${error}`);
        throw error;
      }
    } else {
      this.logger.log('Credit queue not available, skipping cronjob setup');
    }
  }

  private async setupSubscriptionCheckJobs() {
    if (!this.checkCanceledSubscriptionsQueue) return;

    // Remove any existing recurring jobs
    const existingJobs = await this.checkCanceledSubscriptionsQueue.getJobSchedulers();
    await Promise.all(
      existingJobs.map((job) => this.checkCanceledSubscriptionsQueue!.removeJobScheduler(job.id)),
    );

    // Add the new recurring job with concurrency options
    await this.checkCanceledSubscriptionsQueue.add(
      'check-canceled',
      {},
      {
        repeat: {
          pattern: '0 * * * *', // Run every hour
        },
        removeOnComplete: true,
        removeOnFail: false,
        // Add job options for distributed environment
        jobId: 'check-canceled-subscriptions', // Unique job ID to prevent duplicates
        attempts: 3, // Number of retry attempts
        backoff: {
          type: 'exponential',
          delay: 1000, // Initial delay in milliseconds
        },
      },
    );

    this.logger.log('Canceled subscriptions check job scheduled');
  }

  private async setupExpireAndRechargeCreditsJobs() {
    if (!this.expireAndRechargeCreditsQueue) return;

    // Remove any existing recurring jobs
    const existingJobs = await this.expireAndRechargeCreditsQueue.getJobSchedulers();
    await Promise.all(
      existingJobs.map((job) => this.expireAndRechargeCreditsQueue!.removeJobScheduler(job.id)),
    );

    // Add the new recurring job with concurrency options
    await this.expireAndRechargeCreditsQueue.add(
      'expire-and-recharge',
      {},
      {
        repeat: {
          // Run every minute
          pattern: '*/1 * * * *',
        },
        removeOnComplete: true,
        removeOnFail: false,
        // Add job options for distributed environment
        jobId: 'expire-and-recharge-credits', // Unique job ID to prevent duplicates
        attempts: 3, // Number of retry attempts
        backoff: {
          type: 'exponential',
          delay: 1000, // Initial delay in milliseconds
        },
      },
    );
    this.logger.log('Expire and recharge credits job scheduled');
  }

  async createCheckoutSession(user: User, param: CreateCheckoutSessionRequest) {
    const { uid } = user;
    const { planType, interval } = param;
    const userPo = await this.prisma.user.findUnique({ where: { uid } });

    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { planType, interval },
    });
    if (!plan) {
      throw new ParamsError(`No plan found for plan type: ${planType}`);
    }
    const lookupKey = plan.lookupKey;

    const prices = await this.stripeClient.prices.list({
      lookup_keys: [lookupKey],
      expand: ['data.product'],
    });
    if (prices.data.length === 0) {
      throw new ParamsError(`No prices found for lookup key: ${lookupKey}`);
    }

    // Try to find or create customer
    let customerId = userPo?.customerId;

    if (!customerId && userPo?.email) {
      // Search for existing customers with this email
      const existingCustomers = await this.stripeClient.customers.list({
        email: userPo.email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        // Use existing customer if found
        customerId = existingCustomers.data[0].id;

        // Update user with the found customerId
        await this.prisma.user.update({
          where: { uid },
          data: { customerId },
        });
      }
    }

    const price = prices.data[0];
    const session = await this.stripeClient.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: this.config.get('stripe.sessionSuccessUrl'),
      cancel_url: this.config.get('stripe.sessionCancelUrl'),
      client_reference_id: uid,
      customer: customerId || undefined,
      customer_email: !customerId ? userPo?.email : undefined,
      allow_promotion_codes: true,
      consent_collection: {
        terms_of_service: 'required',
      },
    });

    await this.prisma.$transaction([
      this.prisma.checkoutSession.create({
        data: {
          uid,
          sessionId: session.id,
          lookupKey,
        },
      }),
      // Only update if customer ID changed
      ...(!userPo?.customerId || userPo.customerId !== session.customer
        ? [
            this.prisma.user.update({
              where: { uid },
              data: { customerId: session.customer as string },
            }),
          ]
        : []),
    ]);

    return session;
  }

  async createPortalSession(user: User) {
    const userPo = await this.prisma.user.findUnique({
      select: { customerId: true, email: true },
      where: { uid: user?.uid },
    });
    if (!userPo) {
      throw new ParamsError(`No user found for uid ${user?.uid}`);
    }

    let customerId = userPo?.customerId;
    if (!customerId) {
      // Check if email exists before searching
      if (!userPo?.email) {
        throw new ParamsError(`User ${user?.uid} has no email address`);
      }

      // Search for existing customers with this email
      const existingCustomers = await this.stripeClient.customers.list({
        email: userPo.email,
        limit: 1,
      });

      if (existingCustomers?.data?.length > 0) {
        // Use existing customer if found
        customerId = existingCustomers.data[0]?.id;

        // Update user with the found customerId
        await this.prisma.user.update({
          where: { uid: user?.uid },
          data: { customerId },
        });
      } else {
        throw new ParamsError(`No customer found for user ${user?.uid}`);
      }
    }

    const session = await this.stripeClient.billingPortal.sessions.create({
      customer: customerId,
      return_url: this.config.get('stripe.portalReturnUrl'),
    });
    return session;
  }

  async getSubscription(subscriptionId: string) {
    return this.prisma.subscription.findUnique({
      where: { subscriptionId },
    });
  }

  /**
   * Create a credit recharge record for a user
   */
  private async createCreditRecharge(
    prisma: any,
    uid: string,
    creditAmount: number,
    expiresAt: Date,
    source = 'subscription',
    description?: string,
    now: Date = new Date(),
  ) {
    // Check for existing debts
    const activeDebts = await prisma.creditDebt.findMany({
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
        prisma.creditDebt.update({
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
        prisma.creditRecharge.create({
          data: {
            rechargeId: genCreditRechargeId(),
            uid,
            amount: remainingCredits,
            balance: remainingCredits,
            enabled: true,
            source,
            description,
            createdAt: now,
            updatedAt: now,
            expiresAt,
          },
        }),
      );
    }

    // Execute all operations in a transaction
    await Promise.all(operations);

    this.logger.log(
      `Processed credit recharge for user ${uid}: ${creditAmount} credits total, ` +
        `${creditAmount - remainingCredits} used for debt payment, ` +
        `${remainingCredits} added as new balance, expires at ${expiresAt.toISOString()}`,
    );
  }

  async createSubscription(uid: string, param: CreateSubscriptionParam) {
    this.logger.log(`Creating subscription for user ${uid}: ${JSON.stringify(param)}`);

    return this.prisma.$transaction(async (prisma) => {
      const now = new Date();

      const existingSub = await prisma.subscription.findUnique({
        where: { subscriptionId: param.subscriptionId },
      });
      if (existingSub) {
        this.logger.log(`Subscription ${param.subscriptionId} already exists`);
        return existingSub;
      }

      // Create a new subscription if needed
      const sub = await prisma.subscription.create({
        data: {
          subscriptionId: param.subscriptionId,
          lookupKey: param.lookupKey,
          planType: param.planType,
          interval: param.interval,
          uid,
          status: param.status,
        },
      });

      // Update user's subscriptionId
      await prisma.user.update({
        where: { uid },
        data: { subscriptionId: param.subscriptionId, customerId: param.customerId },
      });

      const plan = await this.prisma.subscriptionPlan.findFirst({
        where: { planType: sub.planType },
      });

      const endAt =
        sub.planType === 'free'
          ? null // one-time
          : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

      // Create a new token usage meter for this plan
      await prisma.tokenUsageMeter.create({
        data: {
          meterId: genTokenUsageMeterID(),
          uid,
          subscriptionId: sub.subscriptionId,
          startAt: startOfDay(now),
          endAt,
          t1CountQuota: plan?.t1CountQuota ?? this.config.get('quota.request.t1'),
          t1CountUsed: 0,
          t2CountQuota: plan?.t2CountQuota ?? this.config.get('quota.request.t2'),
          t2CountUsed: 0,
        },
      });

      // Create a new credit recharge record
      const creditAmount = plan?.creditQuota ?? this.config.get('quota.credit');
      await this.createCreditRecharge(prisma, uid, creditAmount, endAt, 'subscription');

      // Update storage usage meter
      await prisma.storageUsageMeter.updateMany({
        where: {
          uid,
          subscriptionId: null,
          deletedAt: null,
        },
        data: {
          subscriptionId: sub.subscriptionId,
          fileCountQuota: plan?.fileCountQuota ?? this.config.get('quota.storage.file'),
        },
      });

      return sub;
    });
  }

  async cancelSubscription(sub: SubscriptionModel) {
    await this.prisma.$transaction(async (prisma) => {
      // Mark the subscription as canceled
      await prisma.subscription.update({
        where: { subscriptionId: sub.subscriptionId },
        data: { status: 'canceled' },
      });

      const user = await prisma.user.findUnique({ where: { uid: sub.uid } });
      if (!user) {
        this.logger.error(`No user found for uid ${sub.uid}`);
        return;
      }

      // Proceed only if the user's current subscription matches the one to be canceled
      if (user.subscriptionId !== sub.subscriptionId) {
        this.logger.warn(`Subscription ${sub.subscriptionId} not valid for user ${user.uid}`);
        return;
      }

      // Remove user's subscriptionId
      await prisma.user.update({
        where: { uid: sub.uid },
        data: { subscriptionId: null },
      });

      const now = new Date();

      // Mark the token usage meter related to this subscription as deleted
      await prisma.tokenUsageMeter.updateMany({
        where: {
          uid: sub.uid,
          subscriptionId: sub.subscriptionId,
          startAt: { lte: now },
          endAt: { gte: now },
          deletedAt: null,
        },
        data: { deletedAt: now },
      });

      // Expire all active credit recharge records for this user
      await prisma.creditRecharge.updateMany({
        where: {
          uid: sub.uid,
          enabled: true,
          createdAt: {
            lte: now,
          },
          expiresAt: {
            gte: now,
          },
        },
        data: {
          enabled: false,
          updatedAt: now,
        },
      });

      this.logger.log(
        `Expired credit recharge records for user ${sub.uid} due to subscription cancellation`,
      );

      const freePlan = await this.prisma.subscriptionPlan.findFirst({
        where: { planType: 'free' },
      });

      // Update storage usage meter
      await prisma.storageUsageMeter.updateMany({
        where: {
          uid: user.uid,
          subscriptionId: sub.subscriptionId,
          deletedAt: null,
        },
        data: {
          subscriptionId: null,
          fileCountQuota: freePlan?.fileCountQuota ?? this.config.get('quota.storage.file'),
        },
      });
    });
  }

  async checkCanceledSubscriptions() {
    const now = new Date();
    const canceledSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        cancelAt: {
          lte: now,
        },
      },
    });

    for (const subscription of canceledSubscriptions) {
      this.logger.log(`Processing canceled subscription: ${subscription.subscriptionId}`);
      await this.cancelSubscription(subscription);
    }
  }

  async expireAndRechargeCredits() {
    this.logger.log('Starting expire and recharge credits job');

    try {
      await this.prisma.$transaction(async (prisma) => {
        const now = new Date();

        // Step 1: Find all non-duplicate credit recharge records that are expired but not disabled
        const activeRecharges = await prisma.creditRecharge.findMany({
          where: {
            expiresAt: {
              lte: now,
            },
            enabled: true,
          },
          distinct: ['rechargeId'],
          orderBy: {
            createdAt: 'desc',
          },
        });

        this.logger.log(`Found ${activeRecharges.length} active credit recharge records`);

        // Step 2: Disable all active recharge records
        if (activeRecharges.length > 0) {
          await prisma.creditRecharge.updateMany({
            where: {
              rechargeId: {
                in: activeRecharges.map((r) => r.rechargeId),
              },
            },
            data: {
              enabled: false,
            },
          });

          this.logger.log(`Disabled ${activeRecharges.length} credit recharge records`);
        }

        // Step 3: Process subscription-based and gift recharges
        const subscriptionRecharges = activeRecharges.filter(
          (r) => r.source === 'subscription' || r.source === 'gift',
        );

        for (const recharge of subscriptionRecharges) {
          try {
            // Check if user has active subscription
            const subscription = await prisma.subscription.findFirst({
              where: {
                uid: recharge.uid,
                status: 'active',
                OR: [{ cancelAt: null }, { cancelAt: { gt: now } }],
              },
              orderBy: {
                createdAt: 'desc',
              },
            });

            if (!subscription) {
              this.logger.log(
                `No active subscription found for user ${recharge.uid}, skipping credit recharge`,
              );
              continue;
            }

            // Find plan quota for credit amount
            let plan: PlanQuota | null = null;
            if (subscription.overridePlan) {
              plan = safeParseJSON(subscription.overridePlan) as PlanQuota;
            }
            if (!plan) {
              const subscriptionPlan = await prisma.subscriptionPlan.findFirst({
                where: {
                  planType: subscription.planType,
                  interval: subscription.interval,
                },
              });
              if (subscriptionPlan) {
                plan = {
                  creditQuota: subscriptionPlan.creditQuota,
                  dailyGiftCreditQuota: subscriptionPlan.dailyGiftCreditQuota,
                  t1CountQuota: subscriptionPlan.t1CountQuota,
                  t2CountQuota: subscriptionPlan.t2CountQuota,
                  fileCountQuota: subscriptionPlan.fileCountQuota,
                };
              }
            }

            if (!plan) {
              this.logger.log(`No plan found for user ${recharge.uid}, skipping credit recharge`);
              continue;
            }

            // Handle subscription source - monthly recharge with creditQuota
            if (recharge.source === 'subscription' && plan.creditQuota > 0) {
              const newExpiresAt = new Date();
              newExpiresAt.setMonth(newExpiresAt.getMonth() + 1);

              await this.createCreditRecharge(
                prisma,
                recharge.uid,
                plan.creditQuota,
                newExpiresAt,
                'subscription',
                `Monthly subscription credit recharge for plan ${subscription.planType}`,
                now,
              );
            }

            // Handle gift source - daily recharge with dailyGiftCreditQuota
            if (recharge.source === 'gift' && plan.dailyGiftCreditQuota > 0) {
              const newExpiresAt = new Date();
              newExpiresAt.setDate(newExpiresAt.getDate() + 1);

              await this.createCreditRecharge(
                prisma,
                recharge.uid,
                plan.dailyGiftCreditQuota,
                newExpiresAt,
                'gift',
                `Daily gift credit recharge for plan ${subscription.planType}`,
                now,
              );
            }
          } catch (error) {
            this.logger.error(
              `Error processing subscription recharge for user ${recharge.uid}:`,
              error,
            );
            // Continue processing other records even if one fails
          }
        }
      });

      this.logger.log('Expire and recharge credits job completed successfully');
    } catch (error) {
      this.logger.error('Error in expire and recharge credits job:', error);
      throw error;
    }
  }

  async checkRequestUsage(user: User): Promise<CheckRequestUsageResult> {
    const result: CheckRequestUsageResult = { t1: false, t2: false, free: true };
    const userModel = await this.prisma.user.findUnique({ where: { uid: user.uid } });
    if (!userModel) {
      this.logger.error(`No user found for uid ${user.uid}`);
      return result;
    }

    try {
      const meter = await this.getOrCreateTokenUsageMeter(userModel);

      if (!meter) {
        this.logger.error(`Failed to get token usage meter for user ${user.uid}`);
        return result;
      }

      result.t1 = meter.t1CountQuota < 0 || meter.t1CountUsed < meter.t1CountQuota;
      result.t2 = meter.t2CountQuota < 0 || meter.t2CountUsed < meter.t2CountQuota;

      return result;
    } catch (error) {
      this.logger.error(`Error checking request usage for user ${user.uid}: ${error.message}`);
      return result;
    }
  }

  async checkStorageUsage(user: User): Promise<CheckStorageUsageResult> {
    const userModel = await this.prisma.user.findUnique({ where: { uid: user.uid } });
    if (!userModel) {
      this.logger.error(`No user found for uid ${user.uid}`);
      return { available: 0 };
    }

    try {
      const meter = await this.getOrCreateStorageUsageMeter(userModel);

      if (!meter) {
        this.logger.error(`Failed to get storage meter for user ${user.uid}`);
        return { available: 0 };
      }

      return {
        available:
          meter.fileCountQuota < 0
            ? Number.POSITIVE_INFINITY
            : meter.fileCountQuota - meter.fileCountUsed,
      };
    } catch (error) {
      this.logger.error(`Error checking storage usage for user ${user.uid}: ${error.message}`);
      return { available: 0 };
    }
  }

  async checkFileParseUsage(user: User): Promise<CheckFileParseUsageResult> {
    const userModel = await this.prisma.user.findUnique({ where: { uid: user.uid } });
    if (!userModel) {
      this.logger.error(`No user found for uid ${user.uid}`);
      return { pageUsed: 0, pageLimit: 0, available: 0 };
    }

    const pageSum = await this.prisma.fileParseRecord.aggregate({
      _sum: { numPages: true },
      where: {
        uid: user.uid,
        createdAt: { gte: startOfDay(new Date()) },
      },
    });
    const pageUsed = pageSum._sum.numPages ?? 0;

    let sub: SubscriptionModel | null = null;
    if (userModel.subscriptionId) {
      sub = await this.prisma.subscription.findUnique({
        where: { subscriptionId: userModel.subscriptionId },
      });
    }

    const planType = sub?.planType || 'free';
    const plan = await this.prisma.subscriptionPlan.findFirst({
      select: { fileParsePageLimit: true, fileUploadLimit: true },
      where: { planType },
    });
    const pageLimit = plan?.fileParsePageLimit ?? this.config.get('quota.fileParse.page');

    return {
      pageUsed,
      pageLimit,
      fileUploadLimit: plan?.fileUploadLimit ?? this.config.get('quota.fileUpload'),
      available: pageLimit < 0 ? Number.POSITIVE_INFINITY : pageLimit - pageUsed,
    };
  }

  async getOrCreateTokenUsageMeter(user: User, _sub?: SubscriptionModel) {
    const { uid } = user;
    const userPo = await this.prisma.user.findUnique({
      select: { subscriptionId: true },
      where: { uid },
    });

    if (!userPo) {
      this.logger.error(`No user found for uid ${uid}`);
      return null;
    }

    let sub: SubscriptionModel | null = _sub;

    if (userPo.subscriptionId && !sub) {
      sub = await this.prisma.subscription.findUnique({
        where: { subscriptionId: userPo.subscriptionId },
      });
    }

    const now = new Date();

    // Find existing active meter
    const lastMeter = await this.prisma.tokenUsageMeter.findFirst({
      where: {
        uid,
        subscriptionId: sub?.subscriptionId || null,
        deletedAt: null,
      },
      orderBy: {
        startAt: 'desc',
      },
    });

    // If the last meter is still active, return it
    if (lastMeter?.startAt < now && (!lastMeter.endAt || lastMeter.endAt > now)) {
      return lastMeter;
    }

    // Only allow one instance to create a new meter
    const lockKey = `token_meter_creation:${uid}`;

    // Try to acquire a lock
    const releaseLock = await this.redis.acquireLock(lockKey);

    if (!releaseLock) {
      throw new OperationTooFrequent();
    }

    try {
      // This instance got the lock, proceed with creation
      this.logger.log(`Creating new token usage meter for user ${uid}`);

      // Otherwise, create a new meter
      let startAt: Date;
      const planType = sub?.planType || 'free';
      if (planType === 'free') {
        startAt = startOfDay(now);
      } else {
        startAt = lastMeter?.endAt ?? startOfDay(now);
      }

      // For free plan, the meter ends at the next day
      // For paid plan, the meter ends at the next month
      const endAt =
        planType === 'free'
          ? new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate() + 1)
          : new Date(startAt.getFullYear(), startAt.getMonth() + 1, startAt.getDate());

      // Find plan quota
      let plan: PlanQuota | null = null;
      if (sub?.overridePlan) {
        plan = safeParseJSON(sub.overridePlan) as PlanQuota;
      }
      if (!plan) {
        plan = await this.prisma.subscriptionPlan.findFirst({
          where: { planType },
        });
      }

      // Create new meter
      const newMeter = await this.prisma.tokenUsageMeter.create({
        data: {
          meterId: genTokenUsageMeterID(),
          uid,
          subscriptionId: sub?.subscriptionId,
          startAt,
          endAt,
          t1CountQuota: plan?.t1CountQuota ?? this.config.get('quota.request.t1'),
          t1CountUsed: 0,
          t2CountQuota: plan?.t2CountQuota ?? this.config.get('quota.request.t2'),
          t2CountUsed: 0,
        },
      });

      return newMeter;
    } finally {
      // Always release the lock when done
      await releaseLock();
    }
  }

  async getOrCreateStorageUsageMeter(user: User, _sub?: SubscriptionModel) {
    const { uid } = user;
    const userPo = await this.prisma.user.findUnique({
      select: { subscriptionId: true },
      where: { uid },
    });

    if (!userPo) {
      this.logger.error(`No user found for uid ${uid}`);
      return null;
    }

    let sub: SubscriptionModel | null = _sub;

    if (userPo.subscriptionId && !sub) {
      sub = await this.prisma.subscription.findUnique({
        where: { subscriptionId: userPo.subscriptionId },
      });
    }

    const activeMeter = await this.prisma.storageUsageMeter.findFirst({
      where: {
        uid,
        deletedAt: null,
      },
    });
    if (activeMeter) {
      return activeMeter;
    }

    // Only allow one instance to create a new meter
    const lockKey = `storage_meter_creation:${uid}`;

    // Try to acquire a lock
    const releaseLock = await this.redis.acquireLock(lockKey);

    if (!releaseLock) {
      throw new OperationTooFrequent();
    }

    let plan: PlanQuota | null = null;
    if (sub?.overridePlan) {
      plan = safeParseJSON(sub.overridePlan) as PlanQuota;
    }
    if (!plan) {
      const planType = sub?.planType || 'free';
      plan = await this.prisma.subscriptionPlan.findFirst({
        where: { planType },
      });
    }

    const fileCountQuota = plan?.fileCountQuota ?? this.config.get('quota.storage.file');

    // Create new meter if none exists
    return this.prisma.storageUsageMeter.create({
      data: {
        meterId: genStorageUsageMeterID(),
        uid,
        subscriptionId: sub?.subscriptionId,
        fileCountQuota,
        fileCountUsed: 0,
      },
    });
  }

  async getOrCreateUsageMeter(
    user: User,
    _sub?: SubscriptionModel,
  ): Promise<SubscriptionUsageData> {
    const { uid } = user;
    const userPo = await this.prisma.user.findUnique({
      select: { subscriptionId: true },
      where: { uid },
    });

    if (!userPo) {
      this.logger.error(`No user found for uid ${uid}`);
      return null;
    }

    let sub: SubscriptionModel | null = _sub;

    if (userPo.subscriptionId && !sub) {
      sub = await this.prisma.subscription.findUnique({
        where: { subscriptionId: userPo.subscriptionId },
      });
    }

    const [tokenMeter, storageMeter, fileParseMeter] = await Promise.all([
      this.getOrCreateTokenUsageMeter(user, sub),
      this.getOrCreateStorageUsageMeter(user, sub),
      this.getFileParseUsageMeter(user),
    ]);

    return {
      token: tokenUsageMeterPO2DTO(tokenMeter),
      storage: storageUsageMeterPO2DTO(storageMeter),
      fileParsing: fileParseMeter,
    };
  }

  async getFileParseUsageMeter(user: User) {
    const usage = await this.checkFileParseUsage(user);
    return {
      pagesParsed: usage.pageUsed,
      pagesLimit: usage.pageLimit,
      fileUploadLimit: usage.fileUploadLimit,
    };
  }

  async syncRequestUsage(data: SyncRequestUsageJobData) {
    const { uid, tier } = data;

    if (!tier || tier === 'free') {
      return;
    }

    const user = await this.prisma.user.findUnique({ where: { uid } });
    if (!user) {
      this.logger.warn(`No user found for uid ${uid}`);
      return;
    }

    const meter = await this.getOrCreateTokenUsageMeter(user);
    if (!meter) {
      this.logger.warn(`No token usage meter found for user ${uid}`);
      return;
    }

    const requestCount = await this.prisma.actionResult.count({
      where: {
        uid,
        tier,
        createdAt: {
          gte: meter.startAt,
          ...(meter.endAt && { lte: meter.endAt }),
        },
        status: {
          in: ['waiting', 'executing', 'finish'],
        },
        duplicateFrom: null,
      },
    });

    await this.prisma.tokenUsageMeter.update({
      where: { pk: meter.pk },
      data: {
        [tier === 't1' ? 't1CountUsed' : 't2CountUsed']: requestCount,
      },
    });
  }

  async syncTokenUsage(data: SyncTokenUsageJobData) {
    const { uid, usage, timestamp } = data;
    const user = await this.prisma.user.findUnique({ where: { uid } });
    if (!user) {
      this.logger.warn(`No user found for uid ${uid}`);
      return;
    }

    await this.prisma.$transaction([
      this.prisma.tokenUsage.create({
        data: {
          ...pick(data, ['uid', 'resultId']),
          ...pick(usage, ['modelProvider', 'modelName', 'inputTokens', 'outputTokens']),
          tier: usage.tier ?? '',
        },
      }),
      ...(usage.tier !== 'free'
        ? [
            this.prisma.tokenUsageMeter.updateMany({
              where: {
                uid,
                startAt: { lte: timestamp },
                OR: [{ endAt: null }, { endAt: { gte: timestamp } }],
                subscriptionId: user.subscriptionId,
                deletedAt: null,
              },
              data: {
                [usage.tier === 't1' ? 't1TokenUsed' : 't2TokenUsed']: {
                  increment: usage.inputTokens + usage.outputTokens,
                },
              },
            }),
          ]
        : []),
    ]);
  }

  async syncStorageUsage(data: SyncStorageUsageJobData) {
    const { uid, timestamp } = data;

    try {
      const user = await this.prisma.user.findUnique({ where: { uid } });
      if (!user) {
        this.logger.error(`No user found for uid ${uid}`);
        return;
      }

      const activeMeter = await this.getOrCreateStorageUsageMeter(user);
      if (!activeMeter) {
        this.logger.error(`Failed to get storage meter for user ${uid}`);
        return;
      }

      // If the meter has been synced at a time after the timestamp, skip it
      if (activeMeter.syncedAt && activeMeter.syncedAt > timestamp) {
        this.logger.log(`Storage usage for user ${uid} already synced at ${activeMeter.syncedAt}`);
        return;
      }

      // Perform aggregate operations outside transaction
      const [resourceSizeSum, docSizeSum, fileSizeSum, resourceCount, docCount] = await Promise.all(
        [
          this.prisma.resource.aggregate({
            _sum: {
              storageSize: true,
              vectorSize: true,
            },
            where: { uid, deletedAt: null },
          }),
          this.prisma.document.aggregate({
            _sum: {
              storageSize: true,
              vectorSize: true,
            },
            where: { uid, deletedAt: null },
          }),
          this.prisma.staticFile.aggregate({
            _sum: {
              storageSize: true,
            },
            where: { uid, deletedAt: null },
          }),
          this.prisma.resource.count({ where: { uid, deletedAt: null } }),
          this.prisma.document.count({ where: { uid, deletedAt: null } }),
        ],
      );

      // Update meter with calculated values
      await this.prisma.storageUsageMeter.update({
        where: { meterId: activeMeter.meterId },
        data: {
          fileCountUsed: resourceCount + docCount,
          resourceSize: resourceSizeSum._sum.storageSize ?? BigInt(0),
          canvasSize: docSizeSum._sum.storageSize ?? BigInt(0),
          fileSize: fileSizeSum._sum.storageSize ?? BigInt(0),
          vectorStorageUsed:
            (resourceSizeSum._sum.vectorSize ?? BigInt(0)) +
            (docSizeSum._sum.vectorSize ?? BigInt(0)),
          syncedAt: timestamp,
        },
      });

      this.logger.debug(`Storage usage for user ${uid} synced at ${timestamp}`);
    } catch (error) {
      this.logger.error(`Error syncing storage usage for user ${uid}: ${error.stack}`);
    }
  }

  async getSubscriptionPlans() {
    return this.prisma.subscriptionPlan.findMany();
  }

  async getModelList() {
    if (
      this.modelListSyncedAt &&
      this.modelList?.length > 0 &&
      this.modelListSyncedAt > new Date(Date.now() - 1000 * 10)
    ) {
      return this.modelList;
    }

    if (this.modelListPromise) {
      return this.modelListPromise;
    }

    this.modelListPromise = this.fetchModelList();

    try {
      const models = await this.modelListPromise;
      return models;
    } finally {
      this.modelListPromise = null;
    }
  }

  private async fetchModelList(): Promise<ModelInfoModel[]> {
    const models = await this.prisma.modelInfo.findMany({
      where: { enabled: true },
    });
    this.modelList = models;
    this.modelListSyncedAt = new Date();
    return models;
  }
}

const startOfDay = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

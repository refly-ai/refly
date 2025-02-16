import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Stripe from 'stripe';
import { InjectStripeClient, StripeWebhookHandler } from '@golevelup/nestjs-stripe';
import { PrismaService } from '@/common/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CreateCheckoutSessionRequest,
  SubscriptionInterval,
  SubscriptionPlanType,
  User,
} from '@refly-packages/openapi-schema';
import { genTokenUsageMeterID, genStorageUsageMeterID } from '@refly-packages/utils';
import {
  CreateSubscriptionParam,
  SyncTokenUsageJobData,
  SyncStorageUsageJobData,
  tokenUsageMeterPO2DTO,
  storageUsageMeterPO2DTO,
  CheckRequestUsageResult,
  CheckStorageUsageResult,
  SyncRequestUsageJobData,
} from '@/subscription/subscription.dto';
import { pick } from '@/utils';
import {
  Subscription as SubscriptionModel,
  ModelInfo as ModelInfoModel,
  Prisma,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { ParamsError } from '@refly-packages/errors';
import { QUEUE_CHECK_CANCELED_SUBSCRIPTIONS } from '@/utils/const';

@Injectable()
export class SubscriptionService implements OnModuleInit {
  private logger = new Logger(SubscriptionService.name);
  private readonly INIT_TIMEOUT = 10000; // 10 seconds timeout

  private modelList: ModelInfoModel[];
  private modelListSyncedAt: Date | null = null;
  private modelListPromise: Promise<ModelInfoModel[]> | null = null;

  constructor(
    protected readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectStripeClient() private readonly stripeClient: Stripe,
    @InjectQueue(QUEUE_CHECK_CANCELED_SUBSCRIPTIONS)
    private readonly checkCanceledSubscriptionsQueue: Queue,
  ) {}

  async onModuleInit() {
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
  }

  private async setupSubscriptionCheckJobs() {
    // Remove any existing recurring jobs
    const existingJobs = await this.checkCanceledSubscriptionsQueue.getJobSchedulers();
    await Promise.all(
      existingJobs.map((job) => this.checkCanceledSubscriptionsQueue.removeJobScheduler(job.id)),
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

  async createCheckoutSession(user: User, param: CreateCheckoutSessionRequest) {
    const { uid } = user;
    const { planType, interval } = param;
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

    const price = prices.data[0];
    const session = await this.stripeClient.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: this.config.get('stripe.sessionSuccessUrl'),
      cancel_url: this.config.get('stripe.sessionCancelUrl'),
      client_reference_id: uid,
      customer_email: user.email,
    });

    await this.prisma.checkoutSession.create({
      data: {
        uid,
        sessionId: session.id,
        lookupKey,
      },
    });

    return session;
  }

  async createPortalSession(user: User) {
    const { customerId } = await this.prisma.user.findUnique({
      select: { customerId: true },
      where: { uid: user.uid },
    });
    if (!customerId) {
      throw new ParamsError(`No customer found for user ${user.uid}`);
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
          t1TokenQuota: plan?.t1TokenQuota ?? this.config.get('quota.token.t1'),
          t1TokenUsed: 0,
          t2CountQuota: plan?.t2CountQuota ?? this.config.get('quota.request.t2'),
          t2CountUsed: 0,
          t2TokenQuota: plan?.t2TokenQuota ?? this.config.get('quota.token.t2'),
          t2TokenUsed: 0,
        },
      });

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
          objectStorageQuota: plan?.objectStorageQuota ?? this.config.get('quota.storage.object'),
          vectorStorageQuota: plan?.vectorStorageQuota ?? this.config.get('quota.storage.vector'),
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
          objectStorageQuota:
            freePlan?.objectStorageQuota ?? this.config.get('quota.storage.object'),
          vectorStorageQuota:
            freePlan?.vectorStorageQuota ?? this.config.get('quota.storage.vector'),
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

  @StripeWebhookHandler('checkout.session.completed')
  async handleCheckoutSessionCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;
    this.logger.log(`Checkout session completed: ${JSON.stringify(session)}`);

    if (session.payment_status !== 'paid') {
      this.logger.warn(`Checkout session ${session.id} not paid`);
      return;
    }

    const uid = session.client_reference_id;
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    const checkoutSession = await this.prisma.checkoutSession.findFirst({
      where: { sessionId: session.id },
      orderBy: { pk: 'desc' },
    });

    if (!checkoutSession) {
      this.logger.error(`No checkout session found for session ${session.id}`);
      return;
    }

    if (checkoutSession.uid !== uid) {
      this.logger.error(`Checkout session ${session.id} does not match user ${uid}`);
      return;
    }

    await this.prisma.checkoutSession.update({
      where: { pk: checkoutSession.pk },
      data: {
        paymentStatus: session.payment_status,
        subscriptionId: session.subscription as string,
      },
    });

    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { lookupKey: checkoutSession.lookupKey },
    });
    if (!plan) {
      this.logger.error(`No plan found for lookup key: ${checkoutSession.lookupKey}`);
      return;
    }

    const { planType, interval } = plan;

    await this.createSubscription(uid, {
      planType: planType as SubscriptionPlanType,
      interval: interval as SubscriptionInterval,
      lookupKey: checkoutSession.lookupKey,
      status: 'active',
      subscriptionId,
      customerId,
    });

    this.logger.log(`Successfully processed checkout session ${session.id} for user ${uid}`);
  }

  @StripeWebhookHandler('customer.subscription.created')
  async handleSubscriptionCreated(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    this.logger.log(`New subscription created: ${subscription.id}`);
  }

  @StripeWebhookHandler('customer.subscription.updated')
  async handleSubscriptionUpdated(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    this.logger.log(`Subscription updated: ${subscription.id}`);

    const sub = await this.prisma.subscription.findUnique({
      where: { subscriptionId: subscription.id },
    });
    if (!sub) {
      this.logger.error(`No subscription found for subscription ${subscription.id}`);
      return;
    }

    const updates: Prisma.SubscriptionUpdateInput = {};
    if (subscription.status !== sub.status) {
      updates.status = subscription.status;
    }
    if (subscription.cancel_at && !sub.cancelAt) {
      updates.cancelAt = new Date(subscription.cancel_at * 1000);
    }

    if (Object.keys(updates).length > 0) {
      this.logger.log(
        `Subscription ${sub.subscriptionId} received updates: ${JSON.stringify(updates)}`,
      );
      await this.prisma.subscription.update({
        where: { subscriptionId: subscription.id },
        data: updates,
      });
    }
  }

  @StripeWebhookHandler('customer.subscription.deleted')
  async handleSubscriptionDeleted(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    this.logger.log(`Subscription deleted: ${subscription.id}`);

    const sub = await this.prisma.subscription.findUnique({
      where: { subscriptionId: subscription.id },
    });
    if (!sub) {
      this.logger.error(`No subscription found for subscription ${subscription.id}`);
      return;
    }

    if (sub.status === 'canceled') {
      this.logger.log(`Subscription ${sub.subscriptionId} already canceled`);
      return;
    }

    await this.cancelSubscription(sub);
  }

  async checkRequestUsage(user: User): Promise<CheckRequestUsageResult> {
    const result: CheckRequestUsageResult = { t1: false, t2: false, free: true };
    const userModel = await this.prisma.user.findUnique({ where: { uid: user.uid } });
    if (!userModel) {
      this.logger.error(`No user found for uid ${user.uid}`);
      return result;
    }

    const meter = await this.getOrCreateTokenUsageMeter(userModel);

    result.t1 = meter.t1CountQuota < 0 || meter.t1CountUsed < meter.t1CountQuota;
    result.t2 = meter.t2CountQuota < 0 || meter.t2CountUsed < meter.t2CountQuota;

    return result;
  }

  async checkStorageUsage(user: User): Promise<CheckStorageUsageResult> {
    const userModel = await this.prisma.user.findUnique({ where: { uid: user.uid } });
    if (!userModel) {
      this.logger.error(`No user found for uid ${user.uid}`);
      return { available: 0 };
    }

    const meter = await this.getOrCreateStorageUsageMeter(userModel);

    return {
      available:
        meter.fileCountQuota < 0
          ? Number.POSITIVE_INFINITY
          : meter.fileCountQuota - meter.fileCountUsed,
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

    return this.prisma.$transaction(async (prisma) => {
      const now = new Date();

      const lastMeter = await prisma.tokenUsageMeter.findFirst({
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

      const plan = await this.prisma.subscriptionPlan.findFirst({
        where: { planType },
      });

      return prisma.tokenUsageMeter.create({
        data: {
          meterId: genTokenUsageMeterID(),
          uid,
          subscriptionId: sub?.subscriptionId,
          startAt,
          endAt,
          t1CountQuota: plan?.t1CountQuota ?? this.config.get('quota.request.t1'),
          t1CountUsed: 0,
          t1TokenQuota: plan?.t1TokenQuota ?? this.config.get('quota.token.t1'),
          t1TokenUsed: 0,
          t2CountQuota: plan?.t2CountQuota ?? this.config.get('quota.request.t2'),
          t2CountUsed: 0,
          t2TokenQuota: plan?.t2TokenQuota ?? this.config.get('quota.token.t2'),
          t2TokenUsed: 0,
        },
      });
    });
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

    return this.prisma.$transaction(async (prisma) => {
      const activeMeter = await prisma.storageUsageMeter.findFirst({
        where: {
          uid,
          deletedAt: null,
        },
      });

      if (activeMeter) {
        return activeMeter;
      }

      // Find the storage quota for the plan
      const planType = sub?.planType || 'free';
      const plan = await this.prisma.subscriptionPlan.findFirst({
        where: { planType },
      });

      return prisma.storageUsageMeter.create({
        data: {
          meterId: genStorageUsageMeterID(),
          uid,
          subscriptionId: sub?.subscriptionId,
          fileCountQuota: plan?.fileCountQuota ?? this.config.get('quota.storage.file'),
          fileCountUsed: 0,
          objectStorageQuota: plan?.objectStorageQuota ?? this.config.get('quota.storage.object'),
          vectorStorageQuota: plan?.vectorStorageQuota ?? this.config.get('quota.storage.vector'),
        },
      });
    });
  }

  async getOrCreateUsageMeter(user: User, _sub?: SubscriptionModel) {
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

    const [tokenMeter, storageMeter] = await Promise.all([
      this.getOrCreateTokenUsageMeter(user, sub),
      this.getOrCreateStorageUsageMeter(user, sub),
    ]);

    return {
      token: tokenUsageMeterPO2DTO(tokenMeter),
      storage: storageUsageMeterPO2DTO(storageMeter),
    };
  }

  async syncRequestUsage(data: SyncRequestUsageJobData) {
    const { uid, tier } = data;

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
          ...pick(usage, ['tier', 'modelProvider', 'modelName', 'inputTokens', 'outputTokens']),
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

    const user = await this.prisma.user.findUnique({ where: { uid } });
    if (!user) {
      this.logger.error(`No user found for uid ${uid}`);
      return;
    }

    // this.logger.log(`Syncing storage usage for user ${uid}`);

    const activeMeter = await this.getOrCreateStorageUsageMeter(user);

    // If the meter has been synced at a time after the timestamp, skip it
    if (activeMeter.syncedAt && activeMeter.syncedAt > timestamp) {
      this.logger.log(`Storage usage for user ${uid} already synced at ${activeMeter.syncedAt}`);
      return;
    }

    await this.prisma.$transaction(async (prisma) => {
      const [resourceSizeSum, docSizeSum, fileSizeSum] = await Promise.all([
        prisma.resource.aggregate({
          _sum: {
            storageSize: true,
            vectorSize: true,
          },
          where: { uid, deletedAt: null },
        }),
        prisma.document.aggregate({
          _sum: {
            storageSize: true,
            vectorSize: true,
          },
          where: { uid, deletedAt: null },
        }),
        prisma.staticFile.aggregate({
          _sum: {
            storageSize: true,
          },
          where: { uid, deletedAt: null },
        }),
      ]);

      const [resourceCount, docCount] = await Promise.all([
        prisma.resource.count({ where: { uid, deletedAt: null } }),
        prisma.document.count({ where: { uid, deletedAt: null } }),
      ]);

      await prisma.storageUsageMeter.update({
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
    });

    // this.logger.log(`Storage usage for user ${uid} synced at ${timestamp}`);
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

  async getModelInfo(modelName: string) {
    const modelList = await this.getModelList();
    return modelList.find((model) => model.name === modelName);
  }
}

const startOfDay = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

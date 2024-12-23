import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Stripe from 'stripe';
import { InjectStripeClient, StripeWebhookHandler } from '@golevelup/nestjs-stripe';
import { PrismaService } from '@/common/prisma.service';
import { CreateCheckoutSessionRequest, PriceLookupKey, User } from '@refly-packages/openapi-schema';
import {
  genTokenUsageMeterID,
  genStorageUsageMeterID,
  getSubscriptionInfoFromLookupKey,
  defaultModelList,
} from '@refly-packages/utils';
import {
  CreateSubscriptionParam,
  SyncTokenUsageJobData,
  SyncStorageUsageJobData,
  tokenUsageMeterPO2DTO,
  storageUsageMeterPO2DTO,
  CheckTokenUsageResult,
  CheckStorageUsageResult,
} from '@/subscription/subscription.dto';
import { pick } from '@/utils';
import {
  Subscription as SubscriptionModel,
  User as UserModel,
  ModelInfo as ModelInfoModel,
  Prisma,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { ParamsError } from '@refly-packages/errors';

@Injectable()
export class SubscriptionService implements OnModuleInit {
  private logger = new Logger(SubscriptionService.name);

  private modelList: ModelInfoModel[];
  private modelListSyncedAt: Date | null = null;
  private modelListPromise: Promise<ModelInfoModel[]> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectStripeClient() private readonly stripeClient: Stripe,
  ) {}

  async onModuleInit() {
    let modelInfos = await this.prisma.modelInfo.findMany({
      where: { enabled: true },
    });
    if (modelInfos.length === 0) {
      modelInfos = await this.prisma.modelInfo.createManyAndReturn({
        data: defaultModelList,
      });
      this.logger.log(`Model info created: ${modelInfos.map((m) => m.name).join(',')}`);
    } else {
      this.logger.log(`Model info already configured: ${modelInfos.map((m) => m.name).join(',')}`);
    }

    this.modelList = modelInfos;
    this.modelListSyncedAt = new Date();

    const usageQuotas = await this.prisma.subscriptionUsageQuota.findMany({
      select: { planType: true },
    });
    if (usageQuotas.length === 0) {
      const created = await this.prisma.subscriptionUsageQuota.createManyAndReturn({
        data: [
          {
            planType: 'free',
            t1TokenQuota: 0,
            t2TokenQuota: 1_000_000,
            objectStorageQuota: 100 * 1024 * 1024, // 100 MB
            vectorStorageQuota: 10 * 1024 * 1024, // 10 MB
          },
          {
            planType: 'pro',
            t1TokenQuota: 1_000_000,
            t2TokenQuota: 5_000_000,
            objectStorageQuota: 10 * 1024 * 1024 * 1024, // 1 GB
            vectorStorageQuota: 100 * 1024 * 1024, // 100 MB
          },
        ],
      });
      this.logger.log(`Usage quota created for plans: ${created.map((q) => q.planType).join(',')}`);
    } else {
      this.logger.log(
        `Usage quota already configured for plans: ${usageQuotas.map((q) => q.planType).join(',')}`,
      );
    }
  }

  async createCheckoutSession(user: UserModel, param: CreateCheckoutSessionRequest) {
    const { uid } = user;
    const { lookupKey } = param;

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

  async createPortalSession(user: UserModel) {
    const session = await this.stripeClient.billingPortal.sessions.create({
      customer: user.customerId,
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
    return this.prisma.$transaction(async (prisma) => {
      const now = new Date();

      const user = await prisma.user.findUnique({ where: { uid } });

      // Check for existing subscription
      if (user.subscriptionId) {
        const subscription = await prisma.subscription.findUnique({
          where: { subscriptionId: user.subscriptionId },
        });
        if (
          subscription?.status === 'active' &&
          (!subscription.cancelAt || subscription.cancelAt > now)
        ) {
          return subscription;
        }
      }

      // Create a new subscription if needed
      const sub = await prisma.subscription.create({
        data: { ...param, uid },
      });

      // Update user's subscriptionId
      await prisma.user.update({
        where: { uid },
        data: { subscriptionId: sub.subscriptionId },
      });

      const usageQuota = await prisma.subscriptionUsageQuota.findUnique({
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
          t1TokenQuota: usageQuota?.t1TokenQuota || this.config.get('quota.token.t1'),
          t1TokenUsed: 0,
          t2TokenQuota: usageQuota?.t2TokenQuota || this.config.get('quota.token.t2'),
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
          objectStorageQuota:
            usageQuota?.objectStorageQuota || this.config.get('quota.storage.object'),
          vectorStorageQuota:
            usageQuota?.vectorStorageQuota || this.config.get('quota.storage.vector'),
        },
      });

      return sub;
    });
  }

  async cancelSubscription(sub: SubscriptionModel) {
    await this.prisma.$transaction(async (prisma) => {
      const user = await prisma.user.findUnique({ where: { uid: sub.uid } });
      if (!user) {
        this.logger.error(`No user found for uid ${sub.uid}`);
        return;
      }

      // Idempotency check
      if (!user.subscriptionId) {
        this.logger.error(`No subscription found for user ${sub.uid}`);
        return;
      }

      // Remove user's subscriptionId
      await prisma.user.update({
        where: { uid: sub.uid },
        data: { subscriptionId: null },
      });

      // Mark the subscription as canceled
      await prisma.subscription.update({
        where: { subscriptionId: sub.subscriptionId },
        data: { status: 'canceled' },
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

      const freeQuota = await prisma.subscriptionUsageQuota.findUnique({
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
          objectStorageQuota:
            freeQuota?.objectStorageQuota || this.config.get('quota.storage.object'),
          vectorStorageQuota:
            freeQuota?.vectorStorageQuota || this.config.get('quota.storage.vector'),
        },
      });
    });
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

    if (session.payment_status !== 'paid') {
      this.logger.log(`Checkout session ${session.id} is not paid`);
      return;
    }

    await this.prisma.user.update({
      where: { uid },
      data: { customerId },
    });

    this.logger.log(`Successfully processed checkout session ${session.id} for user ${uid}`);
  }

  @StripeWebhookHandler('customer.subscription.created')
  async handleSubscriptionCreated(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    this.logger.log(`New subscription created: ${subscription.id}`);

    const checkoutSession = await this.prisma.checkoutSession.findFirst({
      where: { subscriptionId: subscription.id, paymentStatus: 'paid' },
      orderBy: { pk: 'desc' },
    });
    if (!checkoutSession) {
      this.logger.error(`No checkout session found for subscription ${subscription.id}`);
      return;
    }
    const { uid } = checkoutSession;

    const { planType, interval } = getSubscriptionInfoFromLookupKey(
      checkoutSession.lookupKey as PriceLookupKey,
    );

    const sub = await this.createSubscription(uid, {
      planType,
      interval,
      lookupKey: checkoutSession.lookupKey,
      status: subscription.status,
      subscriptionId: subscription.id,
    });

    this.logger.log(`Subscription ${sub.subscriptionId} created for user ${uid}`);
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

  async checkTokenUsage(user: User): Promise<CheckTokenUsageResult> {
    const result: CheckTokenUsageResult = { t1: false, t2: false, free: true };
    const userModel = await this.prisma.user.findUnique({ where: { uid: user.uid } });
    if (!userModel) {
      this.logger.error(`No user found for uid ${user.uid}`);
      return result;
    }

    const meter = await this.getOrCreateTokenUsageMeter(userModel);

    result.t1 = meter.t1TokenUsed < meter.t1TokenQuota;
    result.t2 = meter.t2TokenUsed < meter.t2TokenQuota;

    return result;
  }

  async checkStorageUsage(user: User): Promise<CheckStorageUsageResult> {
    const result = { objectStorageAvailable: false, vectorStorageAvailable: false };

    const userModel = await this.prisma.user.findUnique({ where: { uid: user.uid } });
    if (!userModel) {
      this.logger.error(`No user found for uid ${user.uid}`);
      return result;
    }

    const meter = await this.getOrCreateStorageUsageMeter(userModel);

    result.objectStorageAvailable =
      meter.resourceSize + meter.canvasSize + meter.fileSize < meter.objectStorageQuota;
    result.vectorStorageAvailable = meter.vectorStorageUsed < meter.vectorStorageQuota;

    return result;
  }

  async getOrCreateTokenUsageMeter(user: UserModel, sub?: SubscriptionModel) {
    const { uid } = user;

    if (user.subscriptionId && !sub) {
      sub = await this.prisma.subscription.findUnique({
        where: { subscriptionId: user.subscriptionId },
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
      const startAt = lastMeter?.endAt ?? startOfDay(now);
      const planType = sub?.planType || 'free';
      const endAt =
        planType === 'free'
          ? null
          : new Date(startAt.getFullYear(), startAt.getMonth() + 1, startAt.getDate());

      const usageQuota = await prisma.subscriptionUsageQuota.findUnique({
        where: { planType },
      });

      return prisma.tokenUsageMeter.create({
        data: {
          meterId: genTokenUsageMeterID(),
          uid,
          subscriptionId: sub?.subscriptionId,
          startAt,
          endAt,
          t1TokenQuota: usageQuota?.t1TokenQuota || this.config.get('quota.token.t1'),
          t1TokenUsed: 0,
          t2TokenQuota: usageQuota?.t2TokenQuota || this.config.get('quota.token.t2'),
          t2TokenUsed: 0,
        },
      });
    });
  }

  async getOrCreateStorageUsageMeter(user: UserModel, sub?: SubscriptionModel) {
    const { uid } = user;

    if (user.subscriptionId && !sub) {
      sub = await this.prisma.subscription.findUnique({
        where: { subscriptionId: user.subscriptionId },
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
      const usageQuota = await prisma.subscriptionUsageQuota.findUnique({
        where: { planType },
      });

      return prisma.storageUsageMeter.create({
        data: {
          meterId: genStorageUsageMeterID(),
          uid,
          subscriptionId: sub?.subscriptionId,
          objectStorageQuota:
            usageQuota?.objectStorageQuota || this.config.get('quota.storage.object'),
          vectorStorageQuota:
            usageQuota?.vectorStorageQuota || this.config.get('quota.storage.vector'),
        },
      });
    });
  }

  async getOrCreateUsageMeter(user: UserModel, sub?: SubscriptionModel) {
    if (user.subscriptionId && !sub) {
      sub = await this.prisma.subscription.findUnique({
        where: { subscriptionId: user.subscriptionId },
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

      await prisma.storageUsageMeter.update({
        where: { meterId: activeMeter.meterId },
        data: {
          resourceSize: resourceSizeSum._sum.storageSize || 0,
          canvasSize: docSizeSum._sum.storageSize || 0,
          fileSize: fileSizeSum._sum.storageSize || 0,
          vectorStorageUsed:
            (resourceSizeSum._sum.vectorSize || BigInt(0)) +
            (docSizeSum._sum.vectorSize || BigInt(0)),
          syncedAt: timestamp,
        },
      });
    });

    // this.logger.log(`Storage usage for user ${uid} synced at ${timestamp}`);
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

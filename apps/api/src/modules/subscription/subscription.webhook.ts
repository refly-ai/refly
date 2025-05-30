import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { StripeWebhookHandler } from '@golevelup/nestjs-stripe';
import { PrismaService } from '../common/prisma.service';
import { SubscriptionService } from './subscription.service';
import { SubscriptionInterval, SubscriptionPlanType } from '@refly/openapi-schema';
import { Prisma } from '../../generated/client';

@Injectable()
export class SubscriptionWebhooks {
  private logger = new Logger(SubscriptionWebhooks.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

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

    // Check if customerId is already associated with this user
    const user = await this.prisma.user.findUnique({
      where: { uid },
      select: { customerId: true },
    });

    // Update user's customerId if it's missing or different
    if (!user?.customerId || user.customerId !== customerId) {
      await this.prisma.user.update({
        where: { uid },
        data: { customerId },
      });
    }

    const plan = await this.prisma.subscriptionPlan.findFirstOrThrow({
      where: { lookupKey: checkoutSession.lookupKey },
    });

    const { planType, interval } = plan;

    await this.subscriptionService.createSubscription(uid, {
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

    // Track status changes
    if (subscription.status !== sub.status) {
      updates.status = subscription.status;
    }

    // Track cancellation changes
    if (subscription.cancel_at && !sub.cancelAt) {
      updates.cancelAt = new Date(subscription.cancel_at * 1000);
    } else if (!subscription.cancel_at && sub.cancelAt) {
      // Handle cancellation removal (user undid cancellation)
      updates.cancelAt = null;
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

    await this.subscriptionService.cancelSubscription(sub);
  }
}

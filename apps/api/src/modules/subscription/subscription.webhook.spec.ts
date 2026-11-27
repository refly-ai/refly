import type Stripe from 'stripe';
import { SubscriptionWebhooks } from './subscription.webhook';

describe('SubscriptionWebhooks', () => {
  const buildWebhooks = (storedStatus: string) => {
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          subscriptionId: 'sub_1',
          status: storedStatus,
          cancelAt: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const webhooks = new SubscriptionWebhooks(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return { webhooks, prisma };
  };

  const updatedEvent = (status: string) =>
    ({
      id: 'evt_1',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_1', status, cancel_at: null } },
    }) as unknown as Stripe.Event;

  it('does not reactivate a canceled subscription when a late updated event arrives', async () => {
    const { webhooks, prisma } = buildWebhooks('canceled');

    await webhooks.handleSubscriptionUpdated(updatedEvent('active'));

    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('still applies status changes to a subscription that is not canceled', async () => {
    const { webhooks, prisma } = buildWebhooks('active');

    await webhooks.handleSubscriptionUpdated(updatedEvent('past_due'));

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { subscriptionId: 'sub_1' },
      data: { status: 'past_due' },
    });
  });
});

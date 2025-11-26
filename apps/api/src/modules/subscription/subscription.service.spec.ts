import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { Queue } from 'bullmq';
import { SubscriptionService } from './subscription.service';
import { ConfigService } from '@nestjs/config';
import { STRIPE_CLIENT_TOKEN } from '@golevelup/nestjs-stripe';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_CHECK_CANCELED_SUBSCRIPTIONS } from '../../utils/const';
import { PrismaService } from '../common/prisma.service';
import Stripe from 'stripe';
import { TokenUsageMeter } from '@prisma/client';
import { SubscriptionInterval, SubscriptionPlanType } from '@refly/openapi-schema';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  const prismaService = createMock<PrismaService>();
  const stripeClient = createMock<Stripe>();

  const mockQueue = {
    add: jest.fn(),
    getRepeatableJobs: jest.fn().mockResolvedValue([]),
    removeRepeatableByKey: jest.fn(),
  } as unknown as Queue;

  beforeEach(async () => {
    // Ensure all mock states are cleared before each test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'stripe.sessionSuccessUrl':
                  return 'https://success.url';
                case 'stripe.sessionCancelUrl':
                  return 'https://cancel.url';
                case 'stripe.portalReturnUrl':
                  return 'https://return.url';
                case 'quota.request.t1':
                  return 100;
                case 'quota.request.t2':
                  return 50;
                case 'quota.token.t1':
                  return 1000;
                case 'quota.token.t2':
                  return 500;
                case 'quota.storage.file':
                  return 10;
                case 'quota.storage.object':
                  return 1000000;
                case 'quota.storage.vector':
                  return 1000000;
                default:
                  return null;
              }
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: getQueueToken(QUEUE_CHECK_CANCELED_SUBSCRIPTIONS),
          useValue: mockQueue,
        },
        {
          provide: STRIPE_CLIENT_TOKEN,
          useValue: stripeClient,
        },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);

    const mockPlan = {
      planType: 'maker' as SubscriptionPlanType,
      interval: 'monthly' as SubscriptionInterval,
      lookupKey: 'maker_monthly',
    };

    // Mock subscriptionPlans
    (service as any).subscriptionPlans = [mockPlan];
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCheckoutSession', () => {
    it('should create a checkout session successfully', async () => {
      const mockUser = { uid: 'test-uid', email: 'test@example.com' };
      const mockPrice = { id: 'price_123', product: 'prod_123' };
      const mockSession = { id: 'cs_123', url: 'https://checkout.url' };

      // Mock Stripe responses
      (stripeClient.prices.list as jest.Mock).mockResolvedValue({ data: [mockPrice] });
      (stripeClient.checkout.sessions.create as jest.Mock).mockResolvedValue(mockSession);

      const result = await service.createCheckoutSession(mockUser, {
        planType: 'maker' as SubscriptionPlanType,
        interval: 'monthly',
      });

      expect(result).toEqual(mockSession);
      expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith({
        mode: 'subscription',
        line_items: [{ price: mockPrice.id, quantity: 1 }],
        success_url: 'https://success.url',
        cancel_url: 'https://cancel.url',
        client_reference_id: mockUser.uid,
        customer_email: mockUser.email,
      });
    });

    it('should throw error when plan not found', async () => {
      const mockUser = { uid: 'test-uid', email: 'test@example.com' };

      await expect(
        service.createCheckoutSession(mockUser, {
          planType: 'non-existing' as SubscriptionPlanType,
          interval: 'monthly',
        }),
      ).rejects.toThrow('No plan found for plan type: non-existing');
    });
  });

  describe('createPortalSession', () => {
    it('should create a portal session successfully', async () => {
      const mockUser = { uid: 'test-uid' };
      const mockCustomerId = 'cus_123';
      const mockSession = { id: 'ps_123', url: 'https://portal.url' };

      // Mock user lookup
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        customerId: mockCustomerId,
      });

      // Mock Stripe response
      (stripeClient.billingPortal.sessions.create as jest.Mock).mockResolvedValue(mockSession);

      const result = await service.createPortalSession(mockUser);

      expect(result).toEqual(mockSession);
      expect(stripeClient.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: mockCustomerId,
        return_url: 'https://return.url',
      });
    });

    it('should throw error when customer not found', async () => {
      const mockUser = { uid: 'test-uid' };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({ customerId: null });

      await expect(service.createPortalSession(mockUser)).rejects.toThrow(
        'No customer found for user test-uid',
      );
    });
  });

  describe('checkRequestUsage', () => {
    it('should return usage status correctly', async () => {
      const mockUser = { uid: 'test-uid' };
      const mockMeter: TokenUsageMeter = {
        pk: 1 as any,
        meterId: 'test-meter-id',
        uid: 'test-uid',
        subscriptionId: 'test-subscription-id',
        startAt: new Date(),
        endAt: new Date(),
        t1CountQuota: 100,
        t1CountUsed: 50,
        t2CountQuota: 50,
        t2CountUsed: 10,
        t1TokenQuota: 1000,
        t1TokenUsed: 500,
        t2TokenQuota: 500,
        t2TokenUsed: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // Mock getOrCreateTokenUsageMeter
      jest.spyOn(service, 'getOrCreateTokenUsageMeter').mockResolvedValue(mockMeter);

      const result = await service.checkRequestUsage(mockUser);

      expect(result).toEqual({
        t1: true,
        t2: true,
        free: true,
      });
    });

    it('should handle quota exceeded', async () => {
      const mockUser = { uid: 'test-uid' };
      const mockMeter: TokenUsageMeter = {
        pk: 1 as any,
        meterId: 'test-meter-id',
        uid: 'test-uid',
        subscriptionId: 'test-subscription-id',
        startAt: new Date(),
        endAt: new Date(),
        t1CountQuota: 100,
        t1CountUsed: 100,
        t2CountQuota: 50,
        t2CountUsed: 50,
        t1TokenQuota: 1000,
        t1TokenUsed: 1000,
        t2TokenQuota: 500,
        t2TokenUsed: 500,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      jest.spyOn(service, 'getOrCreateTokenUsageMeter').mockResolvedValue(mockMeter);

      const result = await service.checkRequestUsage(mockUser);

      expect(result).toEqual({
        t1: false,
        t2: false,
        free: true,
      });
    });
  });

  // describe('handleCheckoutSessionCompleted', () => {
  //   it('should process completed checkout session', async () => {
  //     const mockEvent = {
  //       data: {
  //         object: {
  //           id: 'cs_123',
  //           payment_status: 'paid',
  //           client_reference_id: 'test-uid',
  //           customer: 'cus_123',
  //           subscription: 'sub_123',
  //         },
  //       },
  //     } as Stripe.Event;

  //     const mockCheckoutSession = {
  //       sessionId: 'cs_123',
  //       uid: 'test-uid',
  //       lookupKey: 'pro_monthly',
  //     };

  //     // Mock checkoutSession lookup
  //     (prismaService.checkoutSession.findFirst as jest.Mock).mockResolvedValue(mockCheckoutSession);

  //     await service.handleCheckoutSessionCompleted(mockEvent);

  //     expect(prismaService.checkoutSession.update).toHaveBeenCalled();
  //     expect(prismaService.$transaction).toHaveBeenCalled();
  //   });

  //   it('should not process unpaid session', async () => {
  //     const mockEvent = {
  //       data: {
  //         object: {
  //           id: 'cs_124',
  //           payment_status: 'unpaid',
  //           client_reference_id: 'test-uid',
  //           customer: 'cus_123',
  //           subscription: 'sub_124',
  //         },
  //       },
  //     } as Stripe.Event;

  //     await service.handleCheckoutSessionCompleted(mockEvent);

  //     expect(prismaService.checkoutSession.update).not.toHaveBeenCalled();
  //     expect(prismaService.$transaction).not.toHaveBeenCalled();
  //   });
  // });
});

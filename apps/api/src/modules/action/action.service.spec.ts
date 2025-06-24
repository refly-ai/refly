import { Test, TestingModule } from '@nestjs/testing';
import { ActionService } from './action.service';
import { createMock } from '@golevelup/ts-jest';
import { PrismaService } from '../common/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';

describe('ActionService', () => {
  let service: ActionService;

  const prismaService = createMock<PrismaService>();
  const subscriptionService = createMock<SubscriptionService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionService,
        { provide: PrismaService, useValue: prismaService },
        { provide: SubscriptionService, useValue: subscriptionService },
      ],
    }).compile();

    service = module.get<ActionService>(ActionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

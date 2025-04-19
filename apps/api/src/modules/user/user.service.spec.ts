import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { createMock } from '@golevelup/ts-jest';
import { PrismaService } from '../common/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';

describe('UserService', () => {
  let service: UserService;

  const prismaService = createMock<PrismaService>();
  const subscriptionService = createMock<SubscriptionService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prismaService },
        { provide: SubscriptionService, useValue: subscriptionService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

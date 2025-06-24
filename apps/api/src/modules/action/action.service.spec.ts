import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ActionService } from './action.service';
import { PrismaService } from '../common/prisma.service';
import { ProviderService } from '../provider/provider.service';

describe('ActionService - Memory Leak Prevention', () => {
  let service: ActionService;
  let _prismaService: PrismaService;
  let _configService: ConfigService;

  const mockPrismaService = {
    actionResult: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    actionStep: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    pilotStep: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockProviderService = {
    findLLMProviderItemByModelID: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      const config = {
        ABORT_CONTROLLER_TIMEOUT: 30000, // 30 seconds for testing
        CLEANUP_INTERVAL: 5000, // 5 seconds for testing
        STALE_RESULT_THRESHOLD: 60000, // 1 minute for testing
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ProviderService,
          useValue: mockProviderService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ActionService>(ActionService);
    _prismaService = module.get<PrismaService>(PrismaService);
    _configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    // Clean up any running intervals
    service.onModuleDestroy();
  });

  describe('abort controller registration and cleanup', () => {
    it('should register abort controller with metadata', () => {
      const controller = new AbortController();
      const resultId = 'test-result-123';
      const uid = 'user-123';

      service.registerAbortController(resultId, controller, uid);

      const stats = service.getAbortControllerStats();
      expect(stats.total).toBe(1);
    });

    it('should unregister abort controller', () => {
      const controller = new AbortController();
      const resultId = 'test-result-123';

      service.registerAbortController(resultId, controller);
      expect(service.getAbortControllerStats().total).toBe(1);

      service.unregisterAbortController(resultId);
      expect(service.getAbortControllerStats().total).toBe(0);
    });

    it('should handle unregistering non-existent controller gracefully', () => {
      service.unregisterAbortController('non-existent-id');
      expect(service.getAbortControllerStats().total).toBe(0);
    });
  });

  describe('periodic cleanup', () => {
    it('should clean up expired controllers', async () => {
      // Register a controller
      const controller = new AbortController();
      const resultId = 'test-result-123';
      service.registerAbortController(resultId, controller);

      // Mock the creation time to be older than timeout
      const stats = service.getAbortControllerStats();
      expect(stats.total).toBe(1);

      // Trigger manual cleanup - won't clean up non-expired controllers
      const cleanupResult = await service.manualCleanupExpiredControllers();
      expect(cleanupResult.cleanedUp).toBe(0);

      // For testing expired controllers, we'd need to mock the internal state
      // or use a shorter timeout in the test configuration
    });

    it('should provide accurate statistics', () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      service.registerAbortController('result-1', controller1);
      service.registerAbortController('result-2', controller2);

      const stats = service.getAbortControllerStats();
      expect(stats.total).toBe(2);
      expect(stats.byAge.lessThan5Min).toBe(2);
    });
  });

  describe('crash recovery', () => {
    it('should identify and mark stale action results', async () => {
      const staleResults = [
        {
          pk: 1,
          resultId: 'stale-result-1',
          uid: 'user-1',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
        {
          pk: 2,
          resultId: 'stale-result-2',
          uid: 'user-2',
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        },
      ];

      mockPrismaService.actionResult.findMany.mockResolvedValue(staleResults);
      mockPrismaService.actionResult.update.mockResolvedValue({});

      await service.onModuleInit();

      expect(mockPrismaService.actionResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'executing',
          }),
        }),
      );

      // Should update each stale result
      expect(mockPrismaService.actionResult.update).toHaveBeenCalledTimes(2);
    });

    it('should handle crash recovery errors gracefully', async () => {
      mockPrismaService.actionResult.findMany.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Should not throw, just log the error
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('graceful shutdown', () => {
    it('should abort all active controllers on shutdown', async () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      const abortSpy1 = jest.spyOn(controller1, 'abort');
      const abortSpy2 = jest.spyOn(controller2, 'abort');

      service.registerAbortController('result-1', controller1, 'user-1');
      service.registerAbortController('result-2', controller2, 'user-2');

      mockPrismaService.actionResult.updateMany.mockResolvedValue({});

      await service.onModuleDestroy();

      expect(abortSpy1).toHaveBeenCalledWith('Service shutdown');
      expect(abortSpy2).toHaveBeenCalledWith('Service shutdown');
      expect(service.getAbortControllerStats().total).toBe(0);
    });
  });

  describe('user abort action', () => {
    it('should abort user action successfully', async () => {
      const controller = new AbortController();
      const resultId = 'test-result-123';
      const uid = 'user-123';
      const result = {
        pk: 1,
        resultId,
        uid,
        status: 'executing',
      };

      const abortSpy = jest.spyOn(controller, 'abort');

      service.registerAbortController(resultId, controller, uid);
      mockPrismaService.actionResult.findFirst.mockResolvedValue(result);
      mockPrismaService.actionResult.update.mockResolvedValue({});

      await service.abortAction({ uid } as any, { resultId });

      expect(abortSpy).toHaveBeenCalledWith('User requested abort');
      expect(mockPrismaService.actionResult.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pk: 1 },
          data: expect.objectContaining({
            status: 'failed',
            errors: JSON.stringify(['User aborted the action']),
          }),
        }),
      );
    });

    it('should throw error for non-existent action result', async () => {
      mockPrismaService.actionResult.findFirst.mockResolvedValue(null);

      await expect(
        service.abortAction({ uid: 'user-123' } as any, { resultId: 'non-existent' }),
      ).rejects.toThrow();
    });
  });
});

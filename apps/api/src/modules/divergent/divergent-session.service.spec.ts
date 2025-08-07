import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DivergentSessionService } from './divergent-session.service';
import { PrismaService } from '../common/prisma.service';
import { User } from '@refly/openapi-schema';
import { CreateDivergentSessionRequest, UpdateDivergentSessionRequest } from './divergent.dto';

describe('DivergentSessionService Database Operations', () => {
  let service: DivergentSessionService;
  let prisma: PrismaService;
  let module: TestingModule;

  // Mock user for testing
  const mockUser: User = {
    uid: 'test-user-session-operations-123',
    email: 'test@divergent-session.com',
  };

  // Mock Prisma service
  const mockPrismaService = {
    divergentSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        DivergentSessionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DivergentSessionService>(DivergentSessionService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Service Architecture', () => {
    it('should be properly instantiated with dependencies', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(DivergentSessionService);
      expect(service['prisma']).toBeDefined();
      expect(service['logger']).toBeInstanceOf(Logger);
    });
  });

  describe('createDivergentSession', () => {
    it('should create a new divergent session successfully', async () => {
      const request: CreateDivergentSessionRequest = {
        userIntent: 'Develop comprehensive blockchain scalability analysis for enterprise adoption',
        rootResultId: 'action-result-blockchain-enterprise-001',
        targetId: 'canvas-blockchain-scalability-456',
      };

      const mockCreatedSession = {
        sessionId: 'divergent-session-created-123',
        uid: mockUser.uid,
        userIntent: request.userIntent,
        rootResultId: request.rootResultId,
        currentLevel: 0,
        globalCompletionScore: 0,
        status: 'executing',
        finalOutputResultId: null,
        targetId: request.targetId,
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z'),
      };

      mockPrismaService.divergentSession.create.mockResolvedValue(mockCreatedSession);

      const result = await service.createDivergentSession(mockUser, request);

      // Verify Prisma call
      expect(mockPrismaService.divergentSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          uid: mockUser.uid,
          userIntent: request.userIntent,
          rootResultId: request.rootResultId,
          targetId: request.targetId,
          currentLevel: 0,
          globalCompletionScore: 0,
          status: 'executing',
        }),
      });

      // Verify response
      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.sessionId).toBe(mockCreatedSession.sessionId);
      expect(result.session?.uid).toBe(mockUser.uid);
      expect(result.message).toContain('successfully');
    });

    it('should validate required fields before creation', async () => {
      const invalidRequests = [
        {
          userIntent: '',
          rootResultId: 'valid-root-id',
          targetId: 'valid-target-id',
        },
        {
          userIntent: 'Valid intent',
          rootResultId: '',
          targetId: 'valid-target-id',
        },
        {
          userIntent: 'Valid intent',
          rootResultId: 'valid-root-id',
          targetId: '',
        },
      ];

      for (const invalidRequest of invalidRequests) {
        await expect(service.createDivergentSession(mockUser, invalidRequest)).rejects.toThrow();
      }

      // Ensure Prisma was never called with invalid data
      expect(mockPrismaService.divergentSession.create).not.toHaveBeenCalled();
    });

    it('should handle database creation errors gracefully', async () => {
      const request: CreateDivergentSessionRequest = {
        userIntent: 'Test error handling in session creation',
        rootResultId: 'action-result-error-test-001',
        targetId: 'canvas-error-handling-789',
      };

      const dbError = new Error('Database connection failed');
      mockPrismaService.divergentSession.create.mockRejectedValue(dbError);

      await expect(service.createDivergentSession(mockUser, request)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('getDivergentSession', () => {
    it('should retrieve an existing session successfully', async () => {
      const sessionId = 'divergent-session-retrieve-456';
      const mockSession = {
        sessionId,
        uid: mockUser.uid,
        userIntent: 'Test session retrieval functionality',
        rootResultId: 'action-result-retrieval-test-789',
        currentLevel: 2,
        globalCompletionScore: 0.6,
        status: 'executing',
        finalOutputResultId: null,
        targetId: 'canvas-retrieval-test-012',
        createdAt: new Date('2024-01-15T09:00:00Z'),
        updatedAt: new Date('2024-01-15T09:30:00Z'),
      };

      mockPrismaService.divergentSession.findFirst.mockResolvedValue(mockSession);

      const result = await service.getDivergentSession(mockUser, sessionId);

      // Verify Prisma call with proper filters
      expect(mockPrismaService.divergentSession.findFirst).toHaveBeenCalledWith({
        where: {
          sessionId,
          uid: mockUser.uid,
        },
      });

      // Verify returned data
      expect(result).toBeDefined();
      expect(result?.sessionId).toBe(sessionId);
      expect(result?.uid).toBe(mockUser.uid);
      expect(result?.currentLevel).toBe(2);
      expect(result?.globalCompletionScore).toBe(0.6);
    });

    it('should return null for non-existent sessions', async () => {
      const nonExistentSessionId = 'divergent-session-nonexistent-999';

      mockPrismaService.divergentSession.findFirst.mockResolvedValue(null);

      const result = await service.getDivergentSession(mockUser, nonExistentSessionId);

      expect(result).toBeNull();
      expect(mockPrismaService.divergentSession.findFirst).toHaveBeenCalledWith({
        where: {
          sessionId: nonExistentSessionId,
          uid: mockUser.uid,
        },
      });
    });

    it('should enforce user ownership in session retrieval', async () => {
      const sessionId = 'divergent-session-ownership-test';

      // Should include user UID in where clause
      await service.getDivergentSession(mockUser, sessionId);

      expect(mockPrismaService.divergentSession.findFirst).toHaveBeenCalledWith({
        where: {
          sessionId,
          uid: mockUser.uid, // Critical: must include user UID for security
        },
      });
    });
  });

  describe('updateDivergentSession', () => {
    it('should update session progress successfully', async () => {
      const updateRequest: UpdateDivergentSessionRequest = {
        sessionId: 'divergent-session-update-progress-001',
        currentLevel: 3,
        globalCompletionScore: 0.75,
        status: 'executing',
      };

      const mockUpdatedSession = {
        sessionId: updateRequest.sessionId,
        uid: mockUser.uid,
        userIntent: 'Original intent for update test',
        rootResultId: 'action-result-update-root-123',
        currentLevel: updateRequest.currentLevel,
        globalCompletionScore: updateRequest.globalCompletionScore,
        status: updateRequest.status,
        finalOutputResultId: null,
        targetId: 'canvas-update-test-456',
        createdAt: new Date('2024-01-15T08:00:00Z'),
        updatedAt: new Date('2024-01-15T10:30:00Z'),
      };

      mockPrismaService.divergentSession.update.mockResolvedValue(mockUpdatedSession);

      const result = await service.updateDivergentSession(mockUser, updateRequest);

      // Verify Prisma update call
      expect(mockPrismaService.divergentSession.update).toHaveBeenCalledWith({
        where: {
          sessionId: updateRequest.sessionId,
          uid: mockUser.uid,
        },
        data: {
          currentLevel: updateRequest.currentLevel,
          globalCompletionScore: updateRequest.globalCompletionScore,
          status: updateRequest.status,
        },
      });

      // Verify response
      expect(result.success).toBe(true);
      expect(result.session?.currentLevel).toBe(3);
      expect(result.session?.globalCompletionScore).toBe(0.75);
      expect(result.message).toContain('updated successfully');
    });

    it('should validate update constraints', async () => {
      const invalidUpdates = [
        {
          sessionId: 'test-session',
          currentLevel: -1, // Invalid: below 0
        },
        {
          sessionId: 'test-session',
          currentLevel: 6, // Invalid: above 5
        },
        {
          sessionId: 'test-session',
          globalCompletionScore: -0.1, // Invalid: below 0
        },
        {
          sessionId: 'test-session',
          globalCompletionScore: 1.1, // Invalid: above 1
        },
      ];

      for (const invalidUpdate of invalidUpdates) {
        await expect(service.updateDivergentSession(mockUser, invalidUpdate)).rejects.toThrow();
      }

      expect(mockPrismaService.divergentSession.update).not.toHaveBeenCalled();
    });

    it('should handle session completion updates', async () => {
      const completionUpdate: UpdateDivergentSessionRequest = {
        sessionId: 'divergent-session-completion-update',
        currentLevel: 4,
        globalCompletionScore: 0.95,
        status: 'completed',
        finalOutputResultId: 'action-result-final-comprehensive-output-789',
      };

      const mockCompletedSession = {
        ...completionUpdate,
        uid: mockUser.uid,
        userIntent: 'Test completion update',
        rootResultId: 'root-123',
        targetId: 'canvas-456',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.divergentSession.update.mockResolvedValue(mockCompletedSession);

      const result = await service.updateDivergentSession(mockUser, completionUpdate);

      expect(mockPrismaService.divergentSession.update).toHaveBeenCalledWith({
        where: {
          sessionId: completionUpdate.sessionId,
          uid: mockUser.uid,
        },
        data: expect.objectContaining({
          finalOutputResultId: completionUpdate.finalOutputResultId,
          status: 'completed',
        }),
      });

      expect(result.success).toBe(true);
      expect(result.session?.status).toBe('completed');
    });
  });

  describe('listDivergentSessions', () => {
    it('should list user sessions with default pagination', async () => {
      const mockSessions = [
        {
          sessionId: 'session-list-001',
          uid: mockUser.uid,
          userIntent: 'First session for listing test',
          rootResultId: 'root-001',
          currentLevel: 1,
          globalCompletionScore: 0.3,
          status: 'executing',
          finalOutputResultId: null,
          targetId: 'canvas-001',
          createdAt: new Date('2024-01-15T10:00:00Z'),
          updatedAt: new Date('2024-01-15T10:15:00Z'),
        },
        {
          sessionId: 'session-list-002',
          uid: mockUser.uid,
          userIntent: 'Second session for listing test',
          rootResultId: 'root-002',
          currentLevel: 3,
          globalCompletionScore: 0.8,
          status: 'completed',
          finalOutputResultId: 'final-002',
          targetId: 'canvas-002',
          createdAt: new Date('2024-01-15T09:00:00Z'),
          updatedAt: new Date('2024-01-15T11:00:00Z'),
        },
      ];

      mockPrismaService.divergentSession.findMany.mockResolvedValue(mockSessions);

      const result = await service.listDivergentSessions(mockUser);

      // Verify Prisma call with proper defaults
      expect(mockPrismaService.divergentSession.findMany).toHaveBeenCalledWith({
        where: { uid: mockUser.uid },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0,
      });

      // Verify results
      expect(result).toHaveLength(2);
      expect(result[0].sessionId).toBe('session-list-001');
      expect(result[1].sessionId).toBe('session-list-002');
    });

    it('should support custom pagination and status filtering', async () => {
      const options = {
        limit: 5,
        offset: 10,
        status: 'completed' as const,
      };

      mockPrismaService.divergentSession.findMany.mockResolvedValue([]);

      await service.listDivergentSessions(mockUser, options);

      expect(mockPrismaService.divergentSession.findMany).toHaveBeenCalledWith({
        where: {
          uid: mockUser.uid,
          status: 'completed',
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        skip: 10,
      });
    });

    it('should enforce maximum limit for performance', async () => {
      const options = { limit: 200 }; // Requesting too many

      mockPrismaService.divergentSession.findMany.mockResolvedValue([]);

      await service.listDivergentSessions(mockUser, options);

      // Should cap at 100 for performance
      expect(mockPrismaService.divergentSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });
  });

  describe('Error Handling and Security', () => {
    it('should handle database connection errors', async () => {
      const dbError = new Error('Database connection lost');
      mockPrismaService.divergentSession.findFirst.mockRejectedValue(dbError);

      await expect(service.getDivergentSession(mockUser, 'test-session')).rejects.toThrow(
        'Database connection lost',
      );
    });

    it('should ensure user isolation in all operations', async () => {
      const sessionId = 'security-test-session';

      // Test each method includes user UID in queries
      await service.getDivergentSession(mockUser, sessionId).catch(() => {});

      const updateRequest = { sessionId, currentLevel: 1 };
      await service.updateDivergentSession(mockUser, updateRequest).catch(() => {});

      // Verify all calls include user UID for security
      const calls = mockPrismaService.divergentSession.findFirst.mock.calls;
      calls.forEach((call) => {
        expect(call[0].where.uid).toBe(mockUser.uid);
      });
    });
  });
});

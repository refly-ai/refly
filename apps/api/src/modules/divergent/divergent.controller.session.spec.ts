import { Test, TestingModule } from '@nestjs/testing';
import { DivergentController } from './divergent.controller';
import { DivergentService } from './divergent.service';
import { DivergentSessionService } from './divergent-session.service';
import { User } from '@refly/openapi-schema';
import {
  CreateDivergentSessionRequest,
  UpdateDivergentSessionRequest,
  DivergentSessionResponse,
} from './divergent.dto';
import { DivergentSessionData } from './models/divergent-session.model';

describe('DivergentController Session Management APIs', () => {
  let controller: DivergentController;
  let divergentService: DivergentService;
  let sessionService: DivergentSessionService;
  let module: TestingModule;

  const mockUser: User = {
    uid: 'test-user-controller-sessions-456',
    email: 'test@session-controller.com',
  };

  const mockDivergentService = {
    getServiceInfo: jest.fn(),
  };

  const mockSessionService = {
    createDivergentSession: jest.fn(),
    getDivergentSession: jest.fn(),
    updateDivergentSession: jest.fn(),
    listDivergentSessions: jest.fn(),
    deleteDivergentSession: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      controllers: [DivergentController],
      providers: [
        {
          provide: DivergentService,
          useValue: mockDivergentService,
        },
        {
          provide: DivergentSessionService,
          useValue: mockSessionService,
        },
      ],
    }).compile();

    controller = module.get<DivergentController>(DivergentController);
    divergentService = module.get<DivergentService>(DivergentService);
    sessionService = module.get<DivergentSessionService>(DivergentSessionService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('POST /divergent/sessions - Create Session', () => {
    it('should create a new divergent session successfully', async () => {
      const createRequest: CreateDivergentSessionRequest = {
        userIntent: 'Create advanced machine learning model for predictive healthcare analytics',
        rootResultId: 'action-result-ml-healthcare-root-001',
        targetId: 'canvas-healthcare-ml-analysis-789',
      };

      const mockSessionData: DivergentSessionData = {
        sessionId: 'divergent-session-created-api-001',
        uid: mockUser.uid,
        userIntent: createRequest.userIntent,
        rootResultId: createRequest.rootResultId,
        currentLevel: 0,
        globalCompletionScore: 0,
        status: 'executing',
        targetId: createRequest.targetId,
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z'),
      };

      const mockResponse: DivergentSessionResponse = {
        session: mockSessionData,
        success: true,
        message: 'Session created successfully',
      };

      mockSessionService.createDivergentSession.mockResolvedValue(mockResponse);

      const result = await controller.createSession(mockUser, createRequest);

      // Verify service call
      expect(mockSessionService.createDivergentSession).toHaveBeenCalledWith(
        mockUser,
        createRequest,
      );

      // Verify response
      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
      expect(result.session?.sessionId).toBe('divergent-session-created-api-001');
      expect(result.session?.userIntent).toBe(createRequest.userIntent);
    });

    it('should handle session creation validation errors', async () => {
      const invalidRequest = {
        userIntent: '', // Invalid: empty
        rootResultId: 'valid-root-id',
        targetId: 'valid-target-id',
      };

      const validationError = new Error('User intent cannot be empty');
      mockSessionService.createDivergentSession.mockRejectedValue(validationError);

      await expect(controller.createSession(mockUser, invalidRequest)).rejects.toThrow(
        'User intent cannot be empty',
      );

      expect(mockSessionService.createDivergentSession).toHaveBeenCalledWith(
        mockUser,
        invalidRequest,
      );
    });

    it('should propagate service errors properly', async () => {
      const createRequest: CreateDivergentSessionRequest = {
        userIntent: 'Test error propagation',
        rootResultId: 'action-result-error-test-123',
        targetId: 'canvas-error-test-456',
      };

      const serviceError = new Error('Database connection failed');
      mockSessionService.createDivergentSession.mockRejectedValue(serviceError);

      await expect(controller.createSession(mockUser, createRequest)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('GET /divergent/sessions/:sessionId - Get Session', () => {
    it('should retrieve an existing session successfully', async () => {
      const sessionId = 'divergent-session-get-api-002';

      const mockSessionData: DivergentSessionData = {
        sessionId,
        uid: mockUser.uid,
        userIntent: 'Retrieve session test for API endpoint',
        rootResultId: 'action-result-retrieve-api-456',
        currentLevel: 2,
        globalCompletionScore: 0.65,
        status: 'executing',
        targetId: 'canvas-retrieve-api-789',
        createdAt: new Date('2024-01-15T09:00:00Z'),
        updatedAt: new Date('2024-01-15T09:45:00Z'),
      };

      mockSessionService.getDivergentSession.mockResolvedValue(mockSessionData);

      const result = await controller.getSession(mockUser, sessionId);

      // Verify service call
      expect(mockSessionService.getDivergentSession).toHaveBeenCalledWith(mockUser, sessionId);

      // Verify response
      expect(result).toEqual(mockSessionData);
      expect(result.sessionId).toBe(sessionId);
      expect(result.currentLevel).toBe(2);
      expect(result.globalCompletionScore).toBe(0.65);
    });

    it('should return null for non-existent sessions', async () => {
      const nonExistentSessionId = 'divergent-session-nonexistent-999';

      mockSessionService.getDivergentSession.mockResolvedValue(null);

      const result = await controller.getSession(mockUser, nonExistentSessionId);

      expect(result).toBeNull();
      expect(mockSessionService.getDivergentSession).toHaveBeenCalledWith(
        mockUser,
        nonExistentSessionId,
      );
    });

    it('should enforce user access control', async () => {
      const sessionId = 'session-access-control-test';

      // Service should be called with the specific user
      await controller.getSession(mockUser, sessionId);

      expect(mockSessionService.getDivergentSession).toHaveBeenCalledWith(mockUser, sessionId);
    });
  });

  describe('PUT /divergent/sessions/:sessionId - Update Session', () => {
    it('should update session progress successfully', async () => {
      const updateRequest: UpdateDivergentSessionRequest = {
        sessionId: 'divergent-session-update-api-003',
        currentLevel: 3,
        globalCompletionScore: 0.8,
        status: 'executing',
      };

      const mockUpdatedSession: DivergentSessionData = {
        sessionId: updateRequest.sessionId,
        uid: mockUser.uid,
        userIntent: 'Update session test for API endpoint',
        rootResultId: 'action-result-update-api-789',
        currentLevel: updateRequest.currentLevel,
        globalCompletionScore: updateRequest.globalCompletionScore,
        status: updateRequest.status,
        targetId: 'canvas-update-api-012',
        createdAt: new Date('2024-01-15T08:00:00Z'),
        updatedAt: new Date('2024-01-15T10:30:00Z'),
      };

      const mockResponse: DivergentSessionResponse = {
        session: mockUpdatedSession,
        success: true,
        message: 'Session updated successfully',
      };

      mockSessionService.updateDivergentSession.mockResolvedValue(mockResponse);

      const result = await controller.updateSession(mockUser, updateRequest);

      // Verify service call
      expect(mockSessionService.updateDivergentSession).toHaveBeenCalledWith(
        mockUser,
        updateRequest,
      );

      // Verify response
      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
      expect(result.session?.currentLevel).toBe(3);
      expect(result.session?.globalCompletionScore).toBe(0.8);
    });

    it('should handle session completion updates', async () => {
      const completionRequest: UpdateDivergentSessionRequest = {
        sessionId: 'divergent-session-completion-api-004',
        currentLevel: 4,
        globalCompletionScore: 0.95,
        status: 'completed',
        finalOutputResultId: 'action-result-final-api-output-123',
      };

      const mockCompletedSession: DivergentSessionData = {
        sessionId: completionRequest.sessionId,
        uid: mockUser.uid,
        userIntent: 'Test session completion via API',
        rootResultId: 'action-result-completion-root-456',
        currentLevel: completionRequest.currentLevel,
        globalCompletionScore: completionRequest.globalCompletionScore,
        status: 'completed',
        finalOutputResultId: completionRequest.finalOutputResultId,
        targetId: 'canvas-completion-api-789',
        createdAt: new Date('2024-01-15T08:00:00Z'),
        updatedAt: new Date('2024-01-15T11:00:00Z'),
      };

      const mockResponse: DivergentSessionResponse = {
        session: mockCompletedSession,
        success: true,
        message: 'Session completed successfully',
      };

      mockSessionService.updateDivergentSession.mockResolvedValue(mockResponse);

      const result = await controller.updateSession(mockUser, completionRequest);

      expect(result.session?.status).toBe('completed');
      expect(result.session?.finalOutputResultId).toBe(completionRequest.finalOutputResultId);
      expect(result.success).toBe(true);
    });

    it('should validate update constraints through service', async () => {
      const invalidUpdate = {
        sessionId: 'test-session',
        currentLevel: 10, // Invalid: above 5
      };

      const validationError = new Error('Current level must be between 0 and 5');
      mockSessionService.updateDivergentSession.mockRejectedValue(validationError);

      await expect(controller.updateSession(mockUser, invalidUpdate)).rejects.toThrow(
        'Current level must be between 0 and 5',
      );
    });
  });

  describe('GET /divergent/sessions - List Sessions', () => {
    it('should list user sessions with default options', async () => {
      const mockSessions: DivergentSessionData[] = [
        {
          sessionId: 'session-list-api-001',
          uid: mockUser.uid,
          userIntent: 'First session for API listing test',
          rootResultId: 'action-result-list-001',
          currentLevel: 1,
          globalCompletionScore: 0.3,
          status: 'executing',
          targetId: 'canvas-list-001',
          createdAt: new Date('2024-01-15T10:00:00Z'),
          updatedAt: new Date('2024-01-15T10:15:00Z'),
        },
        {
          sessionId: 'session-list-api-002',
          uid: mockUser.uid,
          userIntent: 'Second session for API listing test',
          rootResultId: 'action-result-list-002',
          currentLevel: 3,
          globalCompletionScore: 0.85,
          status: 'completed',
          finalOutputResultId: 'action-result-final-list-002',
          targetId: 'canvas-list-002',
          createdAt: new Date('2024-01-15T09:00:00Z'),
          updatedAt: new Date('2024-01-15T11:00:00Z'),
        },
      ];

      mockSessionService.listDivergentSessions.mockResolvedValue(mockSessions);

      const result = await controller.listSessions(mockUser);

      // Verify service call with default options
      expect(mockSessionService.listDivergentSessions).toHaveBeenCalledWith(mockUser, undefined);

      // Verify response
      expect(result).toEqual(mockSessions);
      expect(result).toHaveLength(2);
      expect(result[0].sessionId).toBe('session-list-api-001');
      expect(result[1].sessionId).toBe('session-list-api-002');
    });

    it('should support query parameters for filtering and pagination', async () => {
      const queryOptions = {
        limit: 5,
        offset: 10,
        status: 'completed' as const,
      };

      mockSessionService.listDivergentSessions.mockResolvedValue([]);

      await controller.listSessions(mockUser, queryOptions);

      expect(mockSessionService.listDivergentSessions).toHaveBeenCalledWith(mockUser, queryOptions);
    });

    it('should return empty array when user has no sessions', async () => {
      mockSessionService.listDivergentSessions.mockResolvedValue([]);

      const result = await controller.listSessions(mockUser);

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('DELETE /divergent/sessions/:sessionId - Delete Session', () => {
    it('should delete session successfully', async () => {
      const sessionId = 'divergent-session-delete-api-005';

      const mockDeletedSession: DivergentSessionData = {
        sessionId,
        uid: mockUser.uid,
        userIntent: 'Session to be deleted via API',
        rootResultId: 'action-result-delete-test-456',
        currentLevel: 2,
        globalCompletionScore: 0.4,
        status: 'failed', // Marked as failed (soft delete)
        targetId: 'canvas-delete-test-789',
        createdAt: new Date('2024-01-15T09:00:00Z'),
        updatedAt: new Date('2024-01-15T10:30:00Z'),
      };

      const mockResponse: DivergentSessionResponse = {
        session: mockDeletedSession,
        success: true,
        message: 'Session deleted successfully',
      };

      mockSessionService.deleteDivergentSession.mockResolvedValue(mockResponse);

      const result = await controller.deleteSession(mockUser, sessionId);

      // Verify service call
      expect(mockSessionService.deleteDivergentSession).toHaveBeenCalledWith(mockUser, sessionId);

      // Verify response
      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
      expect(result.session?.status).toBe('failed'); // Soft delete
      expect(result.message).toContain('deleted successfully');
    });

    it('should handle deletion of non-existent sessions', async () => {
      const nonExistentSessionId = 'non-existent-session-999';

      const notFoundError = new Error('Session not found');
      mockSessionService.deleteDivergentSession.mockRejectedValue(notFoundError);

      await expect(controller.deleteSession(mockUser, nonExistentSessionId)).rejects.toThrow(
        'Session not found',
      );
    });
  });

  describe('API Error Handling and Response Format', () => {
    it('should maintain consistent error response format', async () => {
      const createRequest: CreateDivergentSessionRequest = {
        userIntent: 'Test consistent error format',
        rootResultId: 'action-result-error-format-test',
        targetId: 'canvas-error-format-test',
      };

      const serviceError = new Error('Service temporarily unavailable');
      mockSessionService.createDivergentSession.mockRejectedValue(serviceError);

      await expect(controller.createSession(mockUser, createRequest)).rejects.toThrow(
        'Service temporarily unavailable',
      );
    });

    it('should handle concurrent requests properly', async () => {
      const sessionId = 'concurrent-test-session';

      const mockSessionData = {
        sessionId,
        uid: mockUser.uid,
        userIntent: 'Concurrent access test',
        rootResultId: 'root-concurrent',
        currentLevel: 1,
        globalCompletionScore: 0.5,
        status: 'executing' as const,
        targetId: 'canvas-concurrent',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSessionService.getDivergentSession.mockResolvedValue(mockSessionData);

      // Simulate concurrent GET requests
      const promises = [
        controller.getSession(mockUser, sessionId),
        controller.getSession(mockUser, sessionId),
        controller.getSession(mockUser, sessionId),
      ];

      const results = await Promise.all(promises);

      // All requests should succeed
      results.forEach((result) => {
        expect(result?.sessionId).toBe(sessionId);
      });

      // Service should be called for each request
      expect(mockSessionService.getDivergentSession).toHaveBeenCalledTimes(3);
    });
  });
});

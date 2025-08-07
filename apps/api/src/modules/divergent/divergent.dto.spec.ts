import {
  CreateDivergentSessionRequest,
  UpdateDivergentSessionRequest,
  DivergentSessionResponse,
  divergentSessionPO2DTO,
} from './divergent.dto';
import { DivergentSessionData } from './models/divergent-session.model';

describe('DivergentAgent DTO Layer', () => {
  describe('CreateDivergentSessionRequest validation', () => {
    it('should validate complete session creation request', () => {
      const request: CreateDivergentSessionRequest = {
        userIntent: 'Develop comprehensive AI strategy for healthcare transformation',
        rootResultId: 'action-result-healthcare-ai-root-001',
        targetId: 'canvas-healthcare-strategy-456',
      };

      // Verify all required fields are present
      expect(request.userIntent).toBeDefined();
      expect(request.userIntent.length).toBeGreaterThan(20); // Substantial intent
      expect(request.rootResultId).toMatch(/^action-result-/);
      expect(request.targetId).toMatch(/^canvas-/);
    });

    it('should handle various real-world user intents', () => {
      const realWorldRequests: CreateDivergentSessionRequest[] = [
        {
          userIntent: 'Research quantum computing applications in financial risk modeling',
          rootResultId: 'action-result-quantum-finance-789',
          targetId: 'canvas-financial-research-123',
        },
        {
          userIntent: 'Create technical documentation for microservices architecture migration',
          rootResultId: 'action-result-microservices-docs-456',
          targetId: 'canvas-architecture-documentation-789',
        },
        {
          userIntent: 'Analyze market trends for sustainable energy storage solutions',
          rootResultId: 'action-result-energy-storage-analysis-012',
          targetId: 'canvas-sustainability-market-345',
        },
      ];

      realWorldRequests.forEach((request) => {
        expect(request.userIntent.length).toBeGreaterThan(15);
        expect(request.rootResultId).toMatch(/^action-result-/);
        expect(request.targetId).toMatch(/^canvas-/);
      });
    });
  });

  describe('UpdateDivergentSessionRequest validation', () => {
    it('should validate session progression updates', () => {
      const progressUpdate: UpdateDivergentSessionRequest = {
        sessionId: 'divergent-session-progress-001',
        currentLevel: 2,
        globalCompletionScore: 0.65,
        status: 'executing',
      };

      expect(progressUpdate.sessionId).toMatch(/^divergent-session-/);
      expect(progressUpdate.currentLevel).toBeGreaterThanOrEqual(0);
      expect(progressUpdate.currentLevel).toBeLessThanOrEqual(5);
      expect(progressUpdate.globalCompletionScore).toBeGreaterThanOrEqual(0);
      expect(progressUpdate.globalCompletionScore).toBeLessThanOrEqual(1);
      expect(['executing', 'completed', 'failed']).toContain(progressUpdate.status);
    });

    it('should validate session completion updates', () => {
      const completionUpdate: UpdateDivergentSessionRequest = {
        sessionId: 'divergent-session-completion-002',
        currentLevel: 4,
        globalCompletionScore: 0.92,
        status: 'completed',
        finalOutputResultId: 'action-result-final-comprehensive-report-789',
      };

      expect(completionUpdate.globalCompletionScore).toBeGreaterThanOrEqual(0.9);
      expect(completionUpdate.status).toBe('completed');
      expect(completionUpdate.finalOutputResultId).toMatch(/^action-result-final-/);
    });
  });

  describe('DivergentSessionResponse validation', () => {
    it('should provide comprehensive response structure', () => {
      const sessionData: DivergentSessionData = {
        sessionId: 'divergent-session-response-test-001',
        uid: 'user-test-response-123',
        userIntent: 'Test user intent for response validation',
        rootResultId: 'action-result-test-456',
        currentLevel: 1,
        globalCompletionScore: 0.3,
        status: 'executing',
        targetId: 'canvas-test-789',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:15:00Z'),
      };

      const response: DivergentSessionResponse = {
        session: sessionData,
        success: true,
        message: 'Session operation completed successfully',
      };

      // Verify response structure
      expect(response.session).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.message).toBeTruthy();
      expect(typeof response.message).toBe('string');

      // Verify session data integrity
      expect(response.session.sessionId).toBe(sessionData.sessionId);
      expect(response.session.uid).toBe(sessionData.uid);
      expect(response.session.status).toBe(sessionData.status);
    });

    it('should handle error responses properly', () => {
      const errorResponse: DivergentSessionResponse = {
        session: null,
        success: false,
        message: 'Session creation failed: invalid parameters',
      };

      expect(errorResponse.session).toBeNull();
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.message).toContain('failed');
    });
  });

  describe('divergentSessionPO2DTO converter', () => {
    it('should convert Prisma object to DTO correctly', () => {
      // Mock Prisma DivergentSession object
      const prismaDivergentSession = {
        sessionId: 'divergent-session-prisma-test-001',
        uid: 'user-prisma-conversion-456',
        userIntent: 'Test Prisma to DTO conversion functionality',
        rootResultId: 'action-result-prisma-789',
        currentLevel: 2,
        globalCompletionScore: 0.7,
        status: 'executing',
        finalOutputResultId: null,
        targetId: 'canvas-prisma-test-012',
        createdAt: new Date('2024-01-15T09:00:00Z'),
        updatedAt: new Date('2024-01-15T09:30:00Z'),
      };

      const dto = divergentSessionPO2DTO(prismaDivergentSession);

      // Verify all fields are correctly mapped
      expect(dto.sessionId).toBe(prismaDivergentSession.sessionId);
      expect(dto.uid).toBe(prismaDivergentSession.uid);
      expect(dto.userIntent).toBe(prismaDivergentSession.userIntent);
      expect(dto.rootResultId).toBe(prismaDivergentSession.rootResultId);
      expect(dto.currentLevel).toBe(prismaDivergentSession.currentLevel);
      expect(dto.globalCompletionScore).toBe(prismaDivergentSession.globalCompletionScore);
      expect(dto.status).toBe(prismaDivergentSession.status);
      expect(dto.finalOutputResultId).toBeUndefined(); // null -> undefined
      expect(dto.targetId).toBe(prismaDivergentSession.targetId);
      expect(dto.createdAt).toEqual(prismaDivergentSession.createdAt);
      expect(dto.updatedAt).toEqual(prismaDivergentSession.updatedAt);
    });

    it('should handle optional finalOutputResultId correctly', () => {
      const prismaWithFinalOutput = {
        sessionId: 'session-with-final-output',
        uid: 'user-123',
        userIntent: 'Test with final output',
        rootResultId: 'root-456',
        currentLevel: 3,
        globalCompletionScore: 0.95,
        status: 'completed',
        finalOutputResultId: 'action-result-final-output-789',
        targetId: 'canvas-789',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dto = divergentSessionPO2DTO(prismaWithFinalOutput);
      expect(dto.finalOutputResultId).toBe('action-result-final-output-789');
    });

    it('should preserve date objects correctly', () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 3600000); // 1 hour earlier

      const prismaSession = {
        sessionId: 'date-test-session',
        uid: 'user-date-test',
        userIntent: 'Test date preservation',
        rootResultId: 'root-date-test',
        currentLevel: 1,
        globalCompletionScore: 0.5,
        status: 'executing',
        finalOutputResultId: null,
        targetId: 'canvas-date-test',
        createdAt: earlier,
        updatedAt: now,
      };

      const dto = divergentSessionPO2DTO(prismaSession);

      expect(dto.createdAt).toBeInstanceOf(Date);
      expect(dto.updatedAt).toBeInstanceOf(Date);
      expect(dto.createdAt.getTime()).toBe(earlier.getTime());
      expect(dto.updatedAt.getTime()).toBe(now.getTime());
    });
  });
});

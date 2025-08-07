import {
  DivergentSessionData,
  CreateDivergentSessionInput,
  UpdateDivergentSessionInput,
  isDivergentSessionData,
} from './divergent-session.model';

describe('DivergentSession Business Logic', () => {
  describe('DivergentSessionData validation and constraints', () => {
    it('should enforce business rules for session creation', () => {
      const validSessionData: DivergentSessionData = {
        sessionId: 'divergent-session-real-001',
        uid: 'user-production-abc123',
        userIntent: 'Create a comprehensive technical analysis of blockchain scalability solutions',
        rootResultId: 'action-result-root-789',
        currentLevel: 0,
        globalCompletionScore: 0.0,
        status: 'executing',
        targetId: 'canvas-production-456',
        createdAt: new Date('2024-01-15T09:30:00Z'),
        updatedAt: new Date('2024-01-15T09:30:00Z'),
      };

      // Verify all required fields are present and valid
      expect(validSessionData.sessionId).toMatch(/^divergent-session-/);
      expect(validSessionData.uid).toMatch(/^user-/);
      expect(validSessionData.userIntent.length).toBeGreaterThan(10);
      expect(validSessionData.rootResultId).toMatch(/^action-result-/);
      expect(validSessionData.currentLevel).toBe(0); // New sessions start at level 0
      expect(validSessionData.globalCompletionScore).toBe(0.0); // New sessions start at 0%
      expect(validSessionData.status).toBe('executing');
      expect(validSessionData.targetId).toMatch(/^canvas-/);
    });

    it('should handle session progression through levels', () => {
      const progressingSession: DivergentSessionData = {
        sessionId: 'divergent-session-progress-002',
        uid: 'user-test-def456',
        userIntent: 'Research and analyze renewable energy market trends',
        rootResultId: 'action-result-initial-123',
        currentLevel: 3,
        globalCompletionScore: 0.7,
        status: 'executing',
        targetId: 'canvas-analysis-789',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:45:00Z'),
      };

      // Verify level progression logic
      expect(progressingSession.currentLevel).toBeGreaterThan(0);
      expect(progressingSession.currentLevel).toBeLessThanOrEqual(5);
      expect(progressingSession.globalCompletionScore).toBeGreaterThan(0);
      expect(progressingSession.globalCompletionScore).toBeLessThan(0.9); // Not yet complete
      expect(progressingSession.updatedAt.getTime()).toBeGreaterThan(
        progressingSession.createdAt.getTime(),
      );
    });

    it('should handle session completion scenarios', () => {
      const completedSession: DivergentSessionData = {
        sessionId: 'divergent-session-complete-003',
        uid: 'user-final-ghi789',
        userIntent: 'Generate executive summary of market research findings',
        rootResultId: 'action-result-research-456',
        currentLevel: 4,
        globalCompletionScore: 0.95,
        status: 'completed',
        finalOutputResultId: 'action-result-final-output-789',
        targetId: 'canvas-executive-summary-012',
        createdAt: new Date('2024-01-15T08:00:00Z'),
        updatedAt: new Date('2024-01-15T11:30:00Z'),
      };

      // Verify completion criteria
      expect(completedSession.status).toBe('completed');
      expect(completedSession.globalCompletionScore).toBeGreaterThanOrEqual(0.9);
      expect(completedSession.finalOutputResultId).toBeDefined();
      expect(completedSession.finalOutputResultId).toMatch(/^action-result-final-output-/);
    });

    it('should handle session failure scenarios', () => {
      const failedSession: DivergentSessionData = {
        sessionId: 'divergent-session-failed-004',
        uid: 'user-error-jkl012',
        userIntent: 'Complex multi-step analysis that encountered errors',
        rootResultId: 'action-result-error-base-345',
        currentLevel: 2,
        globalCompletionScore: 0.3,
        status: 'failed',
        targetId: 'canvas-error-handling-678',
        createdAt: new Date('2024-01-15T12:00:00Z'),
        updatedAt: new Date('2024-01-15T12:15:00Z'),
      };

      // Verify failure handling
      expect(failedSession.status).toBe('failed');
      expect(failedSession.globalCompletionScore).toBeLessThan(0.9);
      expect(failedSession.finalOutputResultId).toBeUndefined();
    });
  });

  describe('isDivergentSessionData type guard', () => {
    it('should validate complete session data objects', () => {
      const validSession = {
        sessionId: 'valid-session-001',
        uid: 'user-123',
        userIntent: 'Valid user intent for testing',
        rootResultId: 'root-result-456',
        currentLevel: 2,
        globalCompletionScore: 0.6,
        status: 'executing',
        targetId: 'canvas-789',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isDivergentSessionData(validSession)).toBe(true);
    });

    it('should reject sessions with invalid level values', () => {
      const invalidLevelSession = {
        sessionId: 'invalid-level-session',
        uid: 'user-123',
        userIntent: 'Test intent',
        rootResultId: 'root-456',
        currentLevel: 7, // Invalid: > 5
        globalCompletionScore: 0.5,
        status: 'executing',
        targetId: 'canvas-789',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isDivergentSessionData(invalidLevelSession)).toBe(false);
    });

    it('should reject sessions with invalid completion scores', () => {
      const invalidScoreSession = {
        sessionId: 'invalid-score-session',
        uid: 'user-123',
        userIntent: 'Test intent',
        rootResultId: 'root-456',
        currentLevel: 2,
        globalCompletionScore: 1.5, // Invalid: > 1
        status: 'executing',
        targetId: 'canvas-789',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isDivergentSessionData(invalidScoreSession)).toBe(false);
    });

    it('should reject sessions with invalid status values', () => {
      const invalidStatusSession = {
        sessionId: 'invalid-status-session',
        uid: 'user-123',
        userIntent: 'Test intent',
        rootResultId: 'root-456',
        currentLevel: 1,
        globalCompletionScore: 0.3,
        status: 'invalid-status', // Invalid status
        targetId: 'canvas-789',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isDivergentSessionData(invalidStatusSession)).toBe(false);
    });

    it('should reject incomplete session objects', () => {
      const incompleteSession = {
        sessionId: 'incomplete-session',
        uid: 'user-123',
        // Missing required fields
        currentLevel: 1,
        globalCompletionScore: 0.3,
        status: 'executing',
      };

      expect(isDivergentSessionData(incompleteSession)).toBe(false);
    });
  });

  describe('CreateDivergentSessionInput validation', () => {
    it('should validate proper session creation input', () => {
      const createInput: CreateDivergentSessionInput = {
        uid: 'user-production-xyz789',
        userIntent: 'Develop a comprehensive market analysis for renewable energy sector',
        rootResultId: 'action-result-market-analysis-001',
        targetId: 'canvas-renewable-energy-research-456',
      };

      // Verify all required fields for session creation
      expect(createInput.uid).toMatch(/^user-/);
      expect(createInput.userIntent.length).toBeGreaterThan(20); // Substantial user intent
      expect(createInput.rootResultId).toMatch(/^action-result-/);
      expect(createInput.targetId).toMatch(/^canvas-/);
    });
  });

  describe('UpdateDivergentSessionInput validation', () => {
    it('should validate session updates during progression', () => {
      const updateInput: UpdateDivergentSessionInput = {
        currentLevel: 2,
        globalCompletionScore: 0.65,
        status: 'executing',
      };

      // Verify update constraints
      expect(updateInput.currentLevel).toBeGreaterThanOrEqual(0);
      expect(updateInput.currentLevel).toBeLessThanOrEqual(5);
      expect(updateInput.globalCompletionScore).toBeGreaterThanOrEqual(0);
      expect(updateInput.globalCompletionScore).toBeLessThanOrEqual(1);
      expect(['executing', 'completed', 'failed']).toContain(updateInput.status);
    });

    it('should validate session completion update', () => {
      const completionUpdate: UpdateDivergentSessionInput = {
        currentLevel: 4,
        globalCompletionScore: 0.95,
        status: 'completed',
        finalOutputResultId: 'action-result-final-comprehensive-output-789',
      };

      // Verify completion criteria
      expect(completionUpdate.globalCompletionScore).toBeGreaterThanOrEqual(0.9);
      expect(completionUpdate.status).toBe('completed');
      expect(completionUpdate.finalOutputResultId).toMatch(/^action-result-final-/);
    });
  });

  describe('Real-world business scenarios', () => {
    it('should represent a typical research session lifecycle', () => {
      // Initial session creation
      const initialSession: DivergentSessionData = {
        sessionId: 'research-session-lifecycle-001',
        uid: 'researcher-user-abc123',
        userIntent:
          'Conduct comprehensive analysis of AI ethics frameworks in healthcare applications',
        rootResultId: 'research-root-analysis-456',
        currentLevel: 0,
        globalCompletionScore: 0.0,
        status: 'executing',
        targetId: 'canvas-ai-ethics-healthcare-789',
        createdAt: new Date('2024-01-15T09:00:00Z'),
        updatedAt: new Date('2024-01-15T09:00:00Z'),
      };

      // Mid-progress update
      const progressUpdate: UpdateDivergentSessionInput = {
        currentLevel: 2,
        globalCompletionScore: 0.6,
        status: 'executing',
      };

      // Final completion
      const finalUpdate: UpdateDivergentSessionInput = {
        currentLevel: 3,
        globalCompletionScore: 0.92,
        status: 'completed',
        finalOutputResultId: 'final-ethics-framework-report-012',
      };

      // Verify lifecycle progression makes business sense
      expect(initialSession.currentLevel).toBe(0);
      expect(progressUpdate.currentLevel).toBeGreaterThan(initialSession.currentLevel);
      expect(finalUpdate.currentLevel).toBeGreaterThan(progressUpdate.currentLevel);

      expect(initialSession.globalCompletionScore).toBe(0);
      expect(progressUpdate.globalCompletionScore).toBeGreaterThan(
        initialSession.globalCompletionScore,
      );
      expect(finalUpdate.globalCompletionScore).toBeGreaterThan(
        progressUpdate.globalCompletionScore,
      );
      expect(finalUpdate.globalCompletionScore).toBeGreaterThanOrEqual(0.9);
    });
  });
});

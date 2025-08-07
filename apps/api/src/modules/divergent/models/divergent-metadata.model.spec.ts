import {
  DivergentRole,
  createDivergentMetadata,
  isDivergentMetadata,
} from './divergent-metadata.model';

describe('DivergentMetadata Core Business Logic', () => {
  describe('createDivergentMetadata function', () => {
    it('should create valid summary metadata with all fields', () => {
      const metadata = createDivergentMetadata(
        'summary',
        2,
        'session-abc123',
        ['parent-node-1', 'parent-node-2'],
        0.75,
      );

      expect(metadata).toEqual({
        divergentRole: 'summary',
        divergentLevel: 2,
        divergentSessionId: 'session-abc123',
        parentNodeIds: ['parent-node-1', 'parent-node-2'],
        completionScore: 0.75,
      });
    });

    it('should create execution metadata without optional fields', () => {
      const metadata = createDivergentMetadata('execution', 1, 'session-def456');

      expect(metadata).toEqual({
        divergentRole: 'execution',
        divergentLevel: 1,
        divergentSessionId: 'session-def456',
        parentNodeIds: undefined,
        completionScore: undefined,
      });
    });

    it('should enforce level boundary constraints', () => {
      // Test invalid levels below 0
      expect(() => createDivergentMetadata('summary', -1, 'session-123')).toThrow(
        'Divergent level must be between 0 and 5',
      );

      // Test invalid levels above 5
      expect(() => createDivergentMetadata('summary', 6, 'session-123')).toThrow(
        'Divergent level must be between 0 and 5',
      );

      // Test boundary values that should work
      expect(() => createDivergentMetadata('summary', 0, 'session-123')).not.toThrow();
      expect(() => createDivergentMetadata('summary', 5, 'session-123')).not.toThrow();
    });

    it('should enforce completion score boundary constraints', () => {
      // Test invalid completion score below 0
      expect(() => createDivergentMetadata('summary', 1, 'session-123', [], -0.1)).toThrow(
        'Completion score must be between 0 and 1',
      );

      // Test invalid completion score above 1
      expect(() => createDivergentMetadata('summary', 1, 'session-123', [], 1.1)).toThrow(
        'Completion score must be between 0 and 1',
      );

      // Test boundary values that should work
      expect(() => createDivergentMetadata('summary', 1, 'session-123', [], 0)).not.toThrow();
      expect(() => createDivergentMetadata('summary', 1, 'session-123', [], 1)).not.toThrow();
      expect(() => createDivergentMetadata('summary', 1, 'session-123', [], 0.5)).not.toThrow();
    });
  });

  describe('isDivergentMetadata type guard', () => {
    it('should validate correct divergent metadata objects', () => {
      const validMetadata = {
        divergentRole: 'summary',
        divergentLevel: 2,
        divergentSessionId: 'session-real-id',
        parentNodeIds: ['node-1'],
        completionScore: 0.8,
      };

      expect(isDivergentMetadata(validMetadata)).toBe(true);
    });

    it('should reject metadata with invalid role', () => {
      const invalidRole = {
        divergentRole: 'invalid-role',
        divergentLevel: 1,
        divergentSessionId: 'session-123',
      };

      expect(isDivergentMetadata(invalidRole)).toBe(false);
    });

    it('should reject metadata with invalid level', () => {
      const invalidLevel = {
        divergentRole: 'summary',
        divergentLevel: 10,
        divergentSessionId: 'session-123',
      };

      expect(isDivergentMetadata(invalidLevel)).toBe(false);
    });

    it('should reject metadata with empty session ID', () => {
      const emptySessionId = {
        divergentRole: 'summary',
        divergentLevel: 1,
        divergentSessionId: '',
      };

      expect(isDivergentMetadata(emptySessionId)).toBe(false);
    });

    it('should reject null, undefined, and non-object inputs', () => {
      expect(isDivergentMetadata(null)).toBe(false);
      expect(isDivergentMetadata(undefined)).toBe(false);
      expect(isDivergentMetadata('string')).toBe(false);
      expect(isDivergentMetadata(123)).toBe(false);
      expect(isDivergentMetadata([])).toBe(false);
    });

    it('should validate all three role types correctly', () => {
      const roles: DivergentRole[] = ['summary', 'execution', 'final_output'];

      for (const role of roles) {
        const metadata = {
          divergentRole: role,
          divergentLevel: 1,
          divergentSessionId: 'session-123',
        };

        expect(isDivergentMetadata(metadata)).toBe(true);
      }
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should handle root summary node creation', () => {
      const rootSummary = createDivergentMetadata('summary', 0, 'divergent-session-root-001');

      expect(rootSummary.divergentRole).toBe('summary');
      expect(rootSummary.divergentLevel).toBe(0);
      expect(rootSummary.parentNodeIds).toBeUndefined();
      expect(rootSummary.completionScore).toBeUndefined();
    });

    it('should handle execution node with parent dependencies', () => {
      const executionNode = createDivergentMetadata('execution', 1, 'divergent-session-exec-002', [
        'summary-node-abc',
        'summary-node-def',
      ]);

      expect(executionNode.divergentRole).toBe('execution');
      expect(executionNode.divergentLevel).toBe(1);
      expect(executionNode.parentNodeIds).toHaveLength(2);
      expect(executionNode.parentNodeIds).toContain('summary-node-abc');
      expect(executionNode.parentNodeIds).toContain('summary-node-def');
    });

    it('should handle final output node with completion score', () => {
      const finalOutput = createDivergentMetadata(
        'final_output',
        3,
        'divergent-session-final-003',
        ['aggregation-node-xyz'],
        0.95,
      );

      expect(finalOutput.divergentRole).toBe('final_output');
      expect(finalOutput.divergentLevel).toBe(3);
      expect(finalOutput.completionScore).toBe(0.95);
      expect(finalOutput.parentNodeIds).toEqual(['aggregation-node-xyz']);
    });
  });
});

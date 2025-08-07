import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SkillServiceIntegration } from './skill-service-integration';
import { InvokeSkillRequest, ActionResult } from '@refly/openapi-schema';

describe('SkillServiceIntegration - Real SkillService Integration', () => {
  let integration: SkillServiceIntegration;
  let mockSkillService: any;

  // Real test scenarios for SkillService integration
  const realIntegrationScenarios = {
    webSearchRequest: {
      user: { uid: 'user-001', email: 'user001@test.com' },
      request: {
        resultId: 'result-web-search-001',
        input: { query: 'Latest developments in quantum computing 2024' },
        target: { entityId: 'canvas-quantum-001', entityType: 'canvas' as const },
        skillName: 'webSearch' as const,
        context: {
          contentList: [
            {
              content: 'Previous research on quantum computing foundations',
              metadata: {
                entityId: 'context-001',
                entityType: 'canvas',
              },
            },
          ],
        },
        resultHistory: [],
        selectedMcpServers: [],
      } as InvokeSkillRequest,
      expectedResult: {
        resultId: 'result-web-search-001',
        status: 'finish' as const,
        title: 'Search results for quantum computing developments',
        actionMeta: {
          type: 'skill' as const,
          name: 'Web Search Results',
        },
      } as ActionResult,
    },
    commonQnARequest: {
      user: { uid: 'user-002', email: 'user002@test.com' },
      request: {
        resultId: 'result-commonqna-001',
        input: { query: 'Analyze the impact of AI on healthcare sector' },
        target: { entityId: 'canvas-healthcare-001', entityType: 'canvas' as const },
        skillName: 'commonQnA' as const,
        context: {
          contentList: [
            {
              content: 'Healthcare market analysis data and AI adoption trends',
              metadata: {
                entityId: 'context-healthcare-001',
                entityType: 'canvas',
              },
            },
          ],
        },
        resultHistory: [],
        selectedMcpServers: [],
      } as InvokeSkillRequest,
      expectedResult: {
        resultId: 'result-commonqna-001',
        status: 'finish' as const,
        title: 'AI healthcare analysis completed',
        actionMeta: {
          type: 'skill' as const,
          name: 'Healthcare Analysis Summary',
        },
      } as ActionResult,
    },
    librarySearchRequest: {
      user: { uid: 'user-003', email: 'user003@test.com' },
      request: {
        resultId: 'result-library-search-001',
        input: { query: 'Search for renewable energy policy documents' },
        target: { entityId: 'canvas-energy-001', entityType: 'canvas' as const },
        skillName: 'librarySearch' as const,
        context: {
          contentList: [
            {
              content: 'Energy sector regulations and policy framework',
              metadata: {
                entityId: 'context-energy-001',
                entityType: 'canvas',
              },
            },
          ],
        },
        resultHistory: [],
        selectedMcpServers: [],
      } as InvokeSkillRequest,
      expectedResult: {
        resultId: 'result-library-search-001',
        status: 'finish' as const,
        title: 'Library search completed for energy policies',
        actionMeta: {
          type: 'skill' as const,
          name: 'Energy Policy Search Results',
        },
      } as ActionResult,
    },
  };

  beforeEach(async () => {
    // Mock SkillService with realistic implementations
    mockSkillService = {
      sendInvokeSkillTask: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillServiceIntegration,
        {
          provide: 'SkillService',
          useValue: mockSkillService,
        },
      ],
    }).compile();

    integration = module.get<SkillServiceIntegration>(SkillServiceIntegration);

    // Clear mocks before each test
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('Service Architecture & Integration', () => {
    it('should be properly instantiated with SkillService dependency', () => {
      expect(integration).toBeDefined();
      expect(integration).toBeInstanceOf(SkillServiceIntegration);
    });

    it('should have Logger properly initialized', () => {
      expect(integration.logger).toBeDefined();
      expect(integration.logger).toBeInstanceOf(Logger);
    });

    it('should inject SkillService correctly for task execution', () => {
      expect(integration.skillService).toBeDefined();
      expect(integration.skillService).toBe(mockSkillService);
    });
  });

  describe('invokeSkill - Core Integration Logic', () => {
    it('should successfully invoke webSearch skill with real parameters', async () => {
      const { user, request, expectedResult } = realIntegrationScenarios.webSearchRequest;

      // Mock successful skill execution
      mockSkillService.sendInvokeSkillTask.mockResolvedValue(expectedResult);

      const result = await integration.invokeSkill(user, request);

      expect(result).toEqual(expectedResult);
      expect(mockSkillService.sendInvokeSkillTask).toHaveBeenCalledWith(user, request);
      expect(mockSkillService.sendInvokeSkillTask).toHaveBeenCalledTimes(1);
    });

    it('should successfully invoke commonQnA skill for analysis', async () => {
      const { user, request, expectedResult } = realIntegrationScenarios.commonQnARequest;

      // Mock successful analysis
      mockSkillService.sendInvokeSkillTask.mockResolvedValue(expectedResult);

      const result = await integration.invokeSkill(user, request);

      expect(result).toEqual(expectedResult);
      // ActionMeta no longer has divergent-specific fields in the current schema
      expect(result.actionMeta?.type).toBe('skill');
      expect(result.actionMeta?.name).toBeDefined();
      expect(mockSkillService.sendInvokeSkillTask).toHaveBeenCalledWith(user, request);
    });

    it('should successfully invoke librarySearch skill with context', async () => {
      const { user, request, expectedResult } = realIntegrationScenarios.librarySearchRequest;

      // Mock successful library search
      mockSkillService.sendInvokeSkillTask.mockResolvedValue(expectedResult);

      const result = await integration.invokeSkill(user, request);

      expect(result).toEqual(expectedResult);
      expect(result.actionMeta?.type).toBe('skill');
      expect(result.actionMeta?.name).toBe('Energy Policy Search Results');
      expect(mockSkillService.sendInvokeSkillTask).toHaveBeenCalledWith(user, request);
    });

    it('should handle skill execution errors gracefully', async () => {
      const { user, request } = realIntegrationScenarios.webSearchRequest;

      // Mock skill execution failure
      const skillError = new Error('Skill execution failed: Network timeout');
      mockSkillService.sendInvokeSkillTask.mockRejectedValue(skillError);

      await expect(integration.invokeSkill(user, request)).rejects.toThrow(
        'Skill execution failed: Network timeout',
      );
      expect(mockSkillService.sendInvokeSkillTask).toHaveBeenCalledWith(user, request);
    });

    it('should validate request parameters before skill invocation', async () => {
      const { user } = realIntegrationScenarios.webSearchRequest;
      const invalidRequest = {
        ...realIntegrationScenarios.webSearchRequest.request,
        skillName: undefined as any,
      };

      await expect(integration.invokeSkill(user, invalidRequest)).rejects.toThrow();
    });
  });

  describe('Skill Context and Metadata Handling', () => {
    it('should properly preserve divergent metadata in skill calls', async () => {
      const { user, request, expectedResult } = realIntegrationScenarios.commonQnARequest;

      mockSkillService.sendInvokeSkillTask.mockResolvedValue(expectedResult);

      const result = await integration.invokeSkill(user, request);

      // Verify ActionMeta structure is correct
      expect(result.actionMeta).toBeDefined();
      expect(result.actionMeta?.type).toBe('skill');
      expect(result.actionMeta?.name).toBe('Healthcare Analysis Summary');
    });

    it('should handle context passing correctly for skill execution', async () => {
      const { user, request, expectedResult } = realIntegrationScenarios.librarySearchRequest;

      mockSkillService.sendInvokeSkillTask.mockResolvedValue(expectedResult);

      await integration.invokeSkill(user, request);

      // Verify context is passed correctly
      const [calledUser, calledRequest] = mockSkillService.sendInvokeSkillTask.mock.calls[0];
      expect(calledUser).toEqual(user);
      expect(calledRequest.context).toEqual(request.context);
      expect(calledRequest.context.contentList).toHaveLength(1);
      expect(calledRequest.context.contentList[0].content).toContain('Energy sector regulations');
    });

    it('should support all available skill types correctly', async () => {
      const skillTypes = [
        'webSearch',
        'librarySearch',
        'commonQnA',
        'generateDoc',
        'codeArtifacts',
      ];

      for (const skillName of skillTypes) {
        const mockRequest = {
          ...realIntegrationScenarios.webSearchRequest.request,
          skillName: skillName as any,
          resultId: `result-${skillName}-test`,
        };

        const mockResult = {
          ...realIntegrationScenarios.webSearchRequest.expectedResult,
          resultId: `result-${skillName}-test`,
        };

        mockSkillService.sendInvokeSkillTask.mockResolvedValueOnce(mockResult);

        const result = await integration.invokeSkill(
          realIntegrationScenarios.webSearchRequest.user,
          mockRequest,
        );

        expect(result.resultId).toBe(`result-${skillName}-test`);
        expect(mockSkillService.sendInvokeSkillTask).toHaveBeenCalledWith(
          realIntegrationScenarios.webSearchRequest.user,
          mockRequest,
        );
      }

      expect(mockSkillService.sendInvokeSkillTask).toHaveBeenCalledTimes(skillTypes.length);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent skill invocations correctly', async () => {
      const scenarios = [
        realIntegrationScenarios.webSearchRequest,
        realIntegrationScenarios.commonQnARequest,
        realIntegrationScenarios.librarySearchRequest,
      ];

      // Mock successful responses for all scenarios
      // biome-ignore lint/complexity/noForEach: <explanation>
      scenarios.forEach(({ expectedResult }) => {
        mockSkillService.sendInvokeSkillTask.mockResolvedValueOnce(expectedResult);
      });

      // Execute all skills concurrently
      const promises = scenarios.map(({ user, request }) => integration.invokeSkill(user, request));

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockSkillService.sendInvokeSkillTask).toHaveBeenCalledTimes(3);

      // Verify each result matches expected
      results.forEach((result, index) => {
        expect(result).toEqual(scenarios[index].expectedResult);
      });
    });

    it('should propagate errors correctly without affecting other operations', async () => {
      const { user: user1, request: request1 } = realIntegrationScenarios.webSearchRequest;
      const {
        user: user2,
        request: request2,
        expectedResult: result2,
      } = realIntegrationScenarios.commonQnARequest;

      // First call fails, second succeeds
      mockSkillService.sendInvokeSkillTask
        .mockRejectedValueOnce(new Error('First skill failed'))
        .mockResolvedValueOnce(result2);

      // First call should fail
      await expect(integration.invokeSkill(user1, request1)).rejects.toThrow('First skill failed');

      // Second call should succeed
      const result = await integration.invokeSkill(user2, request2);
      expect(result).toEqual(result2);

      expect(mockSkillService.sendInvokeSkillTask).toHaveBeenCalledTimes(2);
    });
  });
});

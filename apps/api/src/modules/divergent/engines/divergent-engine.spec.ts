import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DivergentEngine } from './divergent-engine';
import { DivergentSessionService } from '../divergent-session.service';
import { SkillOrchestrator } from './skill-orchestrator';
import { SkillServiceIntegration } from '../services/skill-service-integration';
import { User } from '@refly/openapi-schema';
import { DivergentSessionData } from '../models/divergent-session.model';

describe('DivergentEngine Core Total-Divide-Total Loop', () => {
  let engine: DivergentEngine;
  let sessionService: DivergentSessionService;
  let _skillService: any; // Use any to avoid import issues
  let module: TestingModule;

  const mockUser: User = {
    uid: 'test-user-divergent-engine-001',
    email: 'test@divergent-engine.com',
  };

  // Mock services
  const mockSessionService = {
    createDivergentSession: jest.fn(),
    updateDivergentSession: jest.fn(),
    getDivergentSession: jest.fn(),
  };

  const mockSkillServiceIntegration = {
    invokeSkill: jest.fn(),
  };

  const mockSkillOrchestrator = {
    analyzeAndGenerateSubTasks: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    module = await Test.createTestingModule({
      providers: [
        DivergentEngine,
        {
          provide: DivergentSessionService,
          useValue: mockSessionService,
        },
        {
          provide: SkillOrchestrator,
          useValue: mockSkillOrchestrator,
        },
        {
          provide: SkillServiceIntegration,
          useValue: mockSkillServiceIntegration,
        },
        {
          provide: 'SkillService',
          useValue: null, // Mock for testing
        },
      ],
    }).compile();

    engine = module.get<DivergentEngine>(DivergentEngine);
    sessionService = module.get<DivergentSessionService>(DivergentSessionService);
    _skillService = module.get<any>('SkillService');
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Engine Architecture & Initialization', () => {
    it('should be properly instantiated with all dependencies', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(DivergentEngine);
    });

    it('should have Logger properly initialized', () => {
      // Access private logger through engine instance methods
      expect(engine.logger).toBeInstanceOf(Logger);
    });

    it('should inject all required services correctly', () => {
      expect(engine.sessionService).toBe(sessionService);
      expect(engine.skillServiceIntegration).toBe(mockSkillServiceIntegration);
    });
  });

  describe('runDivergentLoop - Core Business Logic', () => {
    it('should execute complete total-divide-total cycle successfully', async () => {
      const userIntent = 'Develop comprehensive AI strategy for healthcare transformation';
      const targetId = 'canvas-healthcare-ai-strategy-001';

      // Mock root summary creation
      const rootSummaryResult = {
        resultId: 'action-result-root-summary-001',
        status: 'completed',
        data: {
          title: 'Healthcare AI Strategy - Initial Analysis',
          content: 'Comprehensive analysis of current healthcare AI landscape...',
          metadata: {
            divergentRole: 'summary',
            divergentLevel: 0,
            divergentSessionId: 'divergent-session-001',
          },
        },
      };

      // Mock session creation
      const mockSession: DivergentSessionData = {
        sessionId: 'divergent-session-001',
        uid: mockUser.uid,
        userIntent,
        rootResultId: rootSummaryResult.resultId,
        currentLevel: 0,
        globalCompletionScore: 0.1,
        status: 'executing',
        targetId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock execution results
      const executionResults = [
        {
          success: true,
          resultId: 'action-result-web-search-001',
          title: 'Healthcare AI Market Research',
        },
        {
          success: true,
          resultId: 'action-result-library-search-001',
          title: 'Medical Knowledge Base Analysis',
        },
      ];

      // Setup mocks
      mockSkillServiceIntegration.invokeSkill
        .mockResolvedValueOnce(rootSummaryResult) // Root summary creation
        .mockResolvedValueOnce(executionResults[0]) // First execution task
        .mockResolvedValueOnce(executionResults[1]) // Second execution task
        .mockResolvedValueOnce({
          // New summary after aggregation
          resultId: 'action-result-summary-level-1',
          status: 'completed',
          data: {
            title: 'Healthcare AI Strategy - Level 1 Analysis',
            content: 'Aggregated insights from market research and knowledge base...',
            metadata: {
              divergentRole: 'summary',
              divergentLevel: 1,
              divergentSessionId: 'divergent-session-001',
              completionScore: 0.95,
            },
          },
        })
        .mockResolvedValueOnce({
          // Final output generation
          resultId: 'action-result-final-output-001',
          status: 'completed',
          data: {
            title: 'Healthcare AI Strategy - Final Report',
            content: 'Complete healthcare AI transformation strategy...',
            metadata: {
              divergentRole: 'final_output',
              divergentLevel: 1,
              divergentSessionId: 'divergent-session-001',
            },
          },
        });

      mockSessionService.createDivergentSession.mockResolvedValue({
        session: mockSession,
        success: true,
        message: 'Session created successfully',
      });

      mockSessionService.updateDivergentSession.mockResolvedValue({
        session: {
          ...mockSession,
          currentLevel: 1,
          globalCompletionScore: 0.95,
          status: 'completed',
          finalOutputResultId: 'action-result-final-output-001',
          updatedAt: new Date(),
        },
        success: true,
        message: 'Session updated successfully',
      });

      // Mock SkillOrchestrator to simulate one full cycle
      mockSkillOrchestrator.analyzeAndGenerateSubTasks
        .mockResolvedValueOnce({
          success: true,
          subTasks: [
            {
              name: 'Research Task',
              query: 'Healthcare AI research',
              skillName: 'webSearch',
              priority: 1,
              level: 1,
              sessionId: 'divergent-session-001',
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          subTasks: [], // No more tasks on second call after high completion score
        });

      // Mock evaluateCompletion to trigger completion after first iteration
      jest.spyOn(engine as any, 'evaluateCompletion').mockResolvedValue(0.95);

      // Execute the main function
      const result = await engine.runDivergentLoop(mockUser, userIntent, targetId);

      // Verify results
      expect(result).toBeDefined();
      expect(result.sessionId).toBe('divergent-session-001');
      expect(result.status).toBe('completed');
      expect(result.globalCompletionScore).toBe(0.95);
      expect(result.finalOutputResultId).toBe('action-result-final-output-001');

      // Verify service calls
      expect(mockSessionService.createDivergentSession).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({
          userIntent,
          rootResultId: rootSummaryResult.resultId,
          targetId,
        }),
      );

      expect(mockSkillServiceIntegration.invokeSkill).toHaveBeenCalledTimes(4);
      expect(mockSessionService.updateDivergentSession).toHaveBeenCalled();
    });

    it('should enforce maximum iteration limit of 5 levels', async () => {
      const userIntent = 'Complex research requiring deep analysis';
      const targetId = 'canvas-deep-research-001';

      // Mock to never reach completion threshold
      mockSkillServiceIntegration.invokeSkill.mockImplementation(() =>
        Promise.resolve({
          resultId: `action-result-${Date.now()}`,
          status: 'completed',
          data: {
            title: 'Analysis',
            content: 'Analysis content...',
            metadata: {
              divergentRole: 'summary',
              divergentLevel: 0,
              divergentSessionId: 'test-session',
              completionScore: 0.5, // Never reaches 0.9 threshold
            },
          },
        }),
      );

      mockSessionService.createDivergentSession.mockResolvedValue({
        session: {
          sessionId: 'test-session',
          uid: mockUser.uid,
          userIntent,
          rootResultId: 'root-result',
          currentLevel: 0,
          globalCompletionScore: 0.5,
          status: 'executing',
          targetId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        success: true,
        message: 'Session created successfully',
      });

      mockSessionService.updateDivergentSession.mockResolvedValue({
        session: {
          sessionId: 'test-session',
          uid: mockUser.uid,
          userIntent,
          rootResultId: 'root-result',
          currentLevel: 5,
          globalCompletionScore: 0.5,
          status: 'max_depth_reached',
          targetId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        success: true,
        message: 'Session updated successfully',
      });

      // Mock SkillOrchestrator to always return tasks
      mockSkillOrchestrator.analyzeAndGenerateSubTasks.mockResolvedValue({
        success: true,
        subTasks: [
          {
            name: 'Research Task',
            query: 'Perform research',
            skillName: 'webSearch',
            priority: 1,
            level: 1,
            sessionId: 'test-session',
          },
        ],
      });

      jest.spyOn(engine as any, 'executeSubTasksInParallel').mockResolvedValue([
        {
          success: true,
          resultId: 'execution-result',
          title: 'Research Result',
        },
      ]);

      jest.spyOn(engine as any, 'evaluateCompletion').mockResolvedValue(0.5);

      const result = await engine.runDivergentLoop(mockUser, userIntent, targetId);

      // Should stop at level 5
      expect(result.currentLevel).toBeLessThanOrEqual(5);
      expect(result.status).toBe('max_depth_reached');
    });

    it('should handle completion threshold and generate final output', async () => {
      const userIntent = 'Generate simple document';
      const targetId = 'canvas-simple-doc-001';

      // Mock high completion score to trigger final output
      mockSkillServiceIntegration.invokeSkill
        .mockResolvedValueOnce({
          // Root summary
          resultId: 'root-summary-high-completion',
          status: 'completed',
        })
        .mockResolvedValueOnce({
          // Execution task result
          resultId: 'quick-analysis-result',
          status: 'completed',
        })
        .mockResolvedValueOnce({
          // New summary after aggregation
          resultId: 'summary-level-1',
          status: 'completed',
        })
        .mockResolvedValueOnce({
          // Final output
          resultId: 'final-output-result',
          status: 'completed',
        });

      mockSessionService.createDivergentSession.mockResolvedValue({
        session: {
          sessionId: 'high-completion-session',
          uid: mockUser.uid,
          userIntent,
          rootResultId: 'root-summary-high-completion',
          currentLevel: 0,
          globalCompletionScore: 0.95,
          status: 'executing',
          targetId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        success: true,
        message: 'Session created successfully',
      });

      mockSessionService.updateDivergentSession.mockResolvedValue({
        session: {
          sessionId: 'high-completion-session',
          uid: mockUser.uid,
          userIntent,
          rootResultId: 'root-summary-high-completion',
          currentLevel: 0,
          globalCompletionScore: 0.95,
          status: 'completed',
          targetId,
          finalOutputResultId: 'final-output-result',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        success: true,
        message: 'Session updated successfully',
      });

      // Mock initial subtasks to trigger loop
      mockSkillOrchestrator.analyzeAndGenerateSubTasks.mockResolvedValueOnce({
        success: true,
        subTasks: [
          {
            name: 'Simple Task',
            query: 'Quick analysis',
            skillName: 'commonQnA',
            priority: 1,
            level: 1,
            sessionId: 'high-completion-session',
          },
        ],
      });

      // Mock high completion score evaluation after first iteration
      jest.spyOn(engine as any, 'evaluateCompletion').mockResolvedValue(0.95);

      // Mock execution result
      jest.spyOn(engine as any, 'executeSubTasksInParallel').mockResolvedValue([
        {
          success: true,
          resultId: 'quick-analysis-result',
          title: 'Simple Task',
        },
      ]);

      const result = await engine.runDivergentLoop(mockUser, userIntent, targetId);

      expect(result.status).toBe('completed');
      expect(result.finalOutputResultId).toBe('final-output-result');
      expect(result.globalCompletionScore).toBe(0.95);
    });
  });

  describe('createSummaryNode - Summary Node Creation', () => {
    it('should create summary node using commonQnA skill', async () => {
      const query = 'Analyze healthcare AI transformation requirements';
      const contextResultIds = ['result-001', 'result-002'];
      const level = 1;
      const sessionId = 'test-session-summary';

      const expectedResult = {
        resultId: 'action-result-summary-001',
        status: 'completed',
      };

      mockSkillServiceIntegration.invokeSkill.mockResolvedValue(expectedResult);

      const result = await engine.createSummaryNode(
        mockUser,
        'canvas-target-001',
        query,
        contextResultIds,
        level,
        sessionId,
      );

      expect(result).toEqual(expectedResult);

      // Verify skill service was called with correct parameters
      expect(mockSkillServiceIntegration.invokeSkill).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({
          input: { query },
          target: { entityId: 'canvas-target-001', entityType: 'canvas' },
          skillName: 'commonQnA',
          context: expect.objectContaining({
            contentList: expect.arrayContaining([
              expect.objectContaining({
                content: 'Context from results: result-001, result-002',
              }),
            ]),
          }),
          resultHistory: [],
          selectedMcpServers: [],
        }),
      );
    });

    it('should handle empty context gracefully', async () => {
      const query = 'Initial analysis without context';
      const contextResultIds: string[] = [];
      const level = 0;
      const sessionId = 'test-session-empty-context';

      mockSkillServiceIntegration.invokeSkill.mockResolvedValue({
        resultId: 'action-result-initial-summary',
        status: 'completed',
      });

      const result = await engine.createSummaryNode(
        mockUser,
        'canvas-target-initial',
        query,
        contextResultIds,
        level,
        sessionId,
      );

      expect(result).toBeDefined();
    });
  });

  describe('executeSubTasksInParallel - Parallel Execution', () => {
    it('should execute multiple subtasks in parallel successfully', async () => {
      const subTasks = [
        {
          name: 'Web Research',
          query: 'Search for latest healthcare AI trends',
          skillName: 'webSearch',
          priority: 1,
          level: 1,
          sessionId: 'parallel-test-session',
        },
        {
          name: 'Knowledge Base Search',
          query: 'Find medical AI documentation',
          skillName: 'librarySearch',
          priority: 2,
          level: 1,
          sessionId: 'parallel-test-session',
        },
        {
          name: 'Analysis Task',
          query: 'Analyze AI implementation challenges',
          skillName: 'commonQnA',
          priority: 3,
          level: 1,
          sessionId: 'parallel-test-session',
        },
      ];

      const parentResultIds = ['parent-result-001'];

      // Mock successful execution for all tasks
      mockSkillServiceIntegration.invokeSkill
        .mockResolvedValueOnce({
          resultId: 'web-search-result-001',
          status: 'completed',
        })
        .mockResolvedValueOnce({
          resultId: 'library-search-result-001',
          status: 'completed',
        })
        .mockResolvedValueOnce({
          resultId: 'analysis-result-001',
          status: 'completed',
        });

      const results = await engine.executeSubTasksInParallel(
        mockUser,
        'canvas-parallel-test',
        subTasks,
        parentResultIds,
      );

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(results[0].resultId).toBe('web-search-result-001');
      expect(results[1].resultId).toBe('library-search-result-001');
      expect(results[2].resultId).toBe('analysis-result-001');

      // Verify all tasks were called with correct metadata
      expect(mockSkillServiceIntegration.invokeSkill).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure scenarios', async () => {
      const subTasks = [
        {
          name: 'Successful Task',
          query: 'This will succeed',
          skillName: 'webSearch',
          priority: 1,
          level: 1,
          sessionId: 'mixed-results-session',
        },
        {
          name: 'Failing Task',
          query: 'This will fail',
          skillName: 'librarySearch',
          priority: 2,
          level: 1,
          sessionId: 'mixed-results-session',
        },
      ];

      mockSkillServiceIntegration.invokeSkill
        .mockResolvedValueOnce({
          resultId: 'successful-result',
          status: 'completed',
        })
        .mockRejectedValueOnce(new Error('Network timeout'));

      const results = await engine.executeSubTasksInParallel(
        mockUser,
        'canvas-mixed-test',
        subTasks,
        [],
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Network timeout');
    });

    it('should enforce maximum 8 subtasks limit', async () => {
      // Create 10 subtasks to test the limit
      const subTasks = Array.from({ length: 10 }, (_, i) => ({
        name: `Task ${i + 1}`,
        query: `Query ${i + 1}`,
        skillName: 'commonQnA',
        priority: i + 1,
        level: 1,
        sessionId: 'limit-test-session',
      }));

      mockSkillServiceIntegration.invokeSkill.mockResolvedValue({
        resultId: 'test-result',
        status: 'completed',
      });

      const results = await engine.executeSubTasksInParallel(
        mockUser,
        'canvas-limit-test',
        subTasks,
        [],
      );

      // Should only execute first 8 tasks
      expect(results).toHaveLength(8);
      expect(mockSkillServiceIntegration.invokeSkill).toHaveBeenCalledTimes(8);
    });
  });
});

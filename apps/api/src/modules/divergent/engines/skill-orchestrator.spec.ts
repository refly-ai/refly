import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SkillOrchestrator } from './skill-orchestrator';

describe('SkillOrchestrator - Intelligent Task Decomposition', () => {
  let orchestrator: SkillOrchestrator;
  let mockModel: any;

  // Real test data for task decomposition scenarios
  const realTaskAnalysisInputs = {
    researchScenario: {
      currentSummaryContent:
        'Current research shows basic understanding of AI automation tools. Need deeper analysis of market trends and practical implementations.',
      userIntent: 'Create a comprehensive analysis of AI automation tools for business processes',
      completionScore: 0.3,
      currentLevel: 1,
      sessionId: 'research-session-001',
    },
    documentCreationScenario: {
      currentSummaryContent:
        'Gathered sufficient research data about sustainable energy solutions. Information includes solar, wind, and battery technologies with market analysis.',
      userIntent: 'Generate a professional report on renewable energy investment opportunities',
      completionScore: 0.85,
      currentLevel: 2,
      sessionId: 'doc-creation-session-002',
    },
    developmentScenario: {
      currentSummaryContent:
        'User wants a React dashboard with authentication and data visualization features.',
      userIntent: 'Build a modern React dashboard application',
      completionScore: 0.2,
      currentLevel: 0,
      sessionId: 'dev-session-003',
    },
  };

  beforeEach(async () => {
    // Mock AI model
    mockModel = {
      invoke: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillOrchestrator,
        {
          provide: 'BaseChatModel',
          useValue: mockModel,
        },
      ],
    }).compile();

    orchestrator = module.get<SkillOrchestrator>(SkillOrchestrator);
  });

  describe('Service Architecture & Initialization', () => {
    it('should be properly instantiated with AI model dependency', () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator).toBeInstanceOf(SkillOrchestrator);
    });

    it('should have Logger properly initialized', () => {
      expect(orchestrator.logger).toBeDefined();
      expect(orchestrator.logger).toBeInstanceOf(Logger);
    });

    it('should inject AI model correctly for task analysis', () => {
      expect(orchestrator.model).toBeDefined();
      expect(orchestrator.model).toBe(mockModel);
    });
  });

  describe('analyzeAndGenerateSubTasks - Core Business Logic', () => {
    it('should generate research subtasks for low completion scenario', async () => {
      const { currentSummaryContent, userIntent, completionScore, currentLevel, sessionId } =
        realTaskAnalysisInputs.researchScenario;

      // Mock AI response for research scenario
      mockModel.invoke.mockResolvedValue(`
        [
          {
            "name": "Market Analysis Research",
            "query": "Search for latest market trends and adoption rates of AI automation tools in business",
            "skillName": "webSearch",
            "priority": 1
          },
          {
            "name": "Case Studies Collection",
            "query": "Find comprehensive case studies of AI automation implementations",
            "skillName": "librarySearch",
            "priority": 2
          },
          {
            "name": "Technology Comparison",
            "query": "Analyze and compare different AI automation platforms and their capabilities",
            "skillName": "commonQnA",
            "priority": 3
          }
        ]
      `);

      const result = await orchestrator.analyzeAndGenerateSubTasks(
        currentSummaryContent,
        userIntent,
        completionScore,
        currentLevel,
        sessionId,
      );

      expect(result.success).toBe(true);
      expect(result.subTasks).toHaveLength(3);
      expect(result.subTasks[0]).toEqual({
        name: 'Market Analysis Research',
        query:
          'Search for latest market trends and adoption rates of AI automation tools in business',
        skillName: 'webSearch',
        priority: 1,
        level: currentLevel + 1,
        sessionId,
      });
      expect(mockModel.invoke).toHaveBeenCalledWith(expect.stringContaining(userIntent));
    });

    it('should suggest document generation for high completion scenario', async () => {
      const { currentSummaryContent, userIntent, completionScore, currentLevel, sessionId } =
        realTaskAnalysisInputs.documentCreationScenario;

      // Mock AI response for document creation scenario
      mockModel.invoke.mockResolvedValue(`
        [
          {
            "name": "Professional Report Generation",
            "query": "Generate a comprehensive professional report on renewable energy investment opportunities with executive summary, market analysis, and recommendations",
            "skillName": "generateDoc",
            "priority": 1
          },
          {
            "name": "Investment Analysis Charts",
            "query": "Create data visualizations showing renewable energy investment trends and ROI projections",
            "skillName": "generateMedia",
            "priority": 2
          }
        ]
      `);

      const result = await orchestrator.analyzeAndGenerateSubTasks(
        currentSummaryContent,
        userIntent,
        completionScore,
        currentLevel,
        sessionId,
      );

      expect(result.success).toBe(true);
      expect(result.subTasks).toHaveLength(2);
      expect(result.subTasks[0].skillName).toBe('generateDoc');
      expect(result.subTasks[0].name).toBe('Professional Report Generation');
      expect(result.subTasks[1].skillName).toBe('generateMedia');
    });

    it('should return empty tasks when information is sufficient', async () => {
      const input = {
        currentSummaryContent: 'Complete analysis finished with all requirements satisfied.',
        userIntent: 'Simple data lookup task',
        completionScore: 0.95,
        currentLevel: 3,
        sessionId: 'complete-session-004',
      };

      // Mock AI response indicating completion
      mockModel.invoke.mockResolvedValue('[]');

      const result = await orchestrator.analyzeAndGenerateSubTasks(
        input.currentSummaryContent,
        input.userIntent,
        input.completionScore,
        input.currentLevel,
        input.sessionId,
      );

      expect(result.success).toBe(true);
      expect(result.subTasks).toHaveLength(0);
      expect(result.reason).toContain('sufficient');
    });

    it('should enforce maximum 8 subtasks limit', async () => {
      const { currentSummaryContent, userIntent, completionScore, currentLevel, sessionId } =
        realTaskAnalysisInputs.developmentScenario;

      // Mock AI response with more than 8 tasks
      const largeTasks = Array.from({ length: 12 }, (_, i) => ({
        name: `Task ${i + 1}`,
        query: `Query for task ${i + 1}`,
        skillName: 'commonQnA',
        priority: Math.floor(i / 3) + 1,
      }));

      mockModel.invoke.mockResolvedValue(JSON.stringify(largeTasks));

      const result = await orchestrator.analyzeAndGenerateSubTasks(
        currentSummaryContent,
        userIntent,
        completionScore,
        currentLevel,
        sessionId,
      );

      expect(result.success).toBe(true);
      expect(result.subTasks).toHaveLength(8); // Limited to maximum 8
      expect(result.subTasks.every((task) => task.level === currentLevel + 1)).toBe(true);
      expect(result.subTasks.every((task) => task.sessionId === sessionId)).toBe(true);
    });

    it('should handle various skill types correctly', async () => {
      mockModel.invoke.mockResolvedValue(`
        [
          {
            "name": "Web Search Task",
            "query": "Search for latest information",
            "skillName": "webSearch",
            "priority": 1
          },
          {
            "name": "Library Research",
            "query": "Find knowledge base content",
            "skillName": "librarySearch",
            "priority": 2
          },
          {
            "name": "Code Generation",
            "query": "Generate React component code",
            "skillName": "codeArtifacts",
            "priority": 3
          },
          {
            "name": "Analysis Task",
            "query": "Analyze current situation",
            "skillName": "commonQnA",
            "priority": 1
          }
        ]
      `);

      const result = await orchestrator.analyzeAndGenerateSubTasks(
        'Mixed task scenario',
        'Complex multi-step project',
        0.4,
        1,
        'mixed-session-005',
      );

      expect(result.success).toBe(true);
      expect(result.subTasks).toHaveLength(4);

      const skillNames = result.subTasks.map((task) => task.skillName);
      expect(skillNames).toContain('webSearch');
      expect(skillNames).toContain('librarySearch');
      expect(skillNames).toContain('codeArtifacts');
      expect(skillNames).toContain('commonQnA');
    });
  });

  describe('parseSubTasks - JSON Parsing & Validation', () => {
    it('should parse valid JSON response correctly', async () => {
      const validJson = `
        [
          {
            "name": "Test Task",
            "query": "Test query content",
            "skillName": "webSearch",
            "priority": 1
          }
        ]
      `;

      const result = await orchestrator.parseSubTasks(validJson, 2, 'test-session');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'Test Task',
        query: 'Test query content',
        skillName: 'webSearch',
        priority: 1,
        level: 2,
        sessionId: 'test-session',
      });
    });

    it('should handle malformed JSON gracefully', async () => {
      const malformedJson = '{ invalid json }';

      const result = await orchestrator.parseSubTasks(malformedJson, 1, 'test-session');

      expect(result).toHaveLength(0);
    });

    it('should validate required fields in parsed tasks', async () => {
      const incompleteJson = `
        [
          {
            "name": "Complete Task",
            "query": "Complete query",
            "skillName": "webSearch",
            "priority": 1
          },
          {
            "name": "Incomplete Task"
          }
        ]
      `;

      const result = await orchestrator.parseSubTasks(incompleteJson, 1, 'test-session');

      expect(result).toHaveLength(1); // Only complete task should be included
      expect(result[0].name).toBe('Complete Task');
    });
  });

  describe('Prompt Engineering & Context Building', () => {
    it('should build comprehensive prompts with all context', async () => {
      const { currentSummaryContent, userIntent, completionScore } =
        realTaskAnalysisInputs.researchScenario;

      mockModel.invoke.mockResolvedValue('[]');

      await orchestrator.analyzeAndGenerateSubTasks(
        currentSummaryContent,
        userIntent,
        completionScore,
        1,
        'test-session',
      );

      const calledPrompt = mockModel.invoke.mock.calls[0][0];
      expect(calledPrompt).toContain(userIntent);
      expect(calledPrompt).toContain(currentSummaryContent);
      expect(calledPrompt).toContain(completionScore.toString());
      expect(calledPrompt).toContain('webSearch');
      expect(calledPrompt).toContain('librarySearch');
      expect(calledPrompt).toContain('commonQnA');
      expect(calledPrompt).toContain('generateDoc');
      expect(calledPrompt).toContain('codeArtifacts');
      expect(calledPrompt).toContain('generateMedia');
    });

    it('should include clear instructions for different completion scores', async () => {
      mockModel.invoke.mockResolvedValue('[]');

      // Test low completion score
      await orchestrator.analyzeAndGenerateSubTasks(
        'Initial content',
        'Test intent',
        0.2,
        0,
        'test-session',
      );

      let calledPrompt = mockModel.invoke.mock.calls[0][0];
      expect(calledPrompt).toContain('当前完成度：0.2');

      // Test high completion score
      await orchestrator.analyzeAndGenerateSubTasks(
        'Nearly complete content',
        'Test intent',
        0.9,
        2,
        'test-session',
      );

      calledPrompt = mockModel.invoke.mock.calls[1][0];
      expect(calledPrompt).toContain('当前完成度：0.9');
    });
  });

  describe('Error Handling & Resilience', () => {
    it('should handle AI model errors gracefully', async () => {
      mockModel.invoke.mockRejectedValue(new Error('AI model unavailable'));

      const result = await orchestrator.analyzeAndGenerateSubTasks(
        'Test content',
        'Test intent',
        0.5,
        1,
        'error-session',
      );

      expect(result.success).toBe(false);
      expect(result.subTasks).toHaveLength(0);
      expect(result.error).toContain('AI model unavailable');
    });

    it('should validate skill names and reject invalid ones', async () => {
      const invalidSkillJson = `
        [
          {
            "name": "Valid Task",
            "query": "Valid query",
            "skillName": "webSearch",
            "priority": 1
          },
          {
            "name": "Invalid Task",
            "query": "Invalid query",
            "skillName": "invalidSkill",
            "priority": 2
          }
        ]
      `;

      mockModel.invoke.mockResolvedValue(invalidSkillJson);

      const result = await orchestrator.analyzeAndGenerateSubTasks(
        'Test content',
        'Test intent',
        0.5,
        1,
        'validation-session',
      );

      expect(result.success).toBe(true);
      expect(result.subTasks).toHaveLength(1); // Only valid task included
      expect(result.subTasks[0].skillName).toBe('webSearch');
    });
  });
});

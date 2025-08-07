import { Injectable, Logger, Inject } from '@nestjs/common';
import { SubTask } from './divergent-engine';

/**
 * Task analysis input for intelligent task decomposition
 */
export interface TaskAnalysisInput {
  currentSummaryContent: string;
  userIntent: string;
  completionScore: number;
  currentLevel: number;
  sessionId: string;
}

/**
 * Task analysis result with success status and generated subtasks
 */
export interface TaskAnalysisResult {
  success: boolean;
  subTasks: SubTask[];
  reason?: string;
  error?: string;
}

/**
 * Available skill names for task execution
 */
export const AVAILABLE_SKILLS = [
  'webSearch',
  'librarySearch',
  'commonQnA',
  'generateDoc',
  'codeArtifacts',
  'generateMedia',
] as const;

export type AvailableSkill = (typeof AVAILABLE_SKILLS)[number];

/**
 * SkillOrchestrator - Intelligent Task Decomposition Engine
 *
 * Implements AI-driven task analysis and decomposition for the divergent thinking cycle.
 * Uses advanced prompt engineering to generate contextually appropriate subtasks
 * with intelligent skill selection and priority assignment.
 *
 * Key Features:
 * - AI-powered task analysis based on completion score and context
 * - Intelligent skill selection from available skill set
 * - Maximum 8 subtasks limit for optimal parallel execution
 * - Robust JSON parsing and validation
 * - Comprehensive error handling and fallback mechanisms
 */
@Injectable()
export class SkillOrchestrator {
  private readonly logger = new Logger(SkillOrchestrator.name);

  constructor(@Inject('BaseChatModel') private readonly model: any) {
    this.logger.log('SkillOrchestrator initialized with AI model');
  }

  /**
   * Analyze current context and generate intelligent subtasks
   *
   * Core business logic for task decomposition:
   * 1. Builds comprehensive context prompt with user intent and completion status
   * 2. Invokes AI model for intelligent task analysis
   * 3. Parses and validates AI response into structured subtasks
   * 4. Applies business rules (max 8 tasks, skill validation, priority assignment)
   * 5. Returns enriched subtasks with session context
   *
   * @param currentSummaryContent - Current analysis summary from previous steps
   * @param userIntent - Original user request and goals
   * @param completionScore - Current completion percentage (0-1)
   * @param currentLevel - Current depth in divergent loop (0-5)
   * @param sessionId - Session identifier for task tracking
   * @returns TaskAnalysisResult with success status and generated subtasks
   */
  async analyzeAndGenerateSubTasks(
    currentSummaryContent: string,
    userIntent: string,
    completionScore: number,
    currentLevel: number,
    sessionId: string,
  ): Promise<TaskAnalysisResult> {
    try {
      this.logger.log(
        `Analyzing tasks for session ${sessionId}, level ${currentLevel}, completion ${completionScore}`,
      );

      // Build comprehensive analysis prompt
      const prompt = this.buildTaskAnalysisPrompt(
        currentSummaryContent,
        userIntent,
        completionScore,
      );

      // Invoke AI model for intelligent task decomposition
      const aiResponse = await this.model.invoke(prompt);

      // Parse and validate AI response
      const subTasks = await this.parseSubTasks(aiResponse, currentLevel + 1, sessionId);

      // Check if no tasks were generated (completion scenario)
      if (subTasks.length === 0) {
        this.logger.log(
          `No subtasks generated for session ${sessionId} - information sufficient for completion`,
        );
        return {
          success: true,
          subTasks: [],
          reason: 'Current information is sufficient to complete user intent',
        };
      }

      this.logger.log(`Generated ${subTasks.length} subtasks for session ${sessionId}`);
      return {
        success: true,
        subTasks,
      };
    } catch (error) {
      this.logger.error(
        `Failed to analyze and generate subtasks for session ${sessionId}: ${error.message}`,
      );
      this.logger.error(`Error: ${error.message}`);

      return {
        success: false,
        subTasks: [],
        error: error.message,
      };
    }
  }

  /**
   * Build comprehensive prompt for AI-powered task analysis
   *
   * Creates detailed context with:
   * - User intent and current progress
   * - Available skills and their capabilities
   * - Completion score for intelligent decision making
   * - Clear instructions for JSON response format
   * - Business rules and constraints
   */
  private buildTaskAnalysisPrompt(
    currentSummaryContent: string,
    userIntent: string,
    completionScore: number,
  ): string {
    return `
你是一个智能任务分解专家。基于当前情况分析需要执行的子任务。

用户原始意图：${userIntent}
当前总结内容：${currentSummaryContent}
当前完成度：${completionScore}

请分析并生成最多8个具体的子任务，每个任务包含：
1. 任务名称
2. 任务描述/查询内容
3. 应该使用的技能（webSearch/librarySearch/commonQnA/generateDoc/codeArtifacts/generateMedia）
4. 优先级（1-5）

可用技能说明：
- webSearch: 网络信息搜索
- librarySearch: 知识库搜索
- commonQnA: 分析、推理、总结
- generateDoc: 文档生成（需要充分信息后使用）
- codeArtifacts: 代码和可视化生成（需要充分信息后使用）
- generateMedia: 多媒体内容生成

返回JSON格式：
[
  {
    "name": "任务名称",
    "query": "具体查询内容",
    "skillName": "技能名称",
    "priority": 1
  }
]

如果当前信息已经足够完成用户意图，返回空数组 []
    `.trim();
  }

  /**
   * Parse AI response into structured SubTask objects
   *
   * Handles:
   * - JSON parsing with error recovery
   * - Task validation (required fields, valid skills)
   * - Business rule enforcement (max 8 tasks)
   * - Session context enrichment (level, sessionId)
   *
   * @param aiResponse - Raw AI model response
   * @param level - Target level for generated tasks
   * @param sessionId - Session identifier for task tracking
   * @returns Array of validated and enriched SubTask objects
   */
  public async parseSubTasks(
    aiResponse: string,
    level: number,
    sessionId: string,
  ): Promise<SubTask[]> {
    try {
      // Parse JSON response
      const parsedTasks = JSON.parse(aiResponse.trim());

      if (!Array.isArray(parsedTasks)) {
        this.logger.warn('AI response is not an array, returning empty tasks');
        return [];
      }

      // Validate and enrich tasks
      const validTasks: SubTask[] = [];

      for (const task of parsedTasks.slice(0, 8)) {
        // Enforce max 8 tasks
        if (this.isValidTaskStructure(task)) {
          validTasks.push({
            name: task.name,
            query: task.query,
            skillName: task.skillName,
            priority: task.priority,
            level,
            sessionId,
          });
        } else {
          this.logger.warn(`Skipping invalid task structure: ${JSON.stringify(task)}`);
        }
      }

      return validTasks;
    } catch (error) {
      this.logger.error(`Failed to parse AI response: ${error.message}`);
      this.logger.debug(`AI Response: ${aiResponse}`);
      return [];
    }
  }

  /**
   * Validate task structure and business rules
   *
   * Checks:
   * - Required fields presence (name, query, skillName, priority)
   * - Skill name validity against available skills
   * - Priority range (1-5)
   * - String field types and non-empty values
   */
  private isValidTaskStructure(task: any): boolean {
    return (
      task &&
      typeof task === 'object' &&
      typeof task.name === 'string' &&
      task.name.trim().length > 0 &&
      typeof task.query === 'string' &&
      task.query.trim().length > 0 &&
      typeof task.skillName === 'string' &&
      AVAILABLE_SKILLS.includes(task.skillName as AvailableSkill) &&
      typeof task.priority === 'number' &&
      task.priority >= 1 &&
      task.priority <= 5
    );
  }
}

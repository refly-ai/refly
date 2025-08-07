import { Injectable, Logger } from '@nestjs/common';
import { User, InvokeSkillRequest, SkillContext } from '@refly/openapi-schema';
import { genActionResultID } from '@refly/utils';
import { DivergentSessionService } from '../divergent-session.service';
import { DivergentSessionData } from '../models/divergent-session.model';
import { SkillOrchestrator } from './skill-orchestrator';
import { SkillServiceIntegration } from '../services/skill-service-integration';

/**
 * SubTask interface for task decomposition
 */
export interface SubTask {
  name: string;
  query: string;
  skillName: string;
  priority: number;
  level: number;
  sessionId: string;
}

/**
 * ExecutionResult interface for parallel task execution
 */
export interface ExecutionResult {
  success: boolean;
  resultId?: string;
  title?: string;
  error?: string;
}

/**
 * DivergentEngine - Core total-divide-total loop implementation
 * Implements the main divergent thinking cycle with:
 * - Root summary creation using commonQnA
 * - Task decomposition and parallel execution
 * - Result aggregation and completion evaluation
 * - Maximum 5 levels depth, 8 parallel tasks per level
 */
@Injectable()
export class DivergentEngine {
  private readonly logger = new Logger(DivergentEngine.name);

  constructor(
    private readonly sessionService: DivergentSessionService,
    private readonly skillOrchestrator: SkillOrchestrator,
    private readonly skillServiceIntegration: SkillServiceIntegration,
  ) {
    this.logger.log(
      'DivergentEngine initialized with SkillOrchestrator and SkillServiceIntegration',
    );
  }

  /**
   * Main divergent loop implementation
   * Executes total-divide-total cycle up to 5 levels deep
   * Stops when completion score >= 0.9 or max depth reached
   */
  async runDivergentLoop(
    user: User,
    userIntent: string,
    targetId: string,
  ): Promise<DivergentSessionData> {
    this.logger.log(`Starting divergent loop for user ${user.uid}, intent: ${userIntent}`);

    try {
      // 1. Create root summary node using commonQnA
      const rootSummaryResult = await this.createSummaryNode(
        user,
        targetId,
        userIntent,
        [],
        0,
        '', // Will be set after session creation
      );

      // 2. Create divergent session
      const sessionResponse = await this.sessionService.createDivergentSession(user, {
        userIntent,
        rootResultId: rootSummaryResult.resultId,
        targetId,
      });

      if (!sessionResponse.session) {
        throw new Error('Failed to create divergent session');
      }

      const session = sessionResponse.session;

      // Note: metadata will be handled by SkillService internally

      let currentLevel = 0;
      let currentSummaryResultId = rootSummaryResult.resultId;
      let currentSession = session;

      // 3. Total-divide-total loop (maximum 5 levels)
      while (currentLevel < 5) {
        this.logger.log(`Processing level ${currentLevel} for session ${session.sessionId}`);

        // 3.1 Analyze current summary and generate subtasks
        const subTasks = await this.analyzeAndGenerateSubTasks(
          currentSummaryResultId,
          userIntent,
          currentSession.globalCompletionScore,
          currentLevel,
          session.sessionId,
        );

        if (subTasks.length === 0) {
          this.logger.log(`No more subtasks generated at level ${currentLevel}, ending loop`);
          break;
        }

        // 3.2 Execute subtasks in parallel (max 8 tasks)
        const executionResults = await this.executeSubTasksInParallel(user, targetId, subTasks, [
          currentSummaryResultId,
        ]);

        // Filter successful results
        const successResults = executionResults.filter((r) => r.success);
        if (successResults.length === 0) {
          this.logger.warn(`No successful execution results at level ${currentLevel}, ending loop`);
          break;
        }

        // 3.3 Create new summary node aggregating results
        const newSummaryResult = await this.createSummaryNode(
          user,
          targetId,
          `汇聚分析以下任务结果：${successResults.map((r) => r.title).join(', ')}`,
          successResults.map((r) => r.resultId || ''),
          currentLevel + 1,
          session.sessionId,
        );

        // 3.4 Evaluate completion score
        const completionScore = await this.evaluateCompletion(
          newSummaryResult.resultId,
          userIntent,
          [...successResults.map((r) => r.resultId || ''), currentSummaryResultId],
        );

        // 3.5 Update session progress
        currentLevel++;
        currentSummaryResultId = newSummaryResult.resultId;

        const updateResponse = await this.sessionService.updateDivergentSession(user, {
          sessionId: session.sessionId,
          currentLevel,
          globalCompletionScore: completionScore,
          status: 'executing',
        });

        if (updateResponse.session) {
          currentSession = updateResponse.session;
        }

        // 3.6 Check completion threshold (90%)
        if (completionScore >= 0.9) {
          this.logger.log(
            `Completion threshold reached (${completionScore}) at level ${currentLevel}`,
          );

          // Generate final output
          const finalOutputResult = await this.generateFinalOutput(
            user,
            targetId,
            currentSummaryResultId,
            session.sessionId,
          );

          // Mark session as completed
          const completedResponse = await this.sessionService.updateDivergentSession(user, {
            sessionId: session.sessionId,
            status: 'completed',
            finalOutputResultId: finalOutputResult.resultId,
          });

          if (completedResponse.session) {
            currentSession = completedResponse.session;
          }

          break;
        }
      }

      // Handle max depth reached
      if (currentLevel >= 5 && currentSession.status === 'executing') {
        this.logger.warn(`Maximum depth (5) reached for session ${session.sessionId}`);

        const maxDepthResponse = await this.sessionService.updateDivergentSession(user, {
          sessionId: session.sessionId,
          status: 'max_depth_reached',
        });

        if (maxDepthResponse.session) {
          currentSession = maxDepthResponse.session;
        }
      }

      this.logger.log(
        `Divergent loop completed for session ${session.sessionId}, final status: ${currentSession.status}`,
      );
      return currentSession;
    } catch (error) {
      this.logger.error(
        `Failed to execute divergent loop for user ${user.uid}: ${error?.message}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Create summary node using commonQnA skill
   * Used for root summary and aggregation nodes
   */
  async createSummaryNode(
    user: User,
    targetId: string,
    query: string,
    contextResultIds: string[],
    level: number,
    _sessionId: string,
  ): Promise<any> {
    this.logger.log(
      `Creating summary node at level ${level} with ${contextResultIds.length} context items`,
    );

    try {
      const context = await this.buildContextFromResults(contextResultIds);

      const skillRequest: InvokeSkillRequest = {
        resultId: genActionResultID(),
        input: { query },
        target: { entityId: targetId, entityType: 'canvas' },
        skillName: 'commonQnA',
        context,
        resultHistory: [],
        selectedMcpServers: [],
      };

      const result = await this.skillServiceIntegration.invokeSkill(user, skillRequest);

      // Note: metadata will be handled by SkillServiceIntegration internally

      this.logger.log(`Summary node created successfully: ${result.resultId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create summary node: ${error?.message}`, error);
      throw error;
    }
  }

  /**
   * Execute subtasks in parallel with maximum 8 concurrent tasks
   * Each task runs independently and failures don't stop other tasks
   */
  async executeSubTasksInParallel(
    user: User,
    targetId: string,
    subTasks: SubTask[],
    parentResultIds: string[],
  ): Promise<ExecutionResult[]> {
    // Enforce maximum 8 parallel tasks
    const tasksToExecute = subTasks.slice(0, 8);

    this.logger.log(`Executing ${tasksToExecute.length} subtasks in parallel`);

    const context = await this.buildContextFromResults(parentResultIds);

    const promises = tasksToExecute.map(async (task): Promise<ExecutionResult> => {
      try {
        const skillRequest: InvokeSkillRequest = {
          resultId: genActionResultID(),
          input: { query: task.query },
          target: { entityId: targetId, entityType: 'canvas' },
          skillName: task.skillName,
          context,
          resultHistory: [],
          selectedMcpServers: [],
        };

        const result = await this.skillServiceIntegration.invokeSkill(user, skillRequest);

        // Note: metadata will be handled by SkillServiceIntegration internally

        return {
          success: true,
          resultId: result.resultId,
          title: task.name,
        };
      } catch (error) {
        this.logger.warn(`Subtask "${task.name}" failed: ${error?.message}`);
        return {
          success: false,
          error: error?.message || 'Unknown error',
        };
      }
    });

    const results = await Promise.all(promises);

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(
      `Parallel execution completed: ${successCount}/${results.length} tasks successful`,
    );

    return results;
  }

  /**
   * Analyze current summary and generate subtasks using AI-powered task decomposition
   * Integrates with SkillOrchestrator for intelligent task analysis
   */
  private async analyzeAndGenerateSubTasks(
    currentSummaryResultId: string,
    userIntent: string,
    completionScore: number,
    currentLevel: number,
    sessionId: string,
  ): Promise<SubTask[]> {
    this.logger.log(
      `Analyzing summary ${currentSummaryResultId} for subtask generation at level ${currentLevel}`,
    );

    try {
      // Get summary content for context (mock for now - will be enhanced in Step 5)
      const currentSummaryContent = `Summary result ID: ${currentSummaryResultId}. Current analysis progress for user intent: ${userIntent}`;

      // Use SkillOrchestrator for intelligent task decomposition
      const analysisResult = await this.skillOrchestrator.analyzeAndGenerateSubTasks(
        currentSummaryContent,
        userIntent,
        completionScore,
        currentLevel,
        sessionId,
      );

      if (!analysisResult.success) {
        this.logger.error(`SkillOrchestrator failed: ${analysisResult.error}`);
        return [];
      }

      this.logger.log(
        `SkillOrchestrator generated ${analysisResult.subTasks.length} subtasks for level ${currentLevel}`,
      );
      return analysisResult.subTasks;
    } catch (error) {
      this.logger.error(`Failed to analyze and generate subtasks: ${error.message}`);
      return [];
    }
  }

  /**
   * Evaluate completion score based on current summary and user intent
   * Returns score between 0 and 1 indicating how complete the task is
   */
  private async evaluateCompletion(
    summaryResultId: string,
    _userIntent: string,
    allPreviousResultIds: string[],
  ): Promise<number> {
    // Mock implementation for now - will be replaced by CompletionEvaluator in Step 4
    this.logger.log(`Evaluating completion for summary ${summaryResultId}`);

    // Simple heuristic: completion increases with more results
    const resultCount = allPreviousResultIds.length;
    const baseScore = Math.min(resultCount * 0.2, 0.8);

    // Add some randomness to simulate real evaluation
    const randomFactor = Math.random() * 0.2;
    const completionScore = Math.min(baseScore + randomFactor, 1.0);

    this.logger.log(`Completion score evaluated: ${completionScore}`);
    return completionScore;
  }

  /**
   * Generate final output when completion threshold is reached
   */
  private async generateFinalOutput(
    user: User,
    targetId: string,
    summaryResultId: string,
    sessionId: string,
  ): Promise<any> {
    this.logger.log(`Generating final output for session ${sessionId}`);

    try {
      const context = await this.buildContextFromResults([summaryResultId]);

      const skillRequest: InvokeSkillRequest = {
        resultId: genActionResultID(),
        input: {
          query: 'Generate comprehensive final output based on all analysis and research completed',
        },
        target: { entityId: targetId, entityType: 'canvas' },
        skillName: 'commonQnA',
        context,
        resultHistory: [],
        selectedMcpServers: [],
      };

      const result = await this.skillServiceIntegration.invokeSkill(user, skillRequest);

      // Note: metadata will be handled by SkillServiceIntegration internally

      this.logger.log(`Final output generated successfully: ${result.resultId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to generate final output: ${error?.message}`, error);
      throw error;
    }
  }

  /**
   * Build context from result IDs
   * Mock implementation for now - will be enhanced later
   */
  private async buildContextFromResults(resultIds: string[]): Promise<SkillContext> {
    this.logger.log(`Building context from ${resultIds.length} result IDs`);

    // Mock implementation - returns empty context for now
    // In real implementation, this would fetch ActionResult data and convert to SkillContext
    const context: SkillContext = {
      resources: [],
      documents: [],
      codeArtifacts: [],
      contentList: [],
    };

    // Add mock context items for testing
    if (resultIds.length > 0) {
      context.contentList?.push({
        content: `Context from results: ${resultIds.join(', ')}`,
        metadata: {
          title: 'Previous Results Context',
          source: 'divergent-engine',
          resultIds,
        },
      });
    }

    return context;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { DivergentEngine } from './divergent-engine';
import { PrismaService } from '../common/prisma.service';
import { SkillService } from '../skill/skill.service';
import { CanvasService } from '../canvas/canvas.service';
import { User, CanvasNodeType } from '@refly/openapi-schema';
import { CanvasNodeFilter } from '@refly/canvas-common';
import {
  DivergentSession,
  ConvergenceResult,
  NextActionDecision,
  DivergentTask,
  TaskResult,
} from './types/divergent.types';

/**
 * Main orchestrator for divergent-convergent workflow
 * Manages the complete "总分总" cycle with LLM intelligence
 */
@Injectable()
export class DivergentOrchestrator {
  private logger = new Logger(DivergentOrchestrator.name);

  constructor(
    private readonly divergentEngine: DivergentEngine,
    private readonly prisma: PrismaService,
    private readonly skillService: SkillService,
    private readonly canvasService: CanvasService,
  ) {}

  /**
   * Execute complete divergent-convergent cycle for a session
   */
  async executeSession(sessionId: string, user: User): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.logger.log(`Starting divergent execution for session ${sessionId}`);

    try {
      while (session.currentDepth < session.maxDepth) {
        // Get current summary (last convergence result or initial input)
        const currentSummary = await this.getCurrentSummary(session);

        // Generate divergent tasks
        const tasks = await this.generateDivergentTasks(session, currentSummary);

        // Execute tasks in parallel
        const taskResults = await this.executeTasksInParallel(session, tasks, user);

        // Converge results into new summary
        const convergenceResult = await this.convergeResults(session, taskResults);

        // Create convergence step
        await this.createConvergenceStep(session, convergenceResult, user);

        // Assess completion and decide next action
        const decision = await this.assessAndDecide(session, convergenceResult);

        if (
          decision.action === 'generate_final_output' ||
          decision.action === 'force_final_output'
        ) {
          await this.generateFinalOutput(session, decision, user);
          break;
        }

        // Continue to next depth
        session.currentDepth++;
        await this.updateSessionDepth(session);
      }

      // Mark session as completed
      await this.markSessionCompleted(session);
      this.logger.log(`Divergent execution completed for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error in divergent execution for session ${sessionId}:`, error);
      await this.markSessionFailed(session);
      throw error;
    }
  }

  /**
   * Generate divergent tasks for current summary
   */
  private async generateDivergentTasks(session: DivergentSession, currentSummary: string) {
    const canvasContext = await this.getCanvasContext(session.targetId || '');

    const tasks = await this.divergentEngine.generateDivergentTasks(
      currentSummary,
      canvasContext,
      session.maxDivergence,
      session.currentDepth,
    );

    this.logger.log(`Generated ${tasks.length} divergent tasks for depth ${session.currentDepth}`);
    return tasks;
  }

  /**
   * Execute multiple tasks in parallel
   */
  private async executeTasksInParallel(
    session: DivergentSession,
    tasks: DivergentTask[],
    user: User,
  ) {
    const promises = tasks.map(async (task, index) => {
      try {
        // Create step in database
        const step = await this.createExecutionStep(session, task, index, user);

        // Execute skill using the skill service
        const result = await this.executeSkill(user, task.skillName, task.parameters);

        // Update step with result
        await this.updateStepResult(step.stepId, result);

        return {
          stepId: step.stepId,
          skill: task.skillName,
          result,
        };
      } catch (error) {
        this.logger.warn(`Task ${index} failed:`, error);
        return null; // Failed task returns null
      }
    });

    const results = await Promise.all(promises);
    const successfulResults = results.filter((r) => r !== null);

    this.logger.log(`Completed ${successfulResults.length}/${tasks.length} tasks`);
    return successfulResults;
  }

  /**
   * Converge task results into summary
   */
  private async convergeResults(
    session: DivergentSession,
    taskResults: TaskResult[],
  ): Promise<ConvergenceResult> {
    const canvasContext = await this.getCanvasContext(session.targetId || '');
    const originalQuery = typeof session.input === 'string' ? session.input : session.input.query;

    return await this.divergentEngine.convergeResults(
      taskResults,
      originalQuery,
      canvasContext,
      session.currentDepth,
    );
  }

  /**
   * Assess completion and decide next action
   */
  private async assessAndDecide(
    session: DivergentSession,
    convergenceResult: ConvergenceResult,
  ): Promise<NextActionDecision> {
    const originalQuery = typeof session.input === 'string' ? session.input : session.input.query;

    return await this.divergentEngine.assessCompletion(
      convergenceResult,
      originalQuery,
      session.currentDepth,
      session.maxDepth,
    );
  }

  /**
   * Generate final output using appropriate skill
   */
  private async generateFinalOutput(
    session: DivergentSession,
    decision: NextActionDecision,
    user: User,
  ) {
    const skill = decision.recommendedSkill || 'generateDoc';
    const summary = await this.getCurrentSummary(session);

    // Create final output step
    const step = await this.createFinalOutputStep(session, skill, user);

    try {
      // Execute final skill using the skill service
      const result = await this.executeSkill(user, skill, { summary, type: 'final_output' });

      await this.updateStepResult(step.stepId, result);
      this.logger.log(`Generated final output using ${skill}`);
    } catch (error) {
      this.logger.error('Failed to generate final output:', error);
      throw error;
    }
  }

  // ========== DATABASE HELPER METHODS ==========

  private async getSession(sessionId: string): Promise<DivergentSession | null> {
    const session = await this.prisma.pilotSession.findUnique({
      where: { sessionId },
    });

    if (!session) return null;

    return {
      ...session,
      mode: session.mode || 'divergent',
      maxDivergence: session.maxDivergence || 8,
      maxDepth: session.maxDepth || 5,
      currentDepth: session.currentDepth || 0,
      createdAt: session.createdAt?.toISOString() || '',
      updatedAt: session.updatedAt?.toISOString() || '',
    } as unknown as DivergentSession;
  }

  private async getCurrentSummary(session: DivergentSession): Promise<string> {
    // Get the latest convergence step result, or use initial input
    const latestStep = await this.prisma.pilotStep.findFirst({
      where: {
        sessionId: session.sessionId,
        nodeType: 'summary',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (latestStep?.rawOutput) {
      try {
        const parsed = JSON.parse(latestStep.rawOutput);
        return parsed.summary || latestStep.rawOutput;
      } catch {
        return latestStep.rawOutput;
      }
    }

    return typeof session.input === 'string' ? session.input : session.input.query;
  }

  private async createExecutionStep(
    session: DivergentSession,
    task: DivergentTask,
    index: number,
    user: User,
  ) {
    const stepId = `${session.sessionId}-d${session.currentDepth}-t${index}`;

    // Create step in database
    const step = await this.prisma.pilotStep.create({
      data: {
        stepId,
        sessionId: session.sessionId,
        name: task.name,
        epoch: session.currentDepth,
        nodeType: 'execution',
        depth: session.currentDepth,
        convergenceGroup: `depth-${session.currentDepth}`,
        status: 'executing',
      },
    });

    // Find parent step ID for connection
    let parentStepId: string | undefined;
    if (session.currentDepth > 0) {
      // Connect to the latest summary step from previous depth
      const parentSummaryStep = await this.prisma.pilotStep.findFirst({
        where: {
          sessionId: session.sessionId,
          nodeType: 'summary',
          depth: session.currentDepth - 1,
        },
        orderBy: { createdAt: 'desc' },
      });
      parentStepId = parentSummaryStep?.stepId;
    }

    // Add execution node to canvas
    await this.addExecutionNodeToCanvas(session, stepId, task.name, parentStepId, user);

    return step;
  }

  private async createConvergenceStep(
    session: DivergentSession,
    convergenceResult: ConvergenceResult,
    user: User,
  ) {
    const stepId = `${session.sessionId}-d${session.currentDepth}-summary`;
    const summaryTitle = `Summary D${session.currentDepth} (${Math.round(convergenceResult.completionScore * 100)}%)`;

    // Create step in database
    const step = await this.prisma.pilotStep.create({
      data: {
        stepId,
        sessionId: session.sessionId,
        name: summaryTitle,
        epoch: session.currentDepth,
        nodeType: 'summary',
        depth: session.currentDepth,
        completionScore: convergenceResult.completionScore.toString(),
        status: 'completed',
        rawOutput: JSON.stringify(convergenceResult),
      },
    });

    // Find all execution steps from current convergence group
    const executionSteps = await this.prisma.pilotStep.findMany({
      where: {
        sessionId: session.sessionId,
        nodeType: 'execution',
        depth: session.currentDepth,
        convergenceGroup: `depth-${session.currentDepth}`,
      },
      select: { stepId: true },
    });

    const executionStepIds = executionSteps.map((step) => step.stepId);

    // Add summary node to canvas with connections from execution nodes
    await this.addSummaryNodeToCanvas(session, stepId, summaryTitle, executionStepIds, user);

    return step;
  }

  private async createFinalOutputStep(session: DivergentSession, skill: string, user: User) {
    const stepId = `${session.sessionId}-final-output`;
    const finalTitle = `Final Output (${skill})`;

    // Create step in database
    const step = await this.prisma.pilotStep.create({
      data: {
        stepId,
        sessionId: session.sessionId,
        name: finalTitle,
        epoch: session.currentDepth,
        nodeType: 'summary',
        depth: session.currentDepth,
        status: 'executing',
      },
    });

    // Find the latest summary step to connect from
    const latestSummaryStep = await this.prisma.pilotStep.findFirst({
      where: {
        sessionId: session.sessionId,
        nodeType: 'summary',
        stepId: { not: stepId }, // Exclude the final output step itself
      },
      orderBy: { createdAt: 'desc' },
      select: { stepId: true },
    });

    const parentStepIds = latestSummaryStep ? [latestSummaryStep.stepId] : [];

    // Add final output node to canvas
    await this.addSummaryNodeToCanvas(session, stepId, finalTitle, parentStepIds, user);

    return step;
  }

  private async updateStepResult(stepId: string, result: Record<string, unknown> | string | null) {
    return await this.prisma.pilotStep.update({
      where: { stepId },
      data: {
        status: 'completed',
        rawOutput: JSON.stringify(result),
      },
    });
  }

  private async updateSessionDepth(session: DivergentSession) {
    return await this.prisma.pilotSession.update({
      where: { sessionId: session.sessionId },
      data: { currentDepth: session.currentDepth },
    });
  }

  private async markSessionCompleted(session: DivergentSession) {
    return await this.prisma.pilotSession.update({
      where: { sessionId: session.sessionId },
      data: { status: 'completed' },
    });
  }

  private async markSessionFailed(session: DivergentSession) {
    return await this.prisma.pilotSession.update({
      where: { sessionId: session.sessionId },
      data: { status: 'failed' },
    });
  }

  private async getCanvasContext(_targetId: string) {
    // TODO: Implement canvas context retrieval
    // For now, return empty context
    return { nodes: [], connections: [] };
  }

  /**
   * Execute a skill with given parameters using real SkillService
   */
  private async executeSkill(
    user: User,
    skillName: string,
    parameters: Record<string, unknown>,
  ): Promise<Record<string, unknown> | string | null> {
    try {
      this.logger.log(`Executing skill: ${skillName} with parameters:`, parameters);

      // Generate a unique result ID for this skill execution
      const { genActionResultID } = await import('@refly/utils');
      const resultId = genActionResultID();

      // Prepare skill execution parameters
      const skillRequest = {
        resultId,
        skillName,
        input: {
          query: (parameters.query as string) || 'Divergent task execution',
          ...parameters,
        },
        target: {
          entityId: 'divergent-workflow',
          entityType: 'canvas' as const,
        },
        ...(parameters.skillConfig && { skillConfig: parameters.skillConfig }),
      };

      this.logger.log(`Sending skill task: ${skillName} with resultId: ${resultId}`);

      // Execute skill using SkillService
      const actionResult = await this.skillService.sendInvokeSkillTask(user as any, skillRequest);

      if (!actionResult) {
        this.logger.warn(`Skill execution returned null for ${skillName}`);
        return null;
      }

      // Extract and format the result
      const lastStep =
        actionResult.steps && actionResult.steps.length > 0
          ? actionResult.steps[actionResult.steps.length - 1]
          : null;

      const result = {
        resultId: actionResult.resultId,
        skillName,
        parameters,
        status: actionResult.status,
        output: lastStep?.content || actionResult.title || 'No output generated',
        executedAt: actionResult.createdAt || new Date().toISOString(),
      };

      this.logger.log(`Skill ${skillName} completed with status: ${actionResult.status}`);
      return result;
    } catch (error) {
      this.logger.error(`Skill execution failed for ${skillName}:`, error);
      return null;
    }
  }

  // ========== CANVAS INTEGRATION METHODS ==========

  /**
   * Add execution node to canvas for divergent task
   */
  private async addExecutionNodeToCanvas(
    session: DivergentSession,
    stepId: string,
    taskName: string,
    parentStepId: string | undefined,
    user: User,
  ) {
    // Only create canvas nodes for canvas targets
    if (session.targetType !== 'canvas' || !session.targetId) {
      return;
    }

    try {
      // Use the real user for canvas operations to ensure proper transaction tracking

      // Determine connection to parent node if exists
      let connectTo: CanvasNodeFilter[] | undefined = undefined;
      if (parentStepId) {
        connectTo = [
          {
            type: 'skillResponse' as CanvasNodeType,
            entityId: parentStepId,
            handleType: 'source' as const,
          },
        ];
      }

      await this.canvasService.addNodeToCanvas(
        user,
        session.targetId,
        {
          type: 'skillResponse',
          data: {
            title: taskName,
            entityId: stepId,
            metadata: {
              nodeType: 'execution',
              status: 'executing',
              depth: session.currentDepth,
              convergenceGroup: `depth-${session.currentDepth}`,
              modelInfo: {
                modelId: 'divergent-execution',
              },
              sizeMode: 'compact',
            },
          },
        },
        connectTo,
      );

      this.logger.log(`Added execution node to canvas: ${stepId}`);
    } catch (error) {
      this.logger.error(`Failed to add execution node to canvas: ${stepId}`, error);
    }
  }

  /**
   * Add summary node to canvas for convergence result
   */
  private async addSummaryNodeToCanvas(
    session: DivergentSession,
    stepId: string,
    summaryTitle: string,
    convergenceGroupStepIds: string[],
    user: User,
  ) {
    // Only create canvas nodes for canvas targets
    if (session.targetType !== 'canvas' || !session.targetId) {
      return;
    }

    try {
      // Use the real user for canvas operations to ensure proper transaction tracking

      // Connect from all execution nodes in the convergence group
      const connectTo: CanvasNodeFilter[] = convergenceGroupStepIds.map((executionStepId) => ({
        type: 'skillResponse' as CanvasNodeType,
        entityId: executionStepId,
        handleType: 'source' as const,
      }));

      await this.canvasService.addNodeToCanvas(
        user,
        session.targetId,
        {
          type: 'skillResponse',
          data: {
            title: summaryTitle,
            entityId: stepId,
            metadata: {
              nodeType: 'summary',
              status: 'completed',
              depth: session.currentDepth,
              modelInfo: {
                modelId: 'divergent-summary',
              },
              sizeMode: 'compact',
            },
          },
        },
        connectTo,
      );

      this.logger.log(`Added summary node to canvas: ${stepId}`);
    } catch (error) {
      this.logger.error(`Failed to add summary node to canvas: ${stepId}`, error);
    }
  }
}

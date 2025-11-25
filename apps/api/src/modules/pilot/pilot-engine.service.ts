import { Injectable, Logger } from '@nestjs/common';
import { BaseChatModel } from '@refly/providers';
import { PrismaService } from '../common/prisma.service';
import { CanvasContentItem } from '../canvas/canvas.dto';
import { GenericToolset } from '@refly/openapi-schema';
import { ProgressPlan, ProgressStage, ProgressSubtask } from './pilot.types';

// Types for progress management
interface SubtaskExecutionStatus {
  stepId: string;
  name: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  resultId?: string;
  output?: string;
  errorMessage?: string;
  completedAt?: string;
}
import { IntentAnalysisService } from './intent-analysis.service';

import { PilotStep, ActionResult } from '@prisma/client';
import { safeParseJSON } from '@refly/utils';

@Injectable()
export class PilotEngineService {
  private logger = new Logger(PilotEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly intentAnalysisService: IntentAnalysisService,
  ) {}

  /**
   * Main entry point for pilot execution with comprehensive progress management
   */
  async runPilot(
    model: BaseChatModel,
    sessionId: string,
    userQuestion: string,
    availableTools: GenericToolset[],
    canvasContent: CanvasContentItem[],
    locale?: string,
  ): Promise<ProgressPlan> {
    try {
      this.logger.log(`Starting pilot execution for session ${sessionId}`);

      // 3. Always perform dynamic re-planning for existing plans
      // This ensures the plan is always up-to-date with current execution status
      const isExistingPlan = await this.isExistingPlan(sessionId);
      let progressPlan: ProgressPlan | null = null;

      if (!isExistingPlan) {
        // 1. Get or create progress plan
        progressPlan = await this.getOrCreateProgressPlan(
          sessionId,
          userQuestion,
          model,
          availableTools,
          canvasContent,
          locale,
        );
      } else {
        // 2. Get existing progress plan first
        progressPlan = await this.getOrCreateProgressPlan(
          sessionId,
          userQuestion,
          model,
          availableTools,
          canvasContent,
          locale,
        );

        // 3. Sync current stage status and update progress
        progressPlan = await this.syncCurrentStageStatus(sessionId, progressPlan);

        this.logger.log(`Dynamic re-planning triggered for existing plan in session ${sessionId}`);
        const replannedPlan = await this.performDynamicReplanning(
          model,
          userQuestion,
          progressPlan,
          availableTools,
          canvasContent,
          locale,
        );

        // Update the progress plan with re-planned results
        if (replannedPlan) {
          progressPlan = Object.assign(progressPlan, replannedPlan);
        } else {
          this.logger.warn('Re-planned plan is null or undefined, keeping original plan');
        }
      }

      // Persist the updated plan
      await this.persistProgressPlan(sessionId, progressPlan);

      // 5. Update and persist progress plan
      await this.updateAndPersistProgress(sessionId, progressPlan);

      this.logger.log(`Pilot execution completed for session ${sessionId}`);

      return progressPlan;
    } catch (error) {
      this.logger.error(`Error in pilot execution for session ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get or create progress plan for a session
   */
  private async getOrCreateProgressPlan(
    sessionId: string,
    userQuestion: string,
    model: BaseChatModel,
    availableTools: GenericToolset[],
    canvasContent: CanvasContentItem[],
    locale?: string,
  ): Promise<ProgressPlan> {
    try {
      // Try to get existing progress plan from database
      const session = await this.prisma.pilotSession.findUnique({
        where: { sessionId },
        select: { progress: true },
      });

      if (session?.progress) {
        try {
          const existingPlan = safeParseJSON(session.progress) as ProgressPlan;
          this.logger.log(`Retrieved existing progress plan for session ${sessionId}`);
          return existingPlan;
        } catch (_parseError) {
          this.logger.warn(`Failed to parse existing progress plan for session ${sessionId}`);
        }
      }

      // Create new progress plan through comprehensive intent analysis
      const newPlan = await this.createNewProgressPlan(
        model,
        userQuestion,
        availableTools,
        canvasContent,
        locale,
      );

      // Persist the new plan to database
      await this.persistProgressPlan(sessionId, newPlan);
      return newPlan;
    } catch (error) {
      this.logger.error(
        `Error getting/creating progress plan for session ${sessionId}: ${error.message}`,
      );
      throw new Error(`Failed to get or create progress plan: ${error.message}`);
    }
  }

  /**
   * Create new progress plan through comprehensive intent analysis
   */
  private async createNewProgressPlan(
    model: BaseChatModel,
    userQuestion: string,
    availableTools: GenericToolset[],
    canvasContent: CanvasContentItem[],
    locale?: string,
  ): Promise<ProgressPlan> {
    try {
      // Use the new comprehensive planning method
      const planWithSubtasks = await this.intentAnalysisService.analyzeIntentAndPlanWithSubtasks(
        model,
        userQuestion,
        null, // No existing progress plan for initial planning
        availableTools,
        canvasContent,
        locale,
      );

      // Convert ProgressPlanWithSubtasks to ProgressPlan
      const progressPlan: ProgressPlan = {
        stages: planWithSubtasks.stages,
        currentStageIndex: planWithSubtasks.currentStageIndex,
        overallProgress: planWithSubtasks.overallProgress,
        lastUpdated: planWithSubtasks.lastUpdated,
        planningLogic: planWithSubtasks.planningLogic,
        userIntent: planWithSubtasks.userIntent,
        estimatedTotalEpochs: planWithSubtasks.estimatedTotalEpochs,
      };

      // Add current stage subtasks to the first stage
      if (progressPlan.stages.length > 0 && planWithSubtasks.currentStageSubtasks.length > 0) {
        progressPlan.stages[0].subtasks = planWithSubtasks.currentStageSubtasks;
      }

      return progressPlan;
    } catch (error) {
      this.logger.error(`Error creating new progress plan: ${error.message}`);
      throw new Error(`Failed to create progress plan: ${error.message}`);
    }
  }

  /**
   * Sync current stage status and update progress
   */
  private async syncCurrentStageStatus(
    sessionId: string,
    progressPlan: ProgressPlan,
  ): Promise<ProgressPlan> {
    try {
      if (!progressPlan) {
        throw new Error(`Progress plan is null for session ${sessionId}`);
      }

      const session = await this.prisma.pilotSession.findUnique({
        where: { sessionId },
        select: { currentEpoch: true },
      });

      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const currentEpoch = (session.currentEpoch ?? 0) - 1;
      const currentStage = progressPlan.stages[currentEpoch];

      if (!currentStage) {
        this.logger.warn(`No stage found for epoch ${currentEpoch} in session ${sessionId}`);
        return;
      }

      // Get current epoch steps and action results from database
      const currentEpochSteps = await this.prisma.pilotStep.findMany({
        where: {
          sessionId,
          epoch: currentEpoch,
          mode: 'subtask',
        },
      });

      const currentEpochActionResults = await this.prisma.actionResult.findMany({
        where: {
          pilotStepId: {
            in: currentEpochSteps.map((step) => step.stepId),
          },
        },
      });

      currentStage.summary = '';

      // Get subtask execution statuses
      const subtaskStatuses = await this.getSubtaskExecutionStatuses(
        currentStage,
        currentEpochSteps,
        currentEpochActionResults,
      );

      // Update stage with current subtask statuses
      await this.updateStageWithSubtaskStatuses(currentStage, subtaskStatuses);
      progressPlan.currentStageIndex = session.currentEpoch;

      // Update stage progress based on database state
      await this.updateStageProgress(
        currentStage,
        currentEpochSteps,
        currentEpochActionResults,
        currentEpoch,
      );
      this.calculateOverallProgress(progressPlan);

      return progressPlan;
    } catch (error) {
      this.logger.error(
        `Error syncing current stage status for session ${sessionId}: ${error.message}`,
      );
      throw new Error(`Failed to sync stage status: ${error.message}`);
    }
  }

  /**
   * Update stage progress based on database state and generate stage summary
   */
  private async updateStageProgress(
    stage: ProgressStage,
    steps: PilotStep[],
    actionResults: ActionResult[],
    currentEpoch: number,
  ): Promise<void> {
    try {
      if (steps.length === 0) {
        stage.stageProgress = 0;
        return;
      }

      const completedSteps = steps.filter((step) => step.status === 'finish');
      const totalSteps = steps.length;
      stage.stageProgress = Math.round((completedSteps.length / totalSteps) * 100);

      if (stage.stageProgress === 100) {
        stage.status = 'completed';
        stage.completedAt = new Date().toISOString();
      } else if (stage.stageProgress > 0) {
        stage.status = 'in_progress';
        if (!stage.startedAt) {
          stage.startedAt = new Date().toISOString();
        }
      }

      // Generate stage summary from action results
      const stageSummary = await this.extractStageSummaryFromActionResults(
        actionResults,
        stage,
        currentEpoch,
      );
      if (stageSummary) {
        stage.summary = stageSummary;
      }
    } catch (error) {
      this.logger.error(`Error updating stage progress: ${error.message}`);
    }
  }

  /**
   * Extract stage summary from action results, specifically from summary-type results
   */
  private async extractStageSummaryFromActionResults(
    actionResults: ActionResult[],
    stage: ProgressStage,
    currentEpoch: number,
  ): Promise<string | undefined> {
    try {
      if (actionResults.length === 0) {
        return undefined;
      }

      // Find all steps in the same epoch
      const epochSteps = await this.prisma.pilotStep.findMany({
        where: {
          sessionId: actionResults[0]?.pilotSessionId || '',
          epoch: currentEpoch,
        },
      });

      // Filter for summary steps only
      const epochSummarySteps = epochSteps.filter((step) => step.mode === 'summary');

      if (epochSummarySteps.length === 0) {
        // If no summary steps, generate a basic summary from other results
        const completedResults = actionResults.filter((result) => result.status === 'finish');
        if (completedResults.length > 0) {
          return `Stage "${stage.name}" completed ${completedResults.length} actions successfully.`;
        }
        return undefined;
      }

      // Get action step data for summary steps only
      // We need to get the entityId from PilotStep, then find the corresponding ActionResult
      const summaryEntityIds = epochSummarySteps.map((step) => step.entityId).filter(Boolean);

      // Find the corresponding action results for summary steps
      const summaryActionResults = await this.prisma.actionResult.findMany({
        where: {
          resultId: { in: summaryEntityIds },
          version: 0, // Get the latest version
        },
      });

      if (summaryActionResults.length === 0) {
        return undefined;
      }

      // Get action steps for these action results
      const summaryResultIds = summaryActionResults.map((result) => result.resultId);
      const actionSteps = await this.prisma.actionStep.findMany({
        where: {
          resultId: { in: summaryResultIds },
          version: 0, // Get the latest version
        },
        orderBy: [{ resultId: 'asc' }, { order: 'asc' }],
      });

      // Group steps by resultId
      const stepsByResultId = actionSteps.reduce(
        (map, step) => {
          if (!map[step.resultId]) {
            map[step.resultId] = [];
          }
          map[step.resultId].push(step);
          return map;
        },
        {} as Record<string, typeof actionSteps>,
      );

      // Extract content from summary results
      const summaries: string[] = [];

      for (const actionResult of summaryActionResults) {
        try {
          const steps = stepsByResultId[actionResult.resultId];
          if (steps && steps.length > 0) {
            // Get the first step's content (steps[0].content)
            const firstStep = steps[0];
            if (firstStep?.content) {
              summaries.push(firstStep.content);
            }
          }
        } catch (parseError) {
          this.logger.warn(
            `Failed to extract summary from action result ${actionResult.resultId}: ${parseError.message}`,
          );
          // Fallback to title if parsing fails
          if (actionResult.title) {
            summaries.push(actionResult.title);
          }
        }
      }

      if (summaries.length > 0) {
        return summaries.join('\n\n');
      }

      return undefined;
    } catch (error) {
      this.logger.error(`Error extracting stage summary: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Calculate overall progress across all stages
   */
  private calculateOverallProgress(progressPlan: ProgressPlan): void {
    try {
      const totalStages = progressPlan.stages.length;
      if (totalStages === 0) {
        progressPlan.overallProgress = 0;
        return;
      }

      const completedStages = progressPlan.stages.filter((stage) => stage.status === 'completed');
      const inProgressStages = progressPlan.stages.filter(
        (stage) => stage.status === 'in_progress',
      );

      let totalProgress = 0;
      totalProgress += completedStages.length * 100;

      for (const stage of inProgressStages) {
        totalProgress += stage.stageProgress || 0;
      }

      progressPlan.overallProgress = Math.round(totalProgress / totalStages);
    } catch (error) {
      this.logger.error(`Error calculating overall progress: ${error.message}`);
    }
  }

  /**
   * Update and persist progress plan to database
   */
  private async updateAndPersistProgress(
    sessionId: string,
    progressPlan: ProgressPlan,
  ): Promise<void> {
    try {
      progressPlan.lastUpdated = new Date().toISOString();
      await this.persistProgressPlan(sessionId, progressPlan);

      this.logger.log(
        `Progress plan updated for session ${sessionId}. Overall progress: ${progressPlan.overallProgress}%`,
      );
    } catch (error) {
      this.logger.error(
        `Error updating and persisting progress for session ${sessionId}: ${error.message}`,
      );
      throw new Error(`Failed to update and persist progress: ${error.message}`);
    }
  }

  /**
   * Persist progress plan to database
   */
  private async persistProgressPlan(sessionId: string, progressPlan: ProgressPlan): Promise<void> {
    try {
      await this.prisma.pilotSession.update({
        where: { sessionId },
        data: {
          progress: JSON.stringify(progressPlan),
        },
      });
      this.logger.log(`Progress plan persisted to database for session ${sessionId}`);
    } catch (error) {
      this.logger.error(
        `Error persisting progress plan for session ${sessionId}: ${error.message}`,
      );
      throw new Error(`Failed to persist progress plan: ${error.message}`);
    }
  }

  /**
   * Get subtask execution statuses for a stage
   */
  private async getSubtaskExecutionStatuses(
    stage: ProgressStage,
    steps: PilotStep[],
    actionResults: ActionResult[],
  ): Promise<SubtaskExecutionStatus[]> {
    try {
      const subtaskStatuses: SubtaskExecutionStatus[] = [];

      for (const step of steps) {
        const actionResult = actionResults.find((result) => result.pilotStepId === step.stepId);

        if (actionResult) {
          const status: SubtaskExecutionStatus = {
            stepId: step.stepId,
            name: step.name,
            status: this.mapStepStatusToSubtaskStatus(step.status),
            resultId: step.entityId,
            output: actionResult.outputUrl || actionResult.storageKey || undefined,
            errorMessage: actionResult.errors
              ? typeof actionResult.errors === 'string'
                ? actionResult.errors
                : JSON.stringify(actionResult.errors)
              : undefined,
            completedAt:
              step.status === 'finish' && step.updatedAt
                ? step.updatedAt instanceof Date
                  ? step.updatedAt.toISOString()
                  : String(step.updatedAt)
                : undefined,
          };

          subtaskStatuses.push(status);
        }
      }

      this.logger.log(
        `Retrieved ${subtaskStatuses.length} subtask statuses for stage "${stage.name}"`,
      );
      return subtaskStatuses;
    } catch (error) {
      this.logger.error(`Error getting subtask execution statuses: ${error.message}`);
      throw new Error(`Failed to get subtask execution statuses: ${error.message}`);
    }
  }

  /**
   * Map step status to subtask status
   */
  private mapStepStatusToSubtaskStatus(stepStatus: string): ProgressSubtask['status'] {
    switch (stepStatus) {
      case 'waiting':
        return 'pending';
      case 'executing':
        return 'executing';
      case 'finish':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }

  /**
   * Update stage with subtask statuses
   */
  private async updateStageWithSubtaskStatuses(
    stage: ProgressStage,
    subtaskStatuses: SubtaskExecutionStatus[],
  ): Promise<void> {
    try {
      // Update existing subtasks with current statuses
      const updatedSubtasks: ProgressSubtask[] = stage.subtasks.map((existingSubtask) => {
        const statusUpdate = subtaskStatuses.find(
          (status) =>
            // status.stepId === existingSubtask.id ||
            // status.resultId === existingSubtask.resultId ||
            status.name.trim() === existingSubtask.name.trim(),
        );

        if (statusUpdate) {
          return {
            ...existingSubtask,
            status: statusUpdate.status,
            output: statusUpdate.output,
            errorMessage: statusUpdate.errorMessage,
            completedAt: statusUpdate.completedAt,
          };
        }

        return existingSubtask;
      });

      // Add new subtasks that don't exist yet
      const existingSubtaskNames = new Set(updatedSubtasks.map((st) => st.name));
      const newSubtasks: ProgressSubtask[] = subtaskStatuses
        .filter((status) => !existingSubtaskNames.has(status.name))
        .map((status) => ({
          id: status.stepId,
          name: status.name,
          query: '', // Will be filled when generating new tasks
          status: status.status,
          output: status.output,
          resultId: status.resultId,
          createdAt: new Date().toISOString(),
          completedAt: status.completedAt,
          errorMessage: status.errorMessage,
        }));

      stage.subtasks = [...updatedSubtasks, ...newSubtasks];

      this.logger.log(`Updated stage "${stage.name}" with ${stage.subtasks.length} subtasks`);
    } catch (error) {
      this.logger.error(`Error updating stage with subtask statuses: ${error.message}`);
      throw new Error(`Failed to update stage with subtask statuses: ${error.message}`);
    }
  }

  /**
   * Check if this is an existing plan (not a newly created one)
   */
  private async isExistingPlan(sessionId: string): Promise<boolean> {
    try {
      const session = await this.prisma.pilotSession.findUnique({
        where: { sessionId },
        select: { progress: true },
      });

      // If progress exists and is not empty, it's an existing plan
      return !!(session?.progress && session.progress.trim() !== '');
    } catch (error) {
      this.logger.error(`Error checking if plan exists for session ${sessionId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if dynamic re-planning is needed (legacy method - now always re-plan for existing plans)
   */
  private async checkIfNeedsReplanning(progressPlan: ProgressPlan): Promise<boolean> {
    try {
      // Check if current stage has been running for too long without progress
      const currentStage = progressPlan.stages[progressPlan.currentStageIndex];
      if (!currentStage) {
        return false;
      }

      // Check if current stage has no subtasks or all subtasks are stuck
      const hasSubtasks = currentStage.subtasks.length > 0;
      const allSubtasksStuck = currentStage.subtasks.every(
        (subtask) => subtask.status === 'failed' || subtask.status === 'pending',
      );

      // Check if overall progress is stalled
      const progressStalled = progressPlan.overallProgress < 10 && currentStage.stageProgress === 0;

      // Check if we need to re-plan based on execution results
      const needsReplanning = !hasSubtasks || allSubtasksStuck || progressStalled;

      if (needsReplanning) {
        this.logger.log(
          `Re-planning needed: hasSubtasks=${hasSubtasks}, allSubtasksStuck=${allSubtasksStuck}, progressStalled=${progressStalled}`,
        );
      }

      return needsReplanning;
    } catch (error) {
      this.logger.error(`Error checking re-planning needs: ${error.message}`);
      return false;
    }
  }

  /**
   * Perform dynamic re-planning with context
   */
  private async performDynamicReplanning(
    model: BaseChatModel,
    userQuestion: string,
    currentPlan: ProgressPlan,
    availableTools: GenericToolset[],
    canvasContent: CanvasContentItem[],
    locale?: string,
  ): Promise<ProgressPlan> {
    try {
      // Use comprehensive planning with existing progress plan as context
      const planWithSubtasks = await this.intentAnalysisService.analyzeIntentAndPlanWithSubtasks(
        model,
        userQuestion,
        currentPlan, // Pass existing plan for context
        availableTools,
        canvasContent,
        locale,
      );

      // Validate the result
      if (!planWithSubtasks) {
        this.logger.warn(
          'analyzeIntentAndPlanWithSubtasks returned null/undefined, using current plan',
        );
        return currentPlan;
      }

      // Convert ProgressPlanWithSubtasks to ProgressPlan
      const replannedPlan: ProgressPlan = {
        stages: planWithSubtasks.stages || currentPlan.stages,
        currentStageIndex: currentPlan.currentStageIndex,
        overallProgress: planWithSubtasks.overallProgress ?? currentPlan.overallProgress,
        lastUpdated: planWithSubtasks.lastUpdated || new Date().toISOString(),
        planningLogic: planWithSubtasks.planningLogic || currentPlan.planningLogic,
        userIntent: planWithSubtasks.userIntent || currentPlan.userIntent,
        estimatedTotalEpochs:
          planWithSubtasks.estimatedTotalEpochs ?? currentPlan.estimatedTotalEpochs,
      };

      // Add current stage subtasks to the current stage
      const currentStage = replannedPlan.stages[replannedPlan.currentStageIndex];
      if (currentStage && planWithSubtasks.currentStageSubtasks?.length > 0) {
        currentStage.subtasks = planWithSubtasks.currentStageSubtasks;
      }

      this.logger.log(
        `Dynamic re-planning completed. Updated ${replannedPlan.stages.length} stages with ${planWithSubtasks.currentStageSubtasks?.length || 0} current stage subtasks`,
      );
      return replannedPlan;
    } catch (error) {
      this.logger.error(`Error performing dynamic re-planning: ${error.message}`);
      // Return original plan if re-planning fails
      return currentPlan;
    }
  }

  /**
   * Get current progress plan for a session
   */
  async getCurrentProgressPlan(sessionId: string): Promise<ProgressPlan | null> {
    try {
      const session = await this.prisma.pilotSession.findUnique({
        where: { sessionId },
        select: { progress: true },
      });

      if (session?.progress) {
        return safeParseJSON(session.progress) as ProgressPlan;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting progress plan for session ${sessionId}: ${error.message}`);
      return null;
    }
  }
}

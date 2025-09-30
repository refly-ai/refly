import { Logger } from '@nestjs/common';
import { BaseChatModel } from '@refly/providers';
import { extractJsonFromMarkdown } from '@refly/utils';
import { CanvasContentItem } from '../canvas/canvas.dto';
import { GenericToolset } from '@refly/openapi-schema';
import { multiStepSchema, PilotStepRawOutput } from './prompt/schema';
import {
  generatePlanningPrompt,
  generateFallbackPrompt,
  getRecommendedStageForEpoch,
} from './prompt';
import { MAX_EPOCH, MAX_STEPS_PER_EPOCH } from './pilot.service';
import {
  ProgressPlan,
  ProgressStage,
  ProgressSubtask,
  PilotSessionWithProgress,
  PilotStepWithMode,
  ActionResultWithOutput,
} from './pilot.types';
import { IntentAnalysisService } from './intent-analysis.service';

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

export class PilotEngine {
  private logger = new Logger(PilotEngine.name);
  private progressPlan: ProgressPlan | null = null;

  constructor(
    private readonly model: BaseChatModel,
    private readonly session: PilotSessionWithProgress,
    private readonly steps: PilotStepWithMode[],
    private readonly actionResults: ActionResultWithOutput[],
    private readonly intentAnalysisService: IntentAnalysisService,
    private readonly userQuestion: string,
    private readonly availableTools: GenericToolset[],
    private readonly canvasContent: CanvasContentItem[],
    private readonly locale?: string,
  ) {}

  /**
   * Main entry point for pilot execution with comprehensive progress management
   */
  async run(maxStepsPerEpoch = MAX_STEPS_PER_EPOCH): Promise<PilotStepRawOutput[]> {
    try {
      if (!this.userQuestion) {
        this.logger.warn('No user question provided for pilot execution');
        return [];
      }

      this.logger.log(`Starting pilot execution for: "${this.userQuestion}"`);

      // 1. Get or create progress plan
      this.progressPlan = await this.getOrCreateProgressPlan();

      // 2. Sync current stage status and update progress
      await this.syncCurrentStageStatus();

      // 3. Generate tasks based on current status
      const tasks = await this.generateTasksBasedOnStatus(maxStepsPerEpoch);

      // 4. Update and persist progress plan
      await this.updateAndPersistProgress(tasks);

      this.logger.log(`Pilot execution completed. Generated ${tasks.length} tasks`);
      return tasks;
    } catch (error) {
      this.logger.error(`Error in pilot execution: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get or create progress plan
   */
  private async getOrCreateProgressPlan(): Promise<ProgressPlan> {
    try {
      // Try to get existing progress plan from session
      if (this.session.progress) {
        try {
          const existingPlan = JSON.parse(this.session.progress) as ProgressPlan;
          this.logger.log('Retrieved existing progress plan from session');
          return existingPlan;
        } catch (_parseError) {
          this.logger.warn('Failed to parse existing progress plan, will create new one');
        }
      }

      // Create new progress plan through intent analysis
      this.logger.log('Creating new progress plan through intent analysis');
      return await this.createNewProgressPlan();
    } catch (error) {
      this.logger.error(`Error getting/creating progress plan: ${error.message}`);
      throw new Error(`Failed to get or create progress plan: ${error.message}`);
    }
  }

  /**
   * Create new progress plan through intent analysis
   */
  private async createNewProgressPlan(): Promise<ProgressPlan> {
    try {
      // IntentAnalysisService.analyzeIntentAndPlan already returns a ProgressPlan
      const progressPlan = await this.intentAnalysisService.analyzeIntentAndPlan(
        this.model,
        this.userQuestion,
        this.availableTools,
        this.canvasContent,
        this.locale,
      );

      // Validate the returned progress plan
      if (!progressPlan.stages || !Array.isArray(progressPlan.stages)) {
        throw new Error('Invalid progress plan: missing or invalid stages');
      }

      // Ensure the first stage is marked as in_progress
      if (progressPlan.stages.length > 0) {
        progressPlan.stages[0].status = 'in_progress';
        progressPlan.stages[0].startedAt = new Date().toISOString();
      }

      this.logger.log(`Created new progress plan with ${progressPlan.stages.length} stages`);
      return progressPlan;
    } catch (error) {
      this.logger.error(`Error creating new progress plan: ${error.message}`);
      throw new Error(`Failed to create progress plan: ${error.message}`);
    }
  }

  /**
   * Sync current stage status and update progress
   */
  private async syncCurrentStageStatus(): Promise<void> {
    if (!this.progressPlan) {
      throw new Error('Progress plan not available for status synchronization');
    }

    try {
      const currentEpoch = this.session.currentEpoch ?? 0;
      const currentStage = this.progressPlan.stages[currentEpoch];

      if (!currentStage) {
        this.logger.warn(`No stage found for epoch ${currentEpoch}`);
        return;
      }

      this.logger.log(`Syncing status for stage: "${currentStage.name}"`);

      // Get subtask execution statuses
      const subtaskStatuses = await this.getSubtaskExecutionStatuses(currentStage);

      // Update stage with current subtask statuses
      await this.updateStageWithSubtaskStatuses(currentStage, subtaskStatuses);

      // Calculate and update stage progress
      await this.updateStageProgress(currentStage);

      // Calculate overall progress
      this.calculateOverallProgress();

      this.logger.log(`Stage status synchronization completed for "${currentStage.name}"`);
    } catch (error) {
      this.logger.error(`Error syncing current stage status: ${error.message}`);
      throw new Error(`Failed to sync stage status: ${error.message}`);
    }
  }

  /**
   * Get subtask execution statuses for a stage
   */
  private async getSubtaskExecutionStatuses(
    stage: ProgressStage,
  ): Promise<SubtaskExecutionStatus[]> {
    try {
      const stageSteps = this.steps.filter(
        (step) => step.epoch === this.session.currentEpoch && step.mode === 'subtask',
      );

      const subtaskStatuses: SubtaskExecutionStatus[] = [];

      for (const step of stageSteps) {
        const actionResult = this.actionResults.find((result) => result.resultId === step.entityId);

        if (actionResult) {
          const status: SubtaskExecutionStatus = {
            stepId: step.stepId,
            name: step.name,
            status: this.mapStepStatusToSubtaskStatus(step.status),
            resultId: step.entityId,
            output: actionResult.output || undefined,
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
            status.stepId === existingSubtask.id || status.resultId === existingSubtask.resultId,
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
      const existingSubtaskIds = new Set(updatedSubtasks.map((st) => st.id));
      const newSubtasks: ProgressSubtask[] = subtaskStatuses
        .filter((status) => !existingSubtaskIds.has(status.stepId))
        .map((status) => ({
          id: status.stepId,
          name: status.name,
          query: '', // Will be filled when generating new tasks
          status: status.status,
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
   * Update stage progress based on subtask completion
   */
  private async updateStageProgress(stage: ProgressStage): Promise<void> {
    try {
      if (stage.subtasks.length === 0) {
        stage.stageProgress = 0;
        return;
      }

      const completedSubtasks = stage.subtasks.filter((st) => st.status === 'completed');
      const failedSubtasks = stage.subtasks.filter((st) => st.status === 'failed');
      const totalSubtasks = stage.subtasks.length;

      // Calculate progress percentage
      const completedCount = completedSubtasks.length + failedSubtasks.length;
      stage.stageProgress = Math.round((completedCount / totalSubtasks) * 100);

      // Update stage status based on progress
      if (stage.stageProgress === 100) {
        stage.status = 'completed';
        stage.completedAt = new Date().toISOString();
      } else if (stage.stageProgress > 0) {
        stage.status = 'in_progress';
        if (!stage.startedAt) {
          stage.startedAt = new Date().toISOString();
        }
      }

      this.logger.log(`Stage "${stage.name}" progress updated: ${stage.stageProgress}%`);
    } catch (error) {
      this.logger.error(`Error updating stage progress: ${error.message}`);
      throw new Error(`Failed to update stage progress: ${error.message}`);
    }
  }

  /**
   * Calculate overall progress across all stages
   */
  private calculateOverallProgress(): void {
    if (!this.progressPlan) {
      return;
    }

    try {
      const totalStages = this.progressPlan.stages.length;
      if (totalStages === 0) {
        this.progressPlan.overallProgress = 0;
        return;
      }

      const completedStages = this.progressPlan.stages.filter(
        (stage) => stage.status === 'completed',
      );
      const inProgressStages = this.progressPlan.stages.filter(
        (stage) => stage.status === 'in_progress',
      );

      let totalProgress = 0;

      // Add progress from completed stages (100%)
      totalProgress += completedStages.length * 100;

      // Add progress from in-progress stages
      for (const stage of inProgressStages) {
        totalProgress += stage.stageProgress || 0;
      }

      // Calculate average progress
      this.progressPlan.overallProgress = Math.round(totalProgress / totalStages);

      this.logger.log(`Overall progress calculated: ${this.progressPlan.overallProgress}%`);
    } catch (error) {
      this.logger.error(`Error calculating overall progress: ${error.message}`);
      // Don't throw error for progress calculation, just log it
    }
  }

  /**
   * Generate tasks based on current execution status
   */
  private async generateTasksBasedOnStatus(
    maxStepsPerEpoch: number,
  ): Promise<PilotStepRawOutput[]> {
    if (!this.progressPlan) {
      throw new Error('Progress plan not available for task generation');
    }

    try {
      const currentEpoch = this.session.currentEpoch ?? 0;
      const currentStage = this.progressPlan.stages[currentEpoch];

      if (!currentStage) {
        this.logger.warn(`No stage found for epoch ${currentEpoch}`);
        return [];
      }

      this.logger.log(`Generating tasks for stage: "${currentStage.name}"`);

      // Check if we need to generate new subtasks
      const pendingSubtasks = currentStage.subtasks.filter((st) => st.status === 'pending');
      const executingSubtasks = currentStage.subtasks.filter((st) => st.status === 'executing');

      // If we have enough pending or executing subtasks, return them
      if (pendingSubtasks.length + executingSubtasks.length >= maxStepsPerEpoch) {
        this.logger.log('Sufficient subtasks available, no need to generate new ones');
        return this.convertSubtasksToPilotSteps(pendingSubtasks.slice(0, maxStepsPerEpoch));
      }

      // Generate new subtasks based on current stage
      const newSubtasks = await this.generateStageSubtasks(currentStage, maxStepsPerEpoch);

      // Add new subtasks to the stage
      currentStage.subtasks.push(...newSubtasks);

      this.logger.log(
        `Generated ${newSubtasks.length} new subtasks for stage "${currentStage.name}"`,
      );
      return this.convertSubtasksToPilotSteps(newSubtasks);
    } catch (error) {
      this.logger.error(`Error generating tasks based on status: ${error.message}`);
      throw new Error(`Failed to generate tasks: ${error.message}`);
    }
  }

  /**
   * Generate subtasks for a specific stage
   */
  private async generateStageSubtasks(
    stage: ProgressStage,
    maxStepsPerEpoch: number,
  ): Promise<ProgressSubtask[]> {
    try {
      // Use the stage's tool categories to filter available toolsets
      const relevantToolsets = this.availableTools.filter((toolset) =>
        stage.toolCategories.some(
          (category) =>
            toolset.name?.toLowerCase().includes(category.toLowerCase()) ||
            toolset.toolset?.definition?.tools?.some((tool) =>
              tool.name?.toLowerCase().includes(category.toLowerCase()),
            ),
        ),
      );

      // Generate prompt for stage-specific subtask generation
      const prompt = this.buildStageSubtaskPrompt(stage, relevantToolsets, maxStepsPerEpoch);

      // Try structured output first
      try {
        const structuredModel = this.model.withStructuredOutput(multiStepSchema);
        const { steps } = await structuredModel.invoke(prompt);

        // Convert PilotStepRawOutput to ProgressSubtask
        const subtasks: ProgressSubtask[] = steps.slice(0, maxStepsPerEpoch).map((step, index) => ({
          id: `subtask_${Date.now()}_${index}`,
          name: step.name,
          query: step.query,
          status: 'pending',
          createdAt: new Date().toISOString(),
        }));

        return subtasks;
      } catch (error) {
        this.logger.warn('Structured output failed, using fallback approach:', error);

        // Fallback: manual JSON parsing
        const response = await this.model.invoke(prompt);
        const responseText = response.content.toString();
        const extraction = extractJsonFromMarkdown(responseText);

        if (extraction.error) {
          throw new Error(`JSON extraction failed: ${extraction.error.message}`);
        }

        const { steps } = await multiStepSchema.parseAsync(extraction.result);

        // Convert PilotStepRawOutput to ProgressSubtask
        const subtasks: ProgressSubtask[] = steps.slice(0, maxStepsPerEpoch).map((step, index) => ({
          id: `subtask_${Date.now()}_${index}`,
          name: step.name,
          query: step.query,
          status: 'pending',
          createdAt: new Date().toISOString(),
        }));

        return subtasks;
      }
    } catch (error) {
      this.logger.error(`Error generating stage subtasks: ${error.message}`);
      throw new Error(`Failed to generate stage subtasks: ${error.message}`);
    }
  }

  /**
   * Convert ProgressSubtask to PilotStepRawOutput
   */
  private convertSubtasksToPilotSteps(subtasks: ProgressSubtask[]): PilotStepRawOutput[] {
    return subtasks.map((subtask) => ({
      name: subtask.name,
      priority: 3,
      query: subtask.query,
      contextItemIds: [],
      workflowStage: 'research',
    }));
  }

  /**
   * Update and persist progress plan
   */
  private async updateAndPersistProgress(_newTasks: PilotStepRawOutput[]): Promise<void> {
    if (!this.progressPlan) {
      throw new Error('Progress plan not available for persistence');
    }

    try {
      // Update last updated timestamp
      this.progressPlan.lastUpdated = new Date().toISOString();

      // Log progress update
      this.logger.log(
        `Progress plan updated. Overall progress: ${this.progressPlan.overallProgress}%`,
      );
      this.logger.log(
        `Current stage: ${this.progressPlan.stages[this.session.currentEpoch ?? 0]?.name || 'Unknown'}`,
      );

      // Note: Actual persistence to database should be handled by the calling service
      // This method prepares the progress plan for persistence
    } catch (error) {
      this.logger.error(`Error updating and persisting progress: ${error.message}`);
      throw new Error(`Failed to update and persist progress: ${error.message}`);
    }
  }

  /**
   * Get current progress plan (for external access)
   */
  getCurrentProgressPlan(): ProgressPlan | null {
    return this.progressPlan;
  }

  /**
   * Build prompt for stage-specific subtask generation
   */
  private buildStageSubtaskPrompt(
    stage: ProgressStage,
    toolsets: GenericToolset[],
    maxStepsPerEpoch: number,
  ): string {
    const toolInfo = toolsets
      .map(
        (toolset) =>
          `${toolset.name}: ${toolset.toolset?.definition?.descriptionDict?.en || 'No description available'}`,
      )
      .join('\n');

    const contentInfo =
      this.canvasContent.length > 0
        ? `Available canvas content: ${this.canvasContent.length} items`
        : 'No existing canvas content';

    return `# ROLE: Parallel Task Executor
You are a **Parallel Task Executor** responsible for breaking down a single stage into multiple independent subtasks that can be executed simultaneously. All subtasks must be completely independent and can start at the same time.

## CORE PRINCIPLES
- **Parallel Execution**: All subtasks must be able to run simultaneously
- **Independence**: No subtask should depend on another subtask's completion
- **Simultaneous Start**: All subtasks can begin at the same time
- **No Dependencies**: Subtasks cannot wait for each other

## CURRENT STAGE
**Stage Name**: ${stage.name}
**Description**: ${stage.description}
**Main Objectives**: ${stage.objectives.join(', ')}

## AVAILABLE TOOLS
${toolInfo}

## CANVAS CONTENT
${contentInfo}

## TASK ANALYSIS
Break down the stage objectives into ${maxStepsPerEpoch} **parallel subtasks** that can be executed simultaneously to achieve the stage goals.

## PARALLEL SUBTASK DESIGN PRINCIPLES
1. **Complete Independence**: Each subtask must be completely independent
2. **Simultaneous Execution**: All subtasks can start at the same time
3. **Goal-Oriented**: Each subtask should directly contribute to a specific objective
4. **Complementary**: Subtasks should work together to complete the full objective
5. **Tool Agnostic**: Focus on what needs to be done, not which tool to use
6. **Measurable**: Each subtask should have clear success criteria

## EXAMPLES OF GOOD PARALLEL SUBTASK SPLITTING

### Example 1: Data Collection Stage
**Stage Objective**: "Extract top 8 products from Product Hunt"
**Parallel Subtasks** (All can start simultaneously):
- Extract product #1 data (rank, name, URL, description)
- Extract product #2 data (rank, name, URL, description)
- Extract product #3 data (rank, name, URL, description)
- Extract product #4 data (rank, name, URL, description)
- Extract product #5 data (rank, name, URL, description)
- Extract product #6 data (rank, name, URL, description)
- Extract product #7 data (rank, name, URL, description)
- Extract product #8 data (rank, name, URL, description)

### Example 2: Content Generation Stage
**Stage Objective**: "Generate articles, web pages, and podcasts"
**Parallel Subtasks** (All can start simultaneously):
- Generate article content for product #1
- Generate article content for product #2
- Generate web page layout and structure
- Generate podcast script outline

### Example 3: Analysis Stage
**Stage Objective**: "Analyze market trends and competitor data"
**Parallel Subtasks** (All can start simultaneously):
- Analyze market size and growth trends
- Analyze competitor pricing strategies
- Analyze customer satisfaction metrics
- Analyze technology adoption patterns

## WHAT TO AVOID
❌ **DO NOT** create subtasks like:
- "First collect data, then analyze it" (Serial dependency - these should be separate stages)
- "Use web scraping tool to get data" (Tool-focused, not goal-focused)
- "Extract product information" (Too vague and not specific)
- "Process all products together" (Not parallelizable)
- "Wait for data collection to complete" (Serial dependency)
- "Analyze data after collection" (Serial dependency)

✅ **DO** create subtasks like:
- "Extract product #1 data" (Specific, independent, parallel)
- "Analyze competitor A pricing" (Independent, measurable, parallel)
- "Generate content for topic X" (Clear objective, independent, parallel)
- "Research market trend Y" (Independent, parallel)

## INDEPENDENCE VERIFICATION
For each subtask, verify:
- Can this subtask start immediately without waiting for other subtasks?
- Does this subtask have all the information it needs to begin?
- Is this subtask completely independent of other subtasks?
- Can this subtask run simultaneously with all other subtasks?

## OUTPUT FORMAT
Generate a JSON array of subtasks following the exact schema:
\`\`\`json
[
  {
    "name": "Clear, specific task name",
    "query": "Detailed description of what this subtask accomplishes",
    "contextItemIds": ["relevant-context-ids"],
    "workflowStage": "${stage.name.toLowerCase()}"
  }
]
\`\`\`

## CRITICAL REQUIREMENTS
- **MUST** create exactly ${maxStepsPerEpoch} subtasks
- **MUST** ensure all subtasks can run in parallel
- **MUST** focus on objectives, not tools
- **MUST** make each task specific and actionable
- **MUST** avoid any serial dependencies between subtasks
- **MUST** ensure subtasks are complementary, not overlapping
- **MUST** ensure each subtask is completely independent

## PARALLEL EXECUTION VALIDATION
Before submitting, verify:
□ Each subtask can start immediately without waiting
□ No subtask depends on another subtask's completion
□ All subtasks can run simultaneously
□ Each subtask has a clear, specific objective
□ Tasks work together to achieve the full stage goal
□ Each task is measurable and actionable
□ No subtask mentions "waiting for" or "after" other subtasks

## INDEPENDENCE CHECKLIST
For each subtask, confirm:
- ✅ Can start immediately
- ✅ Has all required information
- ✅ No dependencies on other subtasks
- ✅ Can run simultaneously with others
- ✅ Contributes to stage objectives

${this.locale ? `\n## LANGUAGE REQUIREMENT\nAll output should be in ${this.locale} language.` : ''}`;
  }

  // Legacy methods for backward compatibility
  async runLegacy(
    contentItems: CanvasContentItem[],
    toolsets: GenericToolset[],
    maxStepsPerEpoch = MAX_STEPS_PER_EPOCH,
    locale?: string,
  ): Promise<PilotStepRawOutput[]> {
    const sessionInput = JSON.parse(this.session.input);
    const userQuestion = sessionInput?.query;

    try {
      if (!userQuestion) {
        this.logger.warn('No user question provided for research planning');
        return [];
      }

      // Get the current epoch information
      const currentEpoch = this.session?.currentEpoch ?? 0;
      const totalEpochs = this.session?.maxEpoch ?? MAX_EPOCH;
      const recommendedStage = getRecommendedStageForEpoch(currentEpoch, totalEpochs);

      if (currentEpoch > totalEpochs) {
        this.logger.warn('Current epoch exceeds total epochs');
        return [];
      }

      this.logger.log(
        `Planning research steps for "${userQuestion}" with ${contentItems.length} content items. ` +
          `Current epoch: ${currentEpoch + 1}/${totalEpochs + 1}, recommended stage: ${recommendedStage}`,
      );

      // First attempt: Use LLM structured output capability
      try {
        const structuredLLM = this.model.withStructuredOutput(multiStepSchema);

        // Generate the full prompt with optimized guidelines
        const fullPrompt = generatePlanningPrompt({
          userQuestion,
          session: this.session as any, // Legacy compatibility
          steps: this.steps as any, // Legacy compatibility
          availableToolsets: toolsets,
          contentItems,
          maxStepsPerEpoch,
          locale,
        });

        const { steps } = await structuredLLM.invoke(fullPrompt);

        this.logger.log(`Generated research plan: ${JSON.stringify(steps)}`);

        if (recommendedStage === 'creation') {
          const creationSteps = steps.slice(0, 1) || [];
          return creationSteps?.length > 0 ? creationSteps : steps?.length > 0 ? [steps?.[0]] : [];
        } else {
          return steps;
        }
      } catch (structuredError) {
        this.logger.warn(
          `Structured output failed: ${structuredError.message}, trying fallback approach`,
        );
        // Continue to fallback
      }

      // Second attempt: Manual JSON parsing approach
      const fallbackPrompt = generateFallbackPrompt({
        userQuestion,
        session: this.session as any, // Legacy compatibility
        steps: this.steps as any, // Legacy compatibility
        contentItems,
        availableToolsets: toolsets,
        maxStepsPerEpoch,
        locale,
      });

      const response = await this.model.invoke(fallbackPrompt);
      const responseText = response.content.toString();

      // Extract and parse JSON
      const extraction = extractJsonFromMarkdown(responseText);

      if (extraction.error) {
        throw new Error(
          `JSON extraction failed: ${extraction.error.message}, using final fallback`,
        );
      }

      const { steps } = await multiStepSchema.parseAsync(extraction.result);

      this.logger.log(`Successfully generated research plan with ${steps?.length} steps`);
      return steps;
    } catch (error) {
      this.logger.error(`Error generating research plan: ${error.message}`);
      return [];
    }
  }
}

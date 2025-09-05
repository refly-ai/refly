import { Injectable, Logger } from '@nestjs/common';
import { BaseChatModel } from '@refly/providers';
import { extractJsonFromMarkdown } from '@refly/utils';
import {
  ProgressPlan,
  ProgressStage,
  ProgressPlanWithSubtasks,
  ProgressSubtask,
} from './pilot.types';
import { CanvasContentItem } from '../canvas/canvas.dto';
import { GenericToolset } from '@refly/openapi-schema';
import { genPilotStepID } from '@refly/utils';

@Injectable()
export class IntentAnalysisService {
  private logger = new Logger(IntentAnalysisService.name);

  /**
   * Analyze user intent and generate dynamic stage planning with subtasks
   * This method handles both initial planning and dynamic re-planning with context
   */
  async analyzeIntentAndPlanWithSubtasks(
    model: BaseChatModel,
    userQuestion: string,
    progressPlan: ProgressPlan | null,
    availableTools: GenericToolset[],
    canvasContent: CanvasContentItem[],
    locale?: string,
  ): Promise<ProgressPlanWithSubtasks> {
    try {
      const isInitialPlan = progressPlan === null;
      this.logger.log(
        `Starting ${isInitialPlan ? 'initial' : 'dynamic'} intent analysis for: "${userQuestion}"`,
      );

      // Generate comprehensive plan with subtasks
      const planWithSubtasks = await this.generateComprehensivePlan(
        model,
        userQuestion,
        progressPlan,
        availableTools,
        canvasContent,
        locale,
      );

      this.logger.log(
        `Comprehensive planning completed. Generated ${planWithSubtasks.stages.length} stages with ${planWithSubtasks.currentStageSubtasks.length} current stage subtasks`,
      );

      return planWithSubtasks;
    } catch (error) {
      this.logger.error('Comprehensive planning failed:', error);
      // Return a default plan as fallback
      return this.generateDefaultPlanWithSubtasks(userQuestion);
    }
  }

  /**
   * Generate comprehensive plan with stages and subtasks
   */
  private async generateComprehensivePlan(
    model: BaseChatModel,
    userQuestion: string,
    progressPlan: ProgressPlan | null,
    availableTools: GenericToolset[],
    canvasContent: CanvasContentItem[],
    locale?: string,
  ): Promise<ProgressPlanWithSubtasks> {
    const isInitialPlan = progressPlan === null;

    // Build comprehensive prompt
    const prompt = this.buildComprehensivePlanningPrompt(
      userQuestion,
      progressPlan,
      availableTools,
      canvasContent,
      locale,
    );

    try {
      // Try structured output first
      const structuredModel = model.withStructuredOutput({
        type: 'object',
        properties: {
          userIntent: { type: 'string' },
          taskComplexity: { type: 'string', enum: ['simple', 'medium', 'complex'] },
          stages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                objectives: { type: 'array', items: { type: 'string' } },
                toolCategories: { type: 'array', items: { type: 'string' } },
                priority: { type: 'number' },
                estimatedEpochs: { type: 'number' },
                status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
              },
              required: [
                'name',
                'description',
                'objectives',
                'toolCategories',
                'priority',
                'estimatedEpochs',
                'status',
              ],
            },
          },
          currentStageSubtasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                objective: { type: 'string' },
                expectedOutcome: { type: 'string' },
                context: { type: 'string' },
                scope: { type: 'string' },
                outputRequirements: { type: 'string' },
                status: { type: 'string', enum: ['pending', 'executing', 'completed', 'failed'] },
              },
              required: [
                'name',
                'objective',
                'expectedOutcome',
                'context',
                'scope',
                'outputRequirements',
                'status',
              ],
            },
          },
          planningLogic: { type: 'string' },
          estimatedTotalEpochs: { type: 'number' },
          previousExecutionSummary: { type: 'string' },
        },
        required: [
          'userIntent',
          'taskComplexity',
          'stages',
          'currentStageSubtasks',
          'planningLogic',
          'estimatedTotalEpochs',
        ],
      });

      const result = await structuredModel.invoke(prompt);

      // Convert to ProgressPlanWithSubtasks
      const stages: ProgressStage[] = result.stages.map((stageInfo: any, _index: number) => {
        const stageId = genPilotStepID();
        return {
          id: stageId,
          name: stageInfo.name,
          description: stageInfo.description,
          objectives: stageInfo.objectives,
          status: stageInfo.status,
          createdAt: new Date().toISOString(),
          startedAt: stageInfo.status === 'in_progress' ? new Date().toISOString() : undefined,
          subtasks: [], // Will be populated separately
          toolCategories: stageInfo.toolCategories,
          priority: stageInfo.priority,
        };
      });

      const currentStageSubtasks: ProgressSubtask[] = result.currentStageSubtasks.map(
        (subtaskInfo: any, index: number) => ({
          id: `subtask_${Date.now()}_${index}`,
          name: subtaskInfo.name,
          query: subtaskInfo.objective, // Use objective as query for backward compatibility
          status: subtaskInfo.status,
          createdAt: new Date().toISOString(),
          // Store additional context information for better execution
          context: subtaskInfo.context || '',
          scope: subtaskInfo.scope || '',
          outputRequirements: subtaskInfo.outputRequirements || '',
        }),
      );

      // Find current stage index
      const currentStageIndex = stages.findIndex((stage) => stage.status === 'in_progress');

      return {
        stages,
        currentStageIndex: currentStageIndex >= 0 ? currentStageIndex : 0,
        overallProgress: progressPlan?.overallProgress || 0,
        lastUpdated: new Date().toISOString(),
        planningLogic: result.planningLogic,
        userIntent: result.userIntent,
        estimatedTotalEpochs: result.estimatedTotalEpochs,
        currentStageSubtasks,
        planningContext: {
          isInitialPlan,
          previousExecutionSummary: result.previousExecutionSummary,
          userIntent: result.userIntent,
          currentStageIndex: currentStageIndex >= 0 ? currentStageIndex : 0,
        },
      };
    } catch (error) {
      this.logger.warn('Structured output failed, using fallback approach:', error);

      // Fallback: manual JSON parsing
      const response = await model.invoke(prompt);
      const responseText = response.content.toString();
      const extraction = extractJsonFromMarkdown(responseText);

      if (extraction.error) {
        throw new Error(`JSON extraction failed: ${extraction.error.message}`);
      }

      // Process the extracted result similar to structured output
      const result = extraction.result;

      // Validate the extracted result
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid JSON structure in fallback response');
      }

      // Convert to ProgressPlanWithSubtasks (similar to structured output logic)
      const stages: ProgressStage[] = (result.stages || []).map(
        (stageInfo: any, _index: number) => {
          const stageId = genPilotStepID();
          return {
            id: stageId,
            name: stageInfo.name || 'Unnamed Stage',
            description: stageInfo.description || 'No description',
            objectives: stageInfo.objectives || ['Complete task'],
            status: stageInfo.status || 'pending',
            createdAt: new Date().toISOString(),
            startedAt: stageInfo.status === 'in_progress' ? new Date().toISOString() : undefined,
            subtasks: [],
            toolCategories: stageInfo.toolCategories || ['general'],
            priority: stageInfo.priority || 1,
          };
        },
      );

      const currentStageSubtasks: ProgressSubtask[] = (result.currentStageSubtasks || []).map(
        (subtaskInfo: any, index: number) => ({
          id: `subtask_${Date.now()}_${index}`,
          name: subtaskInfo.name || 'Unnamed Subtask',
          query: subtaskInfo.objective || subtaskInfo.query || userQuestion, // Support both new and old format
          status: subtaskInfo.status || 'pending',
          createdAt: new Date().toISOString(),
          // Store additional context information for better execution
          context: subtaskInfo.context || '',
          scope: subtaskInfo.scope || '',
          outputRequirements: subtaskInfo.outputRequirements || '',
        }),
      );

      // Find current stage index
      const currentStageIndex = stages.findIndex((stage) => stage.status === 'in_progress');

      return {
        stages:
          stages.length > 0
            ? stages
            : [
                {
                  id: genPilotStepID(),
                  name: 'General Task Execution',
                  description: 'Default stage for task execution',
                  objectives: ['Complete the requested task'],
                  status: 'in_progress',
                  createdAt: new Date().toISOString(),
                  startedAt: new Date().toISOString(),
                  subtasks: [],
                  toolCategories: ['web_search', 'analysis', 'generation'],
                  priority: 1,
                },
              ],
        currentStageIndex: currentStageIndex >= 0 ? currentStageIndex : 0,
        overallProgress: progressPlan?.overallProgress || 0,
        lastUpdated: new Date().toISOString(),
        planningLogic: result.planningLogic || 'Fallback planning with manual JSON parsing',
        userIntent: result.userIntent || userQuestion,
        estimatedTotalEpochs: result.estimatedTotalEpochs || 2,
        currentStageSubtasks:
          currentStageSubtasks.length > 0
            ? currentStageSubtasks
            : [
                {
                  id: `subtask_${Date.now()}_0`,
                  name: 'Execute General Task',
                  query: userQuestion,
                  status: 'pending',
                  createdAt: new Date().toISOString(),
                },
              ],
        planningContext: {
          isInitialPlan,
          previousExecutionSummary:
            result.previousExecutionSummary || 'No previous execution summary',
          userIntent: result.userIntent || userQuestion,
          currentStageIndex: currentStageIndex >= 0 ? currentStageIndex : 0,
        },
      };
    }
  }

  /**
   * Generate default plan with subtasks as fallback
   */
  private generateDefaultPlanWithSubtasks(userQuestion: string): ProgressPlanWithSubtasks {
    const defaultStage: ProgressStage = {
      id: genPilotStepID(),
      name: 'General Task Execution',
      description: 'Default stage for task execution',
      objectives: ['Complete the requested task'],
      status: 'in_progress',
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      subtasks: [],
      toolCategories: ['web_search', 'analysis', 'generation'],
      priority: 1,
    };

    const defaultSubtasks: ProgressSubtask[] = [
      {
        id: `subtask_${Date.now()}_0`,
        name: 'Execute General Task',
        query: userQuestion,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    ];

    return {
      stages: [defaultStage],
      currentStageIndex: 0,
      overallProgress: 0,
      lastUpdated: new Date().toISOString(),
      planningLogic: 'Default plan with subtasks generated due to analysis failure',
      userIntent: userQuestion,
      estimatedTotalEpochs: 2,
      currentStageSubtasks: defaultSubtasks,
      planningContext: {
        isInitialPlan: true,
        userIntent: userQuestion,
        currentStageIndex: 0,
      },
    };
  }

  /**
   * Build comprehensive planning prompt for both initial and dynamic planning
   */
  private buildComprehensivePlanningPrompt(
    userQuestion: string,
    progressPlan: ProgressPlan | null,
    availableTools: GenericToolset[],
    canvasContent: CanvasContentItem[],
    locale?: string,
  ): string {
    const isInitialPlan = progressPlan === null;
    const toolInfo = availableTools
      .map(
        (toolset) =>
          `${toolset.name}: ${toolset.toolset?.definition?.descriptionDict?.en || 'No description available'}`,
      )
      .join('\n');

    const contentInfo =
      canvasContent.length > 0
        ? `Available canvas content: ${canvasContent.length} items`
        : 'No existing canvas content';

    let progressContext = '';
    if (!isInitialPlan && progressPlan) {
      const completedStages = progressPlan.stages.filter((stage) => stage.status === 'completed');
      const currentStage = progressPlan.stages.find((stage) => stage.status === 'in_progress');
      const pendingStages = progressPlan.stages.filter((stage) => stage.status === 'pending');

      progressContext = `
## CURRENT PROGRESS CONTEXT
**Overall Progress**: ${progressPlan.overallProgress}%
**Completed Stages**: ${completedStages.length}/${progressPlan.stages.length}
**Current Stage**: ${currentStage?.name || 'None'}
**Pending Stages**: ${pendingStages.map((s) => s.name).join(', ')}

### Completed Stages with Execution Results:
${completedStages
  .map((stage) => {
    const summary = stage.summary || 'No execution summary available';
    const processedSummary = this.processStageSummary(summary);
    return `
- **${stage.name}**: ${stage.description}
  - **Objectives**: ${stage.objectives.join(', ')}
  - **Progress**: ${stage.stageProgress || 0}%
  - **Tool Categories**: ${stage.toolCategories.join(', ')}
  - **Execution Summary**: ${processedSummary}
  - **Completion Status**: ${stage.status}
  - **Completed At**: ${stage.completedAt || 'Not specified'}`;
  })
  .join('\n')}

### Current Stage Details:
${
  currentStage
    ? `
- **Name**: ${currentStage.name}
- **Description**: ${currentStage.description}
- **Objectives**: ${currentStage.objectives.join(', ')}
- **Progress**: ${currentStage.stageProgress || 0}%
- **Tool Categories**: ${currentStage.toolCategories.join(', ')}
- **Status**: ${currentStage.status}
- **Started At**: ${currentStage.startedAt || 'Not started'}
- **Current Summary**: ${currentStage.summary ? this.processStageSummary(currentStage.summary) : 'No summary available yet'}`
    : 'No current stage'
}

### Pending Stages:
${pendingStages
  .map(
    (stage) => `
- **Name**: ${stage.name}
- **Description**: ${stage.description}
- **Objectives**: ${stage.objectives.join(', ')}
- **Tool Categories**: ${stage.toolCategories.join(', ')}
- **Priority**: ${stage.priority}
- **Status**: ${stage.status}`,
  )
  .join('\n')}

### Execution Quality Assessment:
${
  completedStages.length > 0
    ? `Based on the execution summaries above, assess the quality and completeness of completed stages to inform better planning for remaining stages.

**Note**: Execution summaries have been processed to extract key information including:
- Progress status (epochs completed, completion percentage)
- Completed subtasks and their outcomes
- Current stage status and objectives
- Target question and scope
- Language requirements
- Completeness and evidence quality assessments

Use this structured information to make informed decisions about future stage planning and subtask generation.`
    : 'No completed stages to assess yet.'
}
`;
    }

    return `# ROLE: Comprehensive Task Planner
You are a **Comprehensive Task Planner** responsible for creating both sequential stage planning and parallel subtask generation in a single response. You handle both initial planning and dynamic re-planning with full context awareness.

## PLANNING MODE
**Mode**: ${isInitialPlan ? 'INITIAL PLANNING' : 'DYNAMIC RE-PLANNING'}
${isInitialPlan ? 'Creating a new execution plan from scratch.' : 'Re-planning based on current progress and execution history.'}

## USER REQUEST
"${userQuestion}"

## AVAILABLE TOOLS
${toolInfo}

### Built-in Tools:
- **library_search**: Search knowledge libraries
- **web_search**: Search the web for current information
- **generate_media**: Generate images, videos, or other media content
- **generate_doc**: Generate documents, reports, or written content
- **generate_code_artifact**: Generate code, scripts, or technical artifacts
- **send_email**: Send emails or notifications
- **get_time**: Get current time, date, or timezone information

**IMPORTANT**: Subtask objectives should focus on goals and expected outcomes, allowing the executing agent to choose the most appropriate tool combination.

## CANVAS CONTENT
${contentInfo}
${progressContext}

## EXECUTION RESULT ANALYSIS (For Dynamic Re-planning)
${
  !isInitialPlan
    ? `
When analyzing execution results, pay special attention to:

### Quality Assessment Criteria:
- **Completeness**: Were all stage objectives fully achieved?
- **Accuracy**: Were the results accurate and reliable?
- **Efficiency**: Was the execution efficient and well-organized?
- **Quality**: Was the output quality satisfactory?
- **Gaps**: What was missing or could be improved?

### Learning Integration:
- **Success Patterns**: What worked well and should be replicated?
- **Failure Points**: What didn't work and needs adjustment?
- **Resource Optimization**: How can tools and approaches be better utilized?
- **Timeline Adjustments**: Were time estimates realistic?
- **Dependency Refinement**: Do stage dependencies need adjustment?

### Context for Future Planning:
- **Data Quality**: What data was collected and its reliability?
- **Tool Effectiveness**: Which tools were most/least effective?
- **Approach Validation**: Which approaches proved successful?
- **Scope Refinement**: Does the remaining scope need adjustment?
`
    : ''
}

## PLANNING REQUIREMENTS

### Stage Planning:
- **Sequential Execution**: Stages must be executed in order, one after another
- **Dependency-Based**: Each stage must wait for the previous stage to complete
- **Logical Progression**: Stages should build upon each other logically
- **Natural Dependencies**: Each stage must naturally depend on the previous stage's outcomes

### Subtask Generation:
- **Dependency Analysis First**: Before generating subtasks, analyze all task dependencies
- **Sequential Task Identification**: Identify tasks that must be executed in sequence (e.g., "organize content then send email")
- **Parallel Task Identification**: Identify tasks that can be executed simultaneously (e.g., "search for information A and information B")
- **Stage Promotion**: If subtasks have sequential dependencies, promote them to separate stages
- **Goal-Oriented**: Each subtask should directly contribute to stage objectives
- **Essential Only**: Generate only necessary subtasks - avoid redundant or overlapping ones
- **Current Stage Focus**: Generate subtasks for the current active stage
- **Context Preservation**: Include specific data, findings, and insights from previous stages in subtask context
- **Output Specification**: Clearly define expected output format, quality criteria, and specific requirements

## SUBTASK DESIGN GUIDELINES

### Subtask Design Requirements:
- **Objective-Focused**: Describe what needs to be accomplished, not which tool to use
- **Clear Outcome**: Specify the expected deliverable or result
- **Flexible Tool Selection**: Let the executing agent determine the best tool combination
- **Goal-Oriented**: Focus on achieving specific objectives rather than using specific tools
- **Context-Rich**: Include sufficient context from previous stages to avoid information loss
- **Specific Output Requirements**: Clearly specify the format, scope, and quality of expected outputs

### Context Preservation Requirements:
- **MUST** include relevant data, findings, or insights from previous stages
- **MUST** specify the scope and boundaries of the current subtask
- **MUST** reference specific information that needs to be built upon
- **MUST** include quality criteria and output format requirements
- **MUST** provide enough context for independent execution without information gaps

### Examples of Good vs Bad Subtask Objectives:

#### Good Examples (Context-Rich):
- **Good**: "Analyze the renewable energy statistics collected in Stage 1, focusing on 2024 adoption trends in Europe and North America, and create a comparative analysis report with specific metrics including growth rates, market share, and policy impacts"
- **Good**: "Based on the market analysis data from Stage 2, generate a comprehensive presentation deck with 15-20 slides covering key findings, market opportunities, and strategic recommendations for renewable energy investment"

#### Bad Examples (Context-Poor):
- **Bad**: "Find current statistics and trends about renewable energy adoption in 2024"
- **Bad**: "Create a comprehensive market analysis report about the renewable energy sector"
- **Bad**: "Use web_search to find the latest statistics about renewable energy adoption in 2024"


## DEPENDENCY ANALYSIS

### Dependency Types:
- **Data Dependency**: Tasks requiring output from previous tasks
- **Logical Dependency**: Tasks following natural sequence (e.g., "collect" → "analyze")
- **Time Dependency**: Tasks requiring specific chronological order

### Task Classification:
- **Sequential Tasks**: Must be separate stages (e.g., "collect data then analyze")
- **Parallel Tasks**: Can be subtasks in same stage (e.g., "search A and search B")

### Dependency Identification Methods:
- **Verb Analysis**: Look for sequential patterns in task verbs (e.g., "collect" → "analyze" → "generate")
- **Input-Output Check**: Verify if subsequent tasks depend on previous task outputs
- **Logical Flow Validation**: Ensure tasks follow natural execution order

### Validation Rules:
- No circular dependencies
- Clear prerequisites for each task
- Outputs available when needed

## STAGE DESIGN GUIDELINES

### Stage Design:
- **Progressive Completion**: Each stage builds toward the final objective
- **Logical Dependencies**: Stages follow natural completion order
- **Prerequisite Awareness**: Complete prerequisites before next stage

### Subtask Guidelines:
- **Essential Only**: Generate only necessary subtasks
- **Stage-Appropriate Count**: Simple stages (1-2), Complex stages (3-5 maximum)
- **Quality Over Quantity**: Prioritize effectiveness over quantity

## OUTPUT FORMAT
Provide a JSON response with the following structure:
\`\`\`json
{
  "userIntent": "Clear description of what the user wants to achieve",
  "taskComplexity": "simple|medium|complex",
  "stages": [
    {
      "name": "Stage name (e.g., 'Data Collection', 'Analysis', 'Synthesis')",
      "description": "What this stage accomplishes and why it's needed",
      "objectives": ["Specific objective 1", "Specific objective 2"],
      "status": "pending|in_progress|completed"
    }
  ],
  "currentStageSubtasks": [
    {
      "name": "Clear, specific task name",
      "objective": "What needs to be accomplished (focus on goals, not tools)",
      "expectedOutcome": "Expected deliverable or result",
      "context": "Relevant context from previous stages, including specific data, findings, or insights to build upon",
      "scope": "Specific scope and boundaries of this subtask",
      "outputRequirements": "Detailed output format, quality criteria, and specific requirements",
      "status": "pending"
    }
  ],
  "planningLogic": "Explanation of planning decisions and stage dependencies",
  "estimatedTotalEpochs": 3,
  "previousExecutionSummary": "${isInitialPlan ? 'Initial planning - no previous execution' : 'Summary of what has been accomplished so far'}"
}
\`\`\`

## CRITICAL REQUIREMENTS

### Core Planning Requirements:
- **MUST** create sequential stages that depend on each other
- **MUST** generate parallel subtasks for the current active stage
- **MUST** ensure subtasks can run simultaneously within a stage
- **MUST** focus on goals and expected outcomes rather than specific tool usage
- **MUST** allow executing agents to choose appropriate tool combinations
- **MUST** avoid generating overlapping or redundant subtasks
- **MUST** ensure each subtask is absolutely necessary for stage completion
- **MUST** follow objective logic for stage dependencies and progression
- **MUST** include rich context from previous stages in subtask descriptions
- **MUST** specify detailed output requirements and quality criteria for each subtask
- **MUST** ensure subtasks contain sufficient information for independent execution

## VALIDATION CHECKLIST
Before submitting, verify:

### Core Validation:
□ Stages are sequential and cannot run in parallel
□ Subtasks within current stage can run in parallel
□ Each subtask has unique, non-overlapping objectives
□ Each subtask is absolutely necessary for stage completion
□ No redundant or overlapping subtasks exist
□ Stage sequence follows objective logic of progressive completion
□ Subtask objectives focus on goals rather than specific tools
□ Each subtask includes rich context from previous stages
□ Each subtask specifies detailed output requirements and quality criteria
□ Each subtask contains sufficient information for independent execution


${locale ? `\n## LANGUAGE REQUIREMENT\nAll output should be in ${locale} language.` : ''}`;
  }

  /**
   * Process stage summary to extract key information for planning context
   * Handles both Chinese and English formats, extracts essential execution details
   */
  private processStageSummary(summary: string): string {
    if (!summary || summary.trim() === '') {
      return 'No execution summary available';
    }

    try {
      // Extract key information from structured summary
      const lines = summary
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      // Key patterns to extract (support both Chinese and English)
      const patterns = {
        // Progress information
        progress:
          /(?:进度|Progress)[：:]\s*第?\s*(\d+)\/(\d+)\s*周期?\s*\((\d+)%\s*(?:完成|complete)\)/i,
        progressEn:
          /(?:Progress|进度)[：:]\s*(\d+)\/(\d+)\s*(?:epochs?|周期?)\s*\((\d+)%\s*(?:complete|完成)\)/i,

        // Completed subtasks
        completedTasks: /(?:已完成子任务|Completed subtasks?)[：:]\s*(.+)/i,
        completedTasksEn: /(?:Completed subtasks?|已完成子任务)[：:]\s*(.+)/i,

        // Current stage
        currentStage: /(?:当前阶段|Current stage)[：:]\s*(.+)/i,
        currentStageEn: /(?:Current stage|当前阶段)[：:]\s*(.+)/i,

        // Target question
        targetQuestion: /(?:目标问题|Target question)[：:]\s*[""](.+)[""]/i,
        targetQuestionEn: /(?:Target question|目标问题)[：:]\s*[""](.+)[""]/i,

        // Language
        language: /(?:语言|Language)[：:]\s*([a-z-]+)/i,
        languageEn: /(?:Language|语言)[：:]\s*([a-z-]+)/i,

        // Completeness assessment
        completeness: /(?:完整性|Completeness)[：:]\s*(\d+)%\s*[-–]\s*(.+)/i,
        completenessEn: /(?:Completeness|完整性)[：:]\s*(\d+)%\s*[-–]\s*(.+)/i,

        // Evidence quality
        evidenceQuality:
          /(?:证据质量|Evidence quality)[：:]\s*(强|中|弱|Strong|Medium|Weak)\s*[-–]\s*(.+)/i,
        evidenceQualityEn:
          /(?:Evidence quality|证据质量)[：:]\s*(Strong|Medium|Weak|强|中|弱)\s*[-–]\s*(.+)/i,
      };

      const extractedInfo: string[] = [];

      // Extract progress information
      const progressMatch = summary.match(patterns.progress) || summary.match(patterns.progressEn);
      if (progressMatch) {
        extractedInfo.push(
          `Progress: ${progressMatch[1]}/${progressMatch[2]} epochs (${progressMatch[3]}% complete)`,
        );
      }

      // Extract completed tasks
      const completedTasksMatch =
        summary.match(patterns.completedTasks) || summary.match(patterns.completedTasksEn);
      if (completedTasksMatch) {
        const tasks = completedTasksMatch[1]
          .split(/[,，]/)
          .map((task) => task.trim())
          .slice(0, 3); // Limit to first 3 tasks
        extractedInfo.push(`Completed tasks: ${tasks.join(', ')}`);
      }

      // Extract current stage
      const currentStageMatch =
        summary.match(patterns.currentStage) || summary.match(patterns.currentStageEn);
      if (currentStageMatch) {
        extractedInfo.push(`Current stage: ${currentStageMatch[1].trim()}`);
      }

      // Extract target question (truncated for brevity)
      const targetQuestionMatch =
        summary.match(patterns.targetQuestion) || summary.match(patterns.targetQuestionEn);
      if (targetQuestionMatch) {
        const question = targetQuestionMatch[1].trim();
        const truncatedQuestion =
          // biome-ignore lint/style/useTemplate: <explanation>
          question.length > 100 ? question.substring(0, 100) + '...' : question;
        extractedInfo.push(`Target: ${truncatedQuestion}`);
      }

      // Extract language
      const languageMatch = summary.match(patterns.language) || summary.match(patterns.languageEn);
      if (languageMatch) {
        extractedInfo.push(`Language: ${languageMatch[1]}`);
      }

      // Extract completeness assessment
      const completenessMatch =
        summary.match(patterns.completeness) || summary.match(patterns.completenessEn);
      if (completenessMatch) {
        extractedInfo.push(
          `Completeness: ${completenessMatch[1]}% - ${completenessMatch[2].trim()}`,
        );
      }

      // Extract evidence quality
      const evidenceQualityMatch =
        summary.match(patterns.evidenceQuality) || summary.match(patterns.evidenceQualityEn);
      if (evidenceQualityMatch) {
        extractedInfo.push(
          `Evidence quality: ${evidenceQualityMatch[1]} - ${evidenceQualityMatch[2].trim()}`,
        );
      }

      // If we extracted meaningful information, return it
      if (extractedInfo.length > 0) {
        return extractedInfo.join(' | ');
      }

      // Fallback: extract first few lines and truncate if too long
      const firstLines = lines.slice(0, 3).join(' | ');
      // biome-ignore lint/style/useTemplate: <explanation>
      return firstLines.length > 200 ? firstLines.substring(0, 200) + '...' : firstLines;
    } catch (error) {
      this.logger.warn(`Error processing stage summary: ${error.message}`);
      // Fallback to truncated original summary
      // biome-ignore lint/style/useTemplate: <explanation>
      return summary.length > 200 ? summary.substring(0, 200) + '...' : summary;
    }
  }

  /**
   * Analyze user intent and generate progress plan (simplified version)
   * This method is used by PilotEngine for backward compatibility
   */
  async analyzeIntentAndPlan(
    model: BaseChatModel,
    userQuestion: string,
    availableTools: GenericToolset[],
    canvasContent: CanvasContentItem[],
    locale?: string,
  ): Promise<ProgressPlan> {
    try {
      this.logger.log(`Starting intent analysis for: "${userQuestion}"`);

      // Use the comprehensive planning method and extract just the ProgressPlan
      const planWithSubtasks = await this.analyzeIntentAndPlanWithSubtasks(
        model,
        userQuestion,
        null, // No existing progress plan
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

      this.logger.log(`Intent analysis completed. Generated ${progressPlan.stages.length} stages`);
      return progressPlan;
    } catch (error) {
      this.logger.error('Intent analysis failed:', error);
      // Return a default plan as fallback
      return this.generateDefaultPlan(userQuestion);
    }
  }

  /**
   * Generate a default progress plan as fallback
   */
  private generateDefaultPlan(userQuestion: string): ProgressPlan {
    const defaultStage: ProgressStage = {
      id: genPilotStepID(),
      name: 'Research',
      description: 'Initial research and data gathering',
      objectives: ['Gather relevant information', 'Analyze requirements'],
      toolCategories: ['web', 'search', 'data'],
      priority: 1,
      status: 'pending',
      stageProgress: 0,
      subtasks: [],
      createdAt: new Date().toISOString(),
    };

    return {
      stages: [defaultStage],
      currentStageIndex: 0,
      overallProgress: 0,
      lastUpdated: new Date().toISOString(),
      planningLogic: 'Default fallback plan',
      userIntent: userQuestion,
      estimatedTotalEpochs: 1,
    };
  }

  /**
   * Update progress plan based on current execution status
   */
  async updateProgressPlan(
    currentPlan: ProgressPlan,
    _userQuestion: string,
    currentStage: ProgressStage,
    completedStages: ProgressStage[],
    _availableTools: GenericToolset[],
    _locale?: string,
  ): Promise<ProgressPlan> {
    // Update current stage status
    const updatedStages = currentPlan.stages.map((stage) => {
      if (stage.id === currentStage.id) {
        return { ...stage, status: 'in_progress' as const };
      }
      return stage;
    });

    // Calculate overall progress
    const totalStages = currentPlan.stages.length;
    const completedCount = completedStages.length;
    const overallProgress = Math.round((completedCount / totalStages) * 100);

    return {
      ...currentPlan,
      stages: updatedStages,
      overallProgress,
      lastUpdated: new Date().toISOString(),
    };
  }
}

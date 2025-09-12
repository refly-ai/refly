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

    return `# ROLE: User Intent-Driven Task Planner
You are a **User Intent-Driven Task Planner** responsible for creating precise sequential stage planning that strictly follows the user's original request structure. Your primary goal is to maintain complete compliance with the user's specified steps while generating efficient parallel subtasks.

## PLANNING MODE
**Mode**: ${isInitialPlan ? 'INITIAL PLANNING' : 'DYNAMIC RE-PLANNING'}
${isInitialPlan ? 'Creating a new execution plan from scratch.' : 'Re-planning based on current progress and execution history.'}

## USER REQUEST
"${userQuestion}"

## USER INTENT ANALYSIS
Before planning, carefully analyze the user's request to identify:

### Step Identification:
- **Explicit Steps**: Look for "first step", "second step", "step 1", "step 2", "第一步", "第二步", etc.
- **Sequential Actions**: Identify actions that must happen in order (e.g., "scrape" → "get" → "generate" → "compile")
- **Dependencies**: Understand what each step depends on from previous steps
- **Final Goal**: Determine the ultimate objective

### Step Pattern Recognition:
- **Ordinal Numbers**: first step, second step, third step, fourth step, fifth step
- **Sequential Verbs**: scrape → get → generate → compile → send
- **Dependency Markers**: "then", "next", "after", "finally"
- **Conditional Logic**: "must include", "must have", "need to"

### Temporal Awareness:
- **Time-Sensitive Tasks**: Prioritize tasks with time constraints (e.g., "today's top 3", "current ranking", "daily list")
- **Time Context**: Always consider temporal requirements when planning subtasks
- **Time Tools**: Utilize get_time tool for time-sensitive operations
- **Batch Operations**: Combine time-sensitive data collection into single operations when possible

### Hidden Dependency Detection:
- **Time Prerequisites**: Detect when time-sensitive tasks require time information first
- **Implicit Dependencies**: Identify unstated but necessary prerequisites
- **Compound Task Analysis**: Break down complex tasks into their constituent dependencies
- **Sequential Requirements**: Recognize when tasks contain multiple sequential sub-operations
- **Dependency Mapping**: Map hidden dependencies to explicit stage requirements

### Example Analysis:
For: "Step 1: Scrape Product Hunt top 3 products; Step 2: Get product information; Step 3: Generate content; Step 4: Generate audio; Step 5: Send email"
- **Step 1**: Scrape Product Hunt top 3 products (Data Collection) - Time-sensitive: "today's ranking"
- **Step 2**: Get product information (Data Enrichment) - depends on Step 1
- **Step 3**: Generate content (Content Generation) - depends on Step 2
- **Step 4**: Generate audio (Audio Generation) - depends on Step 3
- **Step 5**: Send email (Delivery) - depends on Step 4

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

## CANVAS CONTENT
${contentInfo}
${progressContext}

## STAGE PLANNING PRINCIPLES

### Core Stage Planning Rules:
- **Intelligent Mapping**: Map user steps to stages based on actual dependencies, not just user expression
- **Sequential Dependencies**: Stages must follow logical dependency order
- **Hidden Dependency Integration**: Include unstated but necessary prerequisites
- **Complete Coverage**: Ensure all user steps and hidden dependencies are covered
- **Strong Dependencies**: Each stage must wait for the previous stage to complete
- **User Compliance**: Maintain adherence to user's intent while optimizing execution flow

### Stage Design Requirements:
- **Progressive Completion**: Each stage builds toward the final objective
- **Logical Dependencies**: Stages follow logical dependency order, not necessarily user expression order
- **Prerequisite Awareness**: Complete prerequisites before next stage
- **Flexible Count**: Generate as many stages as needed to cover all dependencies
- **Intelligent Splitting**: Split compound tasks into logical stages based on dependencies

### Intelligent Stage Splitting Rules:
- **Time-First Principle**: Add time acquisition before time-sensitive data collection
- **Compound Task Splitting**: Split tasks with multiple distinct operations into separate stages
- **Dependency-Based Splitting**: Split based on actual dependencies, not user expression
- **Efficiency Balance**: Maintain efficiency while ensuring logical stage separation
- **Hidden Dependency Integration**: Include unstated prerequisites as separate stages when necessary

## SUBTASK GENERATION RULES

### Parallel Subtask Principles:
- **Stage-Specific**: Generate subtasks only for the current active stage
- **True Parallelism**: All subtasks must be executable simultaneously
- **Minimal Count**: Generate only essential subtasks (1-3 per stage)
- **No Dependencies**: Subtasks cannot depend on each other
- **Independent Execution**: Each subtask must be completable without waiting for others

### Smart Task Merging Guidelines:
- **Batch Operations**: Combine similar data collection tasks into single operations when possible
- **Time-Sensitive Merging**: Prioritize merging time-sensitive tasks (e.g., "today's top 3" → single batch operation)
- **Sequential Splitting**: Split tasks that require sequential processing (e.g., individual product details after batch ranking)
- **Efficiency Focus**: Reduce subtask count while maintaining complete coverage of stage objectives
- **Context Preservation**: Ensure merged tasks maintain sufficient context for independent execution

### Subtask Design Requirements:
- **Objective-Focused**: Describe what needs to be accomplished, not which tool to use
- **Clear Outcome**: Specify the expected deliverable or result
- **Flexible Tool Selection**: Let the executing agent determine the best tool combination
- **Context-Rich**: Include sufficient context from previous stages
- **Specific Output Requirements**: Clearly specify format, scope, and quality criteria
- **Temporal Context**: Include time requirements when relevant (e.g., "today's", "current", "latest")

## COMPREHENSIVE EXAMPLE

### User Request:
"Step 1: Scrape top 3 products from https://www.producthunt.com/ today's ranking list; Step 2: Get detailed information for the top 3 products from previous stage, must include daily_rank and product_url; Step 3: Generate articles, web pages, and podcast scripts respectively; Step 4: Use multimedia capabilities to generate podcast audio from scripts; Step 5: Compile articles, web pages, and podcast audio into email and send to my mailbox"

### Expected Stage Planning:
\`\`\`json
{
  "userIntent": "Create a comprehensive Product Hunt analysis workflow including data collection, content generation, audio production, and email delivery",
  "taskComplexity": "complex",
  "stages": [
    {
      "name": "Step 1: Time Acquisition and Product Hunt Data Collection",
      "description": "First acquire current time, then scrape top 3 products from Product Hunt's daily ranking list",
      "objectives": ["Get current date/time", "Extract top 3 products from Product Hunt homepage", "Capture daily ranking information"],
      "toolCategories": ["get_time", "web_search", "data_extraction"],
      "priority": 1,
      "estimatedEpochs": 1,
      "status": "in_progress"
    },
    {
      "name": "Step 2: Product Information Enrichment",
      "description": "Gather detailed information for the top 3 products including daily_rank and product_url",
      "objectives": ["Extract daily_rank for each product", "Extract product_url for each product", "Collect additional product details"],
      "toolCategories": ["web_search", "data_extraction"],
      "priority": 2,
      "estimatedEpochs": 1,
      "status": "pending"
    },
    {
      "name": "Step 3: Multi-Format Content Generation",
      "description": "Generate articles, web pages, and podcast scripts based on collected product data",
      "objectives": ["Create article content for each product", "Generate web page layouts", "Write podcast scripts"],
      "toolCategories": ["generate_doc", "content_creation"],
      "priority": 3,
      "estimatedEpochs": 2,
      "status": "pending"
    },
    {
      "name": "Step 4: Audio Production",
      "description": "Convert podcast scripts to audio using multimedia generation capabilities",
      "objectives": ["Generate podcast audio from scripts", "Ensure audio quality and format"],
      "toolCategories": ["generate_media", "audio_production"],
      "priority": 4,
      "estimatedEpochs": 1,
      "status": "pending"
    },
    {
      "name": "Step 5: Email Content Compilation",
      "description": "Organize and format all generated content (articles, web pages, audio) for email delivery",
      "objectives": ["Organize all generated content", "Format content for email delivery", "Prepare comprehensive email package"],
      "toolCategories": ["content_organization", "formatting"],
      "priority": 5,
      "estimatedEpochs": 1,
      "status": "pending"
    },
    {
      "name": "Step 6: Email Delivery",
      "description": "Send the compiled email package to the user's mailbox",
      "objectives": ["Send comprehensive email package", "Confirm delivery status"],
      "toolCategories": ["send_email"],
      "priority": 6,
      "estimatedEpochs": 1,
      "status": "pending"
    }
  ],
  "currentStageSubtasks": [
    {
      "name": "Get Current Time and Batch Extract Top 3 Products",
      "objective": "First acquire current date/time, then scrape all top 3 products from Product Hunt homepage in a single operation, focusing on today's ranking",
      "expectedOutcome": "Current time information and complete ranking data for all top 3 products including names, descriptions, and daily rankings",
      "context": "Target: Product Hunt homepage (https://www.producthunt.com/) - focus on today's current top products. Time-sensitive operation requiring current date/time first.",
      "scope": "Time acquisition followed by all top 3 products in today's daily ranking list",
      "outputRequirements": "Current time + JSON array format with fields: name, description, daily_rank, product_url for all 3 products",
      "status": "pending"
    }
  ],
  "planningLogic": "Intelligent stage splitting based on actual dependencies. Step 1 includes hidden time dependency for time-sensitive data collection. Step 5 (email compilation) and Step 6 (email delivery) are split due to distinct operations. Subtasks designed for parallel execution within each stage, with smart merging for time-sensitive batch operations.",
  "estimatedTotalEpochs": 7,
  "previousExecutionSummary": "${isInitialPlan ? 'Initial planning - no previous execution' : 'Summary of what has been accomplished so far'}"
}
\`\`\`

## COMPLIANCE VERIFICATION
Before finalizing the plan, verify:

### User Intent Compliance:
□ All user-specified steps are represented as separate stages
□ Stage order matches user's intended sequence exactly
□ No user steps are combined or omitted
□ Each stage has clear dependencies on previous stages
□ Stage names reflect user's original step descriptions

### Subtask Validation:
□ Subtasks within each stage are truly parallel
□ No subtask depends on another subtask's completion
□ Each subtask can start immediately without waiting
□ Subtask count is minimal but covers stage objectives
□ All subtasks are essential for stage completion

### Quality Assurance:
□ Each subtask includes rich context from previous stages
□ Output requirements are clearly specified
□ Tool selection is flexible and goal-oriented
□ Planning logic explains stage dependencies
□ Estimated epochs are realistic

## OUTPUT FORMAT
Provide a JSON response with the following structure:
\`\`\`json
{
  "userIntent": "Clear description of what the user wants to achieve",
  "taskComplexity": "simple|medium|complex",
  "stages": [
    {
      "name": "Stage name reflecting user's step (e.g., 'Step 1: Data Collection', 'Step 2: Analysis')",
      "description": "What this stage accomplishes based on user's specified step",
      "objectives": ["Specific objective 1", "Specific objective 2"],
      "toolCategories": ["category1", "category2"],
      "priority": 1,
      "estimatedEpochs": 1,
      "status": "pending|in_progress|completed"
    }
  ],
  "currentStageSubtasks": [
    {
      "name": "Clear, specific task name",
      "objective": "What needs to be accomplished (focus on goals, not tools)",
      "expectedOutcome": "Expected deliverable or result",
      "context": "Relevant context from previous stages and user requirements",
      "scope": "Specific scope and boundaries of this subtask",
      "outputRequirements": "Detailed output format, quality criteria, and specific requirements",
      "status": "pending"
    }
  ],
  "planningLogic": "Explanation of how stages map to user steps and their dependencies",
  "estimatedTotalEpochs": 5,
  "previousExecutionSummary": "${isInitialPlan ? 'Initial planning - no previous execution' : 'Summary of what has been accomplished so far'}"
}
\`\`\`

## CRITICAL REQUIREMENTS

### User Compliance Requirements:
- **MUST** create stages based on actual dependencies, not just user expression
- **MUST** maintain logical dependency order for stages
- **MUST** include hidden dependencies as separate stages when necessary
- **MUST** ensure each stage depends on the previous stage's completion
- **MUST** reflect user's intent while optimizing execution flow
- **MUST** split compound tasks into logical stages based on dependencies

### Subtask Requirements:
- **MUST** generate parallel subtasks for the current active stage only
- **MUST** ensure subtasks can run simultaneously without dependencies
- **MUST** keep subtask count minimal (1-3 per stage)
- **MUST** focus on goals rather than specific tool usage
- **MUST** include sufficient context for independent execution
- **MUST** prioritize batch operations for time-sensitive data collection
- **MUST** include temporal context when relevant (e.g., "today's", "current", "latest")
- **MUST** merge similar tasks to reduce redundancy while maintaining complete coverage
- **MUST** support compound operations when logical (e.g., time acquisition + data collection)

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

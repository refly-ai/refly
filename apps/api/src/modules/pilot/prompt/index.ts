import { z } from 'zod';
import { CanvasContentItem } from '../../canvas/canvas.dto';
import { PilotSession, PilotStep } from '@refly/openapi-schema';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { buildFormattedExamples } from './examples';

/**
 * Schema for pilot steps with workflowStage to enforce proper tool sequencing
 */
export const pilotStepSchema = z
  .object({
    name: z.string().describe('A clear and concise title for the step'),
    skillName: z
      .enum(['commonQnA', 'webSearch', 'librarySearch', 'generateDoc', 'codeArtifacts'])
      .describe('The name of the skill to invoke'),
    priority: z.number().min(1).max(5).describe('Priority level from 1 (highest) to 5 (lowest)'),
    query: z.string().describe('The query to ask the skill'),
    contextItemIds: z
      .array(z.string())
      .describe('The ID list of the relevant canvas items for this step'),
    workflowStage: z
      .enum(['research', 'analysis', 'synthesis', 'creation'])
      .describe(
        'The workflow stage this step belongs to - must follow proper sequencing: research (early) → analysis (middle) → synthesis (optional) → creation (final). Each stage uses specific tools: research uses webSearch/librarySearch/commonQnA, analysis uses commonQnA, synthesis uses commonQnA, creation uses generateDoc/codeArtifacts only after sufficient context gathering.',
      ),
  })
  .describe('A single action step of the pilot');

export const multiStepSchema = z
  .object({
    steps: z.array(pilotStepSchema).describe('A list of steps of the pilot'),
  })
  .describe('A list of steps of the pilot');

export type PilotStepRawOutput = z.infer<typeof pilotStepSchema>;

/**
 * Determines the recommended workflow stage based on the current epoch
 * @param currentEpoch Current epoch number (0-based)
 * @param totalEpochs Total number of epochs (0-based)
 * @returns The recommended workflow stage for the current epoch
 */
export function getRecommendedStageForEpoch(currentEpoch: number, totalEpochs: number): string {
  // Normalize to handle edge cases
  const normalizedCurrentEpoch = Math.max(0, currentEpoch);
  const normalizedTotalEpochs = Math.max(1, totalEpochs);

  // Calculate progress as a percentage
  const progress = normalizedCurrentEpoch / normalizedTotalEpochs;

  // Assign stages based on progress
  if (progress < 0.4) {
    return 'research';
  } else if (progress < 0.7) {
    return 'analysis';
  } else if (progress < 0.85) {
    return 'synthesis';
  } else {
    return 'creation';
  }
}

/**
 * Generates guidance for the current epoch stage
 * @param stage The current workflow stage
 * @returns Guidance text for the prompt
 */
export function generateStageGuidance(stage: string): string {
  switch (stage) {
    case 'research':
      return `
## CURRENT EPOCH STAGE: RESEARCH (Early Stage)
In this early stage, focus exclusively on gathering information:

- REQUIRED: Use primarily webSearch and librarySearch tools
- Use commonQnA only for basic information gathering
- DO NOT use analysis, synthesis, or creation tools yet
- Focus on broad information gathering about the topic
- Collect diverse perspectives and factual information
- Explore different aspects of the question systematically
- ALL steps in this epoch should have workflowStage="research"`;

    case 'analysis':
      return `
## CURRENT EPOCH STAGE: ANALYSIS (Middle Stage)
In this middle stage, focus on analyzing the information collected:

- REQUIRED: Use primarily commonQnA for analysis
- Build upon research collected in previous epochs
- Identify patterns, contradictions, and insights
- Evaluate the quality and reliability of information
- Compare different perspectives and approaches
- Synthesize preliminary findings
- MOST steps in this epoch should have workflowStage="analysis"
- NO creation steps allowed yet`;

    case 'synthesis':
      return `
## CURRENT EPOCH STAGE: SYNTHESIS (Late Middle Stage)
In this late middle stage, focus on organizing and planning outputs:

- REQUIRED: Use primarily commonQnA for synthesis
- Organize information into coherent frameworks
- Identify the most important findings and insights
- Plan the structure of final deliverables
- Draft outlines for documents or code
- MOST steps should have workflowStage="synthesis"
- LIMITED creation steps allowed (max 1)`;

    case 'creation':
      return `
## CURRENT EPOCH STAGE: CREATION (Final Stage)
In this final stage, focus on creating polished outputs:

- NOW APPROPRIATE: Use generateDoc and codeArtifacts, but ONLY in the final 1-2 steps
- MUST reference previous context items in almost all cases
- Only in extremely rare cases can they generate without context dependency
- Create comprehensive documents based on all previous research
- Generate complete code artifacts with proper formatting
- Ensure outputs incorporate insights from all previous epochs
- Polish and refine deliverables
- MOST steps should have workflowStage="creation"
- Some analysis/synthesis steps still acceptable if needed`;

    default:
      return `
## CURRENT EPOCH STAGE: RESEARCH (Default Stage)
Focus on gathering information:

- Use primarily webSearch and librarySearch tools
- Use commonQnA only for basic information gathering
- DO NOT use creation tools yet
- ALL steps in this epoch should have workflowStage="research"`;
  }
}

/**
 * Formats the canvas content items into a detailed, structured string format
 */
export function formatCanvasContent(contentItems: CanvasContentItem[]): string {
  if (!contentItems?.length) {
    return '';
  }

  // Add an index to each item and format with detailed information
  return contentItems
    .map((item, index) => {
      const itemId = item?.id || 'unknown-id';
      const itemType = item?.type || 'unknown-type';
      const header = `## Canvas Item ${index + 1} (ID: ${itemId}, Type: ${itemType})`;

      if (itemType === 'skillResponse') {
        return `${header}\n**Question:** ${item?.title || 'No title'}\n**Answer:**\n${item?.content || 'No content'}\n**Context ID:** ${itemId}`;
      }

      if (itemType === 'document') {
        if (item?.title && item?.content) {
          return `${header}\n**Document Title:** ${item.title}\n**Document Content:**\n${item.content}\n**Context ID:** ${itemId}`;
        }
        if (item?.title && item?.contentPreview) {
          return `${header}\n**Document Title:** ${item.title}\n**Document Preview:**\n${item.contentPreview}\n**Context ID:** ${itemId}`;
        }
      }

      if (itemType === 'codeArtifact') {
        return `${header}\n**Code Snippet:** ${item?.title || 'Untitled Code'}\n\`\`\`\n${item?.content || item?.contentPreview || 'No code available'}\n\`\`\`\n**Context ID:** ${itemId}`;
      }

      // Generic case for other item types
      if (item?.title && (item?.content || item?.contentPreview)) {
        return `${header}\n**Title:** ${item.title}\n**Content:**\n${item?.content || item?.contentPreview || 'No content available'}\n**Context ID:** ${itemId}`;
      }

      return null;
    })
    .filter(Boolean)
    .join('\n\n---\n\n');
}

/**
 * Formats the session and steps into a markdown TODO-list.
 */
export function formatTodoMd(session: PilotSession, steps: PilotStep[]): string {
  const completedSteps: PilotStep[] = steps.filter((step) => step.status === 'finish');
  const pendingSteps: PilotStep[] = steps.filter((step) => step.status !== 'finish');

  // Calculate the current epoch based on the session's metadata or default to 1
  const currentEpoch = session?.currentEpoch ?? 0;
  const totalEpochs = session?.maxEpoch ?? 3;

  let markdown = `# Todo: ${session.title ?? 'Research Plan'}\n\n`;

  // Add original request
  markdown += `## Original Request\n${session.input?.query ?? ''}\n\n`;

  // Add status
  markdown += `## Status\n${session.status ?? 'pending'}\n\n`;

  // Add current epoch
  markdown += `## Current Epoch: ${currentEpoch + 1}/${totalEpochs + 1}\n\n`;

  // Tasks section
  markdown += '## Tasks\n\n';

  // Completed tasks
  markdown += '### Completed\n';
  if (completedSteps?.length > 0) {
    for (const step of completedSteps) {
      markdown += `- [x] ${step.stepId}: ${step.name}\n`;
    }
  }
  markdown += '\n';

  // Pending tasks
  markdown += '### Pending\n';
  if (pendingSteps?.length > 0) {
    for (const step of pendingSteps) {
      const rawOutput: PilotStepRawOutput = JSON.parse(step.rawOutput ?? '{}');
      const { skillName, priority, query, workflowStage } = rawOutput;

      // Format: - [ ] task-id: task name (Priority: X)
      markdown += `- [ ] ${step.name}: ${query} (Priority: ${priority ?? 3})\n`;

      // Add tool suggestion if available
      if (skillName) {
        markdown += `  - Suggested Tool: ${skillName}\n`;
      }

      // Add workflow stage if available
      if (workflowStage) {
        markdown += `  - Stage: ${workflowStage}\n`;
      }
    }
  }

  return markdown;
}

/**
 * Formats the canvas content items into a mermaid flowchart.
 */
export function formatCanvasIntoMermaidFlowchart(contentItems: CanvasContentItem[]): string {
  if (!contentItems?.length) {
    return '```mermaid\ngraph TD\n    EmptyCanvas[Canvas is empty]\n```';
  }

  // Map of IDs to safe IDs for Mermaid (removing special characters)
  const idMap = new Map<string, string>();

  // Create safe IDs for Mermaid diagram
  contentItems.forEach((item, index) => {
    const itemId = item?.id || `unknown-${index}`;
    // Create a safe ID that works in Mermaid (alphanumeric with underscores)
    const safeId = `node_${index}_${itemId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    idMap.set(itemId, safeId);
  });

  // Start building the Mermaid diagram
  let mermaidCode = '```mermaid\ngraph TD\n';

  // Add nodes with proper styling based on type
  for (const item of contentItems) {
    const itemId = item?.id || 'unknown';
    const safeId = idMap.get(itemId) || `node_${itemId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const title = item?.title?.replace(/"/g, '\\"') || 'Untitled';
    const itemType = item?.type || 'unknown-type';

    // Define node style based on type
    let nodeStyle = '';
    switch (itemType) {
      case 'document':
        nodeStyle = 'class="document" fill:#f9f9f9,stroke:#666';
        break;
      case 'skillResponse':
        nodeStyle = 'class="skill" fill:#e6f7ff,stroke:#1890ff';
        break;
      case 'codeArtifact':
        nodeStyle = 'class="code" fill:#f6ffed,stroke:#52c41a';
        break;
      default:
        nodeStyle = 'class="default" fill:#fff,stroke:#d9d9d9';
    }

    // Add node with label and style
    mermaidCode += `    ${safeId}["${title}"] style ${safeId} ${nodeStyle}\n`;
  }

  // Add connections based on inputIds
  for (const item of contentItems) {
    const itemId = item?.id || 'unknown';
    const safeId = idMap.get(itemId) || `node_${itemId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Check if item has input IDs (dependencies)
    if (item?.inputIds?.length) {
      for (const inputId of item.inputIds) {
        const safeInputId = idMap.get(inputId);
        // Only add connection if input ID exists in our map
        if (safeInputId) {
          mermaidCode += `    ${safeInputId} --> ${safeId}\n`;
        }
      }
    }
  }

  // Add legend
  mermaidCode += '    subgraph Legend\n';
  mermaidCode +=
    '        Document["Document"] style Document class="document" fill:#f9f9f9,stroke:#666\n';
  mermaidCode +=
    '        Skill["Skill Response"] style Skill class="skill" fill:#e6f7ff,stroke:#1890ff\n';
  mermaidCode +=
    '        Code["Code Artifact"] style Code class="code" fill:#f6ffed,stroke:#52c41a\n';
  mermaidCode += '    end\n';

  // End the Mermaid diagram
  mermaidCode += '```';

  return mermaidCode;
}

/**
 * Generates a detailed schema guide with example for LLM
 */
export function generateSchemaInstructions(): string {
  // Convert Zod schema to JSON Schema for better documentation
  const jsonSchema = zodToJsonSchema(pilotStepSchema, { target: 'openApi3' });

  // Generate examples that enforce proper tool sequencing
  const researchExample = {
    name: 'Find recent research on quantum computing',
    skillName: 'webSearch',
    query: 'latest advancements in quantum computing 2023',
    contextItemIds: ['quantum-intro-123'],
    workflowStage: 'research',
    priority: 1,
  };

  const analysisExample = {
    name: 'Analyze quantum computing applications',
    skillName: 'commonQnA',
    query: 'Analyze the most promising applications of recent quantum computing advancements',
    contextItemIds: ['quantum-research-results-456', 'quantum-intro-123'],
    workflowStage: 'analysis',
    priority: 3,
  };

  const creationExample = {
    name: 'Create quantum computing visualization',
    skillName: 'codeArtifacts',
    query:
      'Create a single-page HTML visualization of quantum computing principles and applications',
    contextItemIds: ['quantum-analysis-789', 'quantum-research-results-456'],
    workflowStage: 'creation',
    priority: 5,
  };

  return `Please generate a structured JSON array of research steps with the following schema:

Each step should have:
1. "name": A clear, concise title for the step
2. "skillName": The specific skill to invoke (one of: "commonQnA", "webSearch", "librarySearch", "generateDoc", "codeArtifacts")
3. "query": The specific question or prompt to send to the skill
4. "contextItemIds": Array of IDs for relevant canvas items that provide context for this step
5. "workflowStage": The stage of the workflow this step belongs to (one of: "research", "analysis", "synthesis", "creation")

Example steps showing proper tool sequencing:

1. Research stage (early) - use search tools:
\`\`\`json
${JSON.stringify(researchExample, null, 2)}
\`\`\`

2. Analysis stage (middle) - use commonQnA for analysis:
\`\`\`json
${JSON.stringify(analysisExample, null, 2)}
\`\`\`

3. Creation stage (final) - ONLY in the final 1-2 steps and MUST reference previous context:
\`\`\`json
${JSON.stringify(creationExample, null, 2)}
\`\`\`

JSON Schema Definition:
\`\`\`json
${JSON.stringify(jsonSchema, null, 2)}
\`\`\`

IMPORTANT:
- Each step should be focused on a specific research sub-task
- Make steps logical and progressive, building on previous steps when appropriate
- Ensure each step has a clear purpose that contributes to answering the main research question
- Creation tasks (generateDoc, codeArtifacts) MUST ONLY be used in the final 1-2 steps
- Creation tasks MUST reference previous context items in almost all cases
- Only in extremely rare cases can creation tasks generate without context dependency
- Ensure your response is a valid JSON array of steps that follow the schema exactly
`;
}

/**
 * Builds few-shot examples for research step decomposition
 */
export function buildResearchStepExamples(): string {
  return buildFormattedExamples();
}

/**
 * Generates the main planning prompt with canvas content
 */
export function generatePlanningPrompt(
  userQuestion: string,
  session: PilotSession,
  steps: PilotStep[],
  contentItems: CanvasContentItem[],
  maxStepsPerEpoch: number,
  locale?: string,
): string {
  const combinedContent = formatCanvasContent(contentItems);
  const todoMd = formatTodoMd(session, steps);
  const canvasVisual = formatCanvasIntoMermaidFlowchart(contentItems);

  // Calculate the current epoch based on the session's metadata or default to 0
  const currentEpoch = session?.currentEpoch ?? 0;
  const totalEpochs = session?.maxEpoch ?? 3;

  // Determine recommended stage for current epoch
  const recommendedStage = getRecommendedStageForEpoch(currentEpoch, totalEpochs);

  // Generate stage-specific guidance
  const stageGuidance = generateStageGuidance(recommendedStage);

  // Generate locale-specific instructions
  const localeInstructions = locale
    ? `\n## Output Language Instructions\nPlease generate all step names, queries, and any text content in ${locale}. The research plan should be tailored for ${locale} language output.\n`
    : '';

  return `You are an expert research assistant capable of breaking down complex questions into clear, actionable research steps.

## Your Task
Analyze the user's question and available canvas content, then generate a structured research plan with specific steps to thoroughly investigate the topic.
${localeInstructions}
${stageGuidance}

## Tool Usage Guidelines

Follow these important guidelines about tool sequencing:

1. **Research and Context Gathering Tools (Early Stages - MUST USE FIRST)**
   - **webSearch**: Use for gathering up-to-date information from the internet
   - **librarySearch**: Use for searching through structured knowledge bases
   - **commonQnA**: Use for basic information gathering and general knowledge

2. **Analysis and Intermediate Output Tools (Mid Stages - ONLY AFTER RESEARCH)**
   - **commonQnA**: Use for analyzing gathered information and providing structured insights
   - Remember that all tools can produce intermediate outputs as markdown text or code blocks

3. **Final Output Generation Tools (Final Stages - ONLY AT THE END)**
   - **generateDoc**: Use for creating comprehensive documents ONLY after sufficient research, MUST be used only in the final 1-2 steps, and MUST reference previous context
   - **codeArtifacts**: Use for generating complete code artifacts ONLY after proper context is gathered, MUST be used only in the final 1-2 steps, and MUST reference previous context

## CRITICAL SEQUENCING RULES - STRICTLY FOLLOW THESE
- First 60% of steps MUST be research tasks (webSearch, librarySearch, commonQnA for gathering information)
- The first 2-3 steps MUST use webSearch or librarySearch to gather basic information
- Next 20% should be analysis tasks (commonQnA for analyzing gathered information)
- Last 20% can be creation tasks (generateDoc, codeArtifacts) and ONLY after sufficient research and analysis
- NEVER use generateDoc or codeArtifacts in the first 60% of steps
- MUST ONLY use generateDoc and codeArtifacts in the final 1-2 steps
- generateDoc and codeArtifacts MUST almost always reference previous context items, only in extremely rare cases can they generate without context dependency
- Tasks must follow the strict sequence: Research → Analysis → Creation

## Step Generation Guidelines
1. Break down the research into logical, sequential steps
2. Select the most appropriate skill for each research step
3. Craft specific and focused queries for each skill
4. Reference relevant context items from the canvas when appropriate
   - Use the exact context IDs (e.g., "quantum-intro-123") from the Canvas Content section
   - Include multiple context IDs when a step builds on multiple sources
5. Assign the appropriate workflowStage value to each step (research, analysis, synthesis, creation)
6. Generate exactly ${maxStepsPerEpoch} research steps to efficiently explore the topic
7. REQUIRED: First step MUST be webSearch or librarySearch to gather basic information
8. Creation tools (generateDoc, codeArtifacts) MUST ONLY be used in the final 1-2 steps and MUST reference previous context items in almost all cases

## Schema Instructions:

${generateSchemaInstructions()}

## Examples with expected outputs:

${buildResearchStepExamples()}

## Current Todo List:
${todoMd}

## Canvas Content:
${combinedContent}

## Canvas Structure:
${canvasVisual}

## User Question: 

"${userQuestion}"
`;
}

/**
 * Generates the bootstrap prompt when no canvas content exists
 */
export function generateBootstrapPrompt(
  userQuestion: string,
  session: PilotSession,
  steps: PilotStep[],
  contentItems: CanvasContentItem[],
  maxStepsPerEpoch: number,
  locale?: string,
): string {
  const combinedContent = formatCanvasContent(contentItems);
  const todoMd = formatTodoMd(session, steps);
  const canvasVisual = formatCanvasIntoMermaidFlowchart(contentItems);

  // Calculate the current epoch based on the session's metadata or default to 0
  const currentEpoch = session?.currentEpoch ?? 0;
  const totalEpochs = session?.maxEpoch ?? 3;

  // Determine recommended stage for current epoch
  const recommendedStage = getRecommendedStageForEpoch(currentEpoch, totalEpochs);

  // Generate stage-specific guidance
  const stageGuidance = generateStageGuidance(recommendedStage);

  // Generate locale-specific instructions
  const localeInstructions = locale
    ? `\n## Output Language Instructions\nPlease generate all step names, queries, and any text content in ${locale}. The research plan should be tailored for ${locale} language output.\n`
    : '';

  return `You are an expert research assistant capable of breaking down complex questions into clear, actionable research steps.

## Your Task
Analyze the user's question and generate a structured research plan with specific steps to thoroughly investigate the topic. Since no existing content or context is available, create a plan that starts from scratch.
${localeInstructions}
${stageGuidance}

## Tool Usage Guidelines

Follow these important guidelines about tool sequencing:

1. **Research and Context Gathering Tools (Early Stages - MUST USE FIRST)**
   - **webSearch**: Use for gathering up-to-date information from the internet
   - **librarySearch**: Use for searching through structured knowledge bases
   - **commonQnA**: Use for basic information gathering and general knowledge

2. **Analysis and Intermediate Output Tools (Mid Stages - ONLY AFTER RESEARCH)**
   - **commonQnA**: Use for analyzing gathered information and providing structured insights
   - Remember that all tools can produce intermediate outputs as markdown text or code blocks

3. **Final Output Generation Tools (Final Stages - ONLY AT THE END)**
   - **generateDoc**: Use for creating comprehensive documents ONLY after sufficient research, MUST be used only in the final 1-2 steps, and MUST reference previous context
   - **codeArtifacts**: Use for generating complete code artifacts ONLY after proper context is gathered, MUST be used only in the final 1-2 steps, and MUST reference previous context

## CRITICAL SEQUENCING RULES - STRICTLY FOLLOW THESE
- First 60% of steps MUST be research tasks (webSearch, librarySearch, commonQnA for gathering information)
- The first 2-3 steps MUST use webSearch or librarySearch to gather basic information
- Next 20% should be analysis tasks (commonQnA for analyzing gathered information)
- Last 20% can be creation tasks (generateDoc, codeArtifacts) and ONLY after sufficient research and analysis
- NEVER use generateDoc or codeArtifacts in the first 60% of steps
- MUST ONLY use generateDoc and codeArtifacts in the final 1-2 steps
- generateDoc and codeArtifacts MUST almost always reference previous context items, only in extremely rare cases can they generate without context dependency
- Tasks must follow the strict sequence: Research → Analysis → Creation

## Step Generation Guidelines
1. Break down the research into logical, sequential steps
2. Select the most appropriate skill for each research step
3. Craft specific and focused queries for each skill
4. Use empty arrays for contextItemIds since no context is available yet
5. Assign the appropriate workflowStage value to each step (research, analysis, synthesis, creation)
6. Generate exactly ${maxStepsPerEpoch} research steps to efficiently explore the topic
7. REQUIRED: First step MUST be webSearch or librarySearch to gather basic information
8. Creation tools (generateDoc, codeArtifacts) MUST ONLY be used in the final 1-2 steps and MUST reference previous context items in almost all cases

${generateSchemaInstructions()}

Here are examples with expected outputs:
${buildResearchStepExamples()}

Create a research plan that:
1. Begins with broad information gathering (research stage) using webSearch or librarySearch
2. Progresses to analysis of gathered information (analysis stage) using commonQnA
3. Concludes with steps to synthesize or apply the information (creation stage) for final steps only

User Question: "${userQuestion}"

Current Todo List:
${todoMd}

Canvas Content:
${combinedContent}

Canvas Structure:
${canvasVisual}`;
}

/**
 * Generates the fallback prompt for manual JSON parsing
 */
export function generateFallbackPrompt(
  userQuestion: string,
  session: PilotSession,
  steps: PilotStep[],
  contentItems: CanvasContentItem[],
  maxStepsPerEpoch: number,
  locale?: string,
): string {
  const combinedContent = formatCanvasContent(contentItems);
  const todoMd = formatTodoMd(session, steps);
  const canvasVisual = formatCanvasIntoMermaidFlowchart(contentItems);
  const schemaInstructions = generateSchemaInstructions();

  // Calculate the current epoch based on the session's metadata or default to 0
  const currentEpoch = session?.currentEpoch ?? 0;
  const totalEpochs = session?.maxEpoch ?? 3;

  // Determine recommended stage for current epoch
  const recommendedStage = getRecommendedStageForEpoch(currentEpoch, totalEpochs);

  // Generate stage-specific guidance
  const stageGuidance = generateStageGuidance(recommendedStage);

  // Generate locale-specific instructions
  const localeInstructions = locale
    ? `\n## Output Language Instructions\nPlease generate all step names, queries, and any text content in ${locale}. The research plan should be tailored for ${locale} language output.\n`
    : '';

  return `You are an expert research assistant capable of breaking down complex questions into clear, actionable research steps.

## Your Task
Analyze the user's question and generate a structured research plan to thoroughly investigate the topic. Since no existing content or context is available, create a plan that starts from scratch.
${localeInstructions}
${stageGuidance}

## Tool Usage Guidelines

Follow these important guidelines about tool sequencing:

1. **Research and Context Gathering Tools (Early Stages - MUST USE FIRST)**
   - **webSearch**: Use for gathering up-to-date information from the internet
   - **librarySearch**: Use for searching through structured knowledge bases
   - **commonQnA**: Use for basic information gathering and general knowledge

2. **Analysis and Intermediate Output Tools (Mid Stages - ONLY AFTER RESEARCH)**
   - **commonQnA**: Use for analyzing gathered information and providing structured insights
   - Remember that all tools can produce intermediate outputs as markdown text or code blocks

3. **Final Output Generation Tools (Final Stages - ONLY AT THE END)**
   - **generateDoc**: Use for creating comprehensive documents ONLY after sufficient research, MUST be used only in the final 1-2 steps, and MUST reference previous context
   - **codeArtifacts**: Use for generating complete code artifacts ONLY after proper context is gathered, MUST be used only in the final 1-2 steps, and MUST reference previous context

## CRITICAL SEQUENCING RULES - STRICTLY FOLLOW THESE
- First 60% of steps MUST be research tasks (webSearch, librarySearch, commonQnA for gathering information)
- The first 2-3 steps MUST use webSearch or librarySearch to gather basic information
- Next 20% should be analysis tasks (commonQnA for analyzing gathered information)
- Last 20% can be creation tasks (generateDoc, codeArtifacts) and ONLY after sufficient research and analysis
- NEVER use generateDoc or codeArtifacts in the first 60% of steps
- MUST ONLY use generateDoc and codeArtifacts in the final 1-2 steps
- generateDoc and codeArtifacts MUST almost always reference previous context items, only in extremely rare cases can they generate without context dependency
- Tasks must follow the strict sequence: Research → Analysis → Creation

## Guidelines
1. Break down the research into logical, sequential steps
2. Select the most appropriate skill for each research step
3. Craft specific and focused queries for each skill
4. Use empty arrays for contextItemIds since no context is available yet
5. Assign the appropriate workflowStage value to each step (research, analysis, synthesis, creation)
6. Generate exactly ${maxStepsPerEpoch} research steps to efficiently explore the topic
7. REQUIRED: First step MUST be webSearch or librarySearch to gather basic information
8. Creation tools (generateDoc, codeArtifacts) MUST ONLY be used in the final 1-2 steps and MUST reference previous context items in almost all cases

${schemaInstructions}

Here are examples with expected outputs:
${buildResearchStepExamples()}

User Question: "${userQuestion}"

## Current Todo List:
${todoMd}

Canvas Content:
${combinedContent}

Canvas Structure:
${canvasVisual}

Respond ONLY with a valid JSON array wrapped in \`\`\`json and \`\`\` tags.`;
}

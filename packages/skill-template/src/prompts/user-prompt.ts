import { ContextBlock } from '../scheduler/utils/context';

export interface BuildUserPromptOptions {
  hasVisionCapability?: boolean;
}

/**
 * Build instructions for using read_agent_result and read_tool_result tools.
 * These instructions guide the LLM on how to access full result content on-demand.
 */
const buildResultsMetaInstruction = (hasResultsMeta: boolean): string => {
  if (!hasResultsMeta) return '';

  return `
## Previous Results Access
The context contains metadata summaries of previous agent results (resultsMeta).
Each result includes:
- resultId: Unique identifier for the result
- title: Task description
- summary: Brief summary of the result (~300 tokens)
- contentTokens: Size of full content (helps decide if worth reading)
- toolCallsMeta: List of tools used with their callId, toolName, and status

**To access full content:**
- Use \`read_agent_result(resultId)\` to get the complete AI output with tool call placeholders
- Use \`read_tool_result(resultId, callId)\` to get specific tool input/output details

**Best Practice:**
- Read the summary first to determine if you need the full content
- Only call read_agent_result/read_tool_result when the summary is insufficient
- For tool outputs, check the toolCallsMeta.status before reading details

`;
};

export const buildUserPrompt = (
  query: string,
  context: ContextBlock,
  options?: BuildUserPromptOptions,
) => {
  if (!context || (!context.files?.length && !context.resultsMeta?.length)) {
    return query;
  }

  // Check if context has image files but model doesn't have vision capability
  const hasImageFiles = context.files?.some((f) => f.type?.startsWith('image/'));
  const hasVision = options?.hasVisionCapability ?? false;

  let visionWarning = '';
  if (hasImageFiles && !hasVision) {
    visionWarning =
      '\n\n**Note**: The context contains image files, but the current model does NOT have vision capability. You cannot see the image content. To process images, use `execute_code` with Python image libraries (e.g., PIL, opencv).\n';
  }

  // Add instruction for resultsMeta if present
  const resultsMetaInstruction = buildResultsMetaInstruction(!!context.resultsMeta?.length);

  return `User provided following context, please use them wisely to understand the task and solve the problem:
${resultsMetaInstruction}
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`
${visionWarning}
Question: ${query}`;
};

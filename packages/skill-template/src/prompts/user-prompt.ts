import { ContextBlock } from '../scheduler/utils/context';

export const buildUserPrompt = (query: string, context: ContextBlock, images?: string[]) => {
  if (!context || (!context.files?.length && !context.results?.length)) {
    return query;
  }

  // Check if context has image files but model doesn't have vision capability
  const hasImageFiles = context.files?.some((f) => f.type?.startsWith('image/'));
  const hasVisionCapability = images && images.length > 0;

  let visionWarning = '';
  if (hasImageFiles && !hasVisionCapability) {
    visionWarning =
      '\n\n**Note**: The context contains image files, but the current model does NOT have vision capability. You cannot see the image content. To process images, use `execute_code` with Python image libraries (e.g., PIL, opencv).\n';
  }

  return `User provided following context, please use them wisely to understand the task and solve the problem:

\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`
${visionWarning}
Question: ${query}`;
};

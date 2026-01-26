import { ContextBlock } from '../scheduler/utils/context';
import { PromptTemplate } from './prompt-template';

interface BuildUserPromptOptions {
  hasVisionCapability?: boolean;
}

const template = PromptTemplate.load('user-prompt.md');

export const buildUserPrompt = (
  query: string,
  context: ContextBlock,
  options?: BuildUserPromptOptions,
) => {
  // If no context, return query directly
  if (!context || (!context.files?.length && !context.resultsMeta?.length)) {
    return query;
  }

  const hasResultsMeta = !!context.resultsMeta?.length;
  const contextJson = JSON.stringify(context, null, 2);

  // Check if context has image files but model doesn't have vision capability
  const hasImageFiles = context.files?.some((f) => f.type?.startsWith('image/'));
  const hasVision = options?.hasVisionCapability ?? false;
  const showVisionWarning = hasImageFiles && !hasVision;

  // Render the template with the provided data
  return template.render({
    hasResultsMeta,
    contextJson,
    showVisionWarning,
    query,
  });
};

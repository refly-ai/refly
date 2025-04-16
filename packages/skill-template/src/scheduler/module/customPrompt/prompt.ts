import { buildCitationReminder } from '../common/citationRules';
import { buildCustomProjectInstructionsForUserPrompt } from '../common/personalization';

// For custom prompt, we'll use the user-provided system prompt directly
export const buildCustomPromptSystemPrompt = (
  customSystemPrompt: string,
  _locale: string,
  needPrepareContext: boolean,
) => {
  console.log('needPrepareContext', needPrepareContext);

  // No longer adding custom instructions to system prompt
  return customSystemPrompt;
};

export const buildCustomPromptUserPrompt = ({
  originalQuery,
  optimizedQuery,
  rewrittenQueries,
  customInstructions,
}: {
  originalQuery: string;
  optimizedQuery: string;
  rewrittenQueries: string[];
  locale?: string;
  customInstructions?: string;
}) => {
  let prompt = '';

  if (originalQuery === optimizedQuery) {
    prompt = `## User Query
${originalQuery}
`;
  } else {
    prompt = `## User Query

### Original User Query
${originalQuery}

### Optimized User Query
${optimizedQuery}

### Rewritten User Queries
${rewrittenQueries.map((query) => `- ${query}`).join('\n')}
`;
  }

  // Add custom instructions to user prompt if available
  if (customInstructions) {
    prompt += `\n${buildCustomProjectInstructionsForUserPrompt(customInstructions)}`;
  }

  return prompt;
};

export const buildCustomPromptContextUserPrompt = (
  context: string,
  needPrepareContext: boolean,
) => {
  if (!needPrepareContext) {
    return '';
  }

  return `
## Context
${context}

${buildCitationReminder()}
`;
};

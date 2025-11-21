import { ContextBlock } from '../scheduler/utils/context';

export const buildUserPrompt = (query: string, context: ContextBlock) => {
  if (!context || (!context.files?.length && !context.results?.length)) {
    return query;
  }

  return `User provided following context, please use them wisely to understand the task and solve the problem:

\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

Question: ${query}`;
};

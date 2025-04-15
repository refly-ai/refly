import { buildWebSearchExamples } from './examples';
import { buildCitationRules, buildCitationReminder } from '../common/citationRules';
import {
  buildChatHistoryRules,
  buildQueryProcessAndChatHistoryInstructions,
  chatHistoryReminder,
} from '../common/chat-history';
import { buildWebSearchChatHistoryExamples } from './examples';
import { buildQueryPriorityInstruction, buildSpecificQueryInstruction } from '../common/query';
import { buildContextFormat } from './context';
import { buildLocaleFollowInstruction } from '../common/locale-follow';
import { buildQueryIntentAnalysisInstruction } from '../../utils/common-prompt';
import { buildFormatDisplayInstruction } from '../common/format';
import {
  buildSimpleDetailedExplanationInstruction,
  buildCustomProjectInstructionsForUserPrompt,
} from '../common/personalization';

export const buildWebSearchSystemPrompt = (_locale: string, _needPrepareContext: boolean) => {
  const systemPrompt = `You are an AI assistant developed by Refly, specializing in providing accurate information based on web search results and internal knowledge base. Your task is to synthesize information from multiple sources to provide comprehensive, actionable, and accurate answers.

${buildCitationRules()}

## Guidelines
1. ALWAYS start with a DIRECT, ACTIONABLE answer - give specific solutions, steps, or recommendations first
2. Provide the core solution immediately, then support with citations
3. Use clear, step-by-step instructions when applicable
4. Include practical examples or code snippets when relevant
5. Only add context and explanations after the main solution
6. If no context is relevant, provide a direct answer based on your knowledge
7. Maintain a friendly and professional tone
8. For recommendations, start with a clear list of options and their key benefits

## Response Structure
1. Direct Solution (Required)
   - Start with "Here's what you need to do:" or similar action-oriented phrase
   - Provide immediate, practical steps or answers
   - Include code snippets or examples if relevant
   - Keep it concise and clear

2. Supporting Information (Optional)
   - Add relevant context or explanations
   - Include best practices or considerations
   - Keep brief and focused

3. Citations
   - Cite sources after presenting solutions
   - Use citations to validate rather than introduce information
   - Prefer internal sources over external ones for company-specific information

## Context Priority and Usage
1. User Selected Content (Highest Priority)
   - Content explicitly selected by users takes precedence
   - Found in <MentionedContext><UserSelectedContent>
   - Most relevant for code explanations and specific document references

2. Knowledge Base Documents (High Priority)
   - Internal documentation and guides
   - Found in <MentionedContext><KnowledgeBaseDocuments>
   - Best for company-specific information

3. Knowledge Base Resources (Medium Priority)
   - Additional internal resources
   - Found in <OtherContext><KnowledgeBaseResources>
   - Supplementary information when other sources are insufficient

4. Web Search Results (Medium Priority)
   - External web sources
   - Found in <WebSearchContext>
   - Good for general information and current trends

${buildQueryPriorityInstruction()}

${buildQueryProcessAndChatHistoryInstructions()}

${buildChatHistoryRules()}

${buildWebSearchExamples()}

${buildWebSearchChatHistoryExamples()}

## Performance Optimization
1. Prioritize actionable information
2. Use clear, step-by-step instructions
3. Include practical examples when possible
4. Keep responses focused and solution-oriented
5. Group related information efficiently

## FINAL CHECKLIST
- ✓ Started with direct, actionable solution
- ✓ Provided clear steps or recommendations
- ✓ Included practical examples if relevant
- ✓ Added supporting context if needed
- ✓ Used citations to validate information
- ✓ Considered full chat history
- ✓ Response is clear and actionable

${buildContextFormat()}

${buildSpecificQueryInstruction()}
`;

  return systemPrompt;
};

export const buildWebSearchUserPrompt = ({
  originalQuery,
  optimizedQuery,
  rewrittenQueries,
  locale,
  customInstructions,
}: {
  originalQuery: string;
  optimizedQuery: string;
  rewrittenQueries: string[];
  locale: string;
  customInstructions?: string;
}) => {
  let prompt = '';

  if (originalQuery === optimizedQuery) {
    prompt = `## Search Query
${originalQuery}

${buildCitationReminder()}

${chatHistoryReminder()}

${buildLocaleFollowInstruction(locale)}
`;
  } else {
    prompt = `## User Query

### Original Search Query
${originalQuery}

### Optimized Search Query
${optimizedQuery}

### Rewritten Search Queries
${rewrittenQueries.map((query) => `- ${query}`).join('\n')}

${buildQueryIntentAnalysisInstruction()}

${buildCitationReminder()}

${chatHistoryReminder()}

${buildLocaleFollowInstruction(locale)}

${buildFormatDisplayInstruction()}
${buildSimpleDetailedExplanationInstruction()}
`;
  }

  // Add custom instructions to user prompt if available
  if (customInstructions) {
    prompt += `\n${buildCustomProjectInstructionsForUserPrompt(customInstructions)}`;
  }

  return prompt;
};

export const buildWebSearchContextUserPrompt = (context: string, needPrepareContext: boolean) => {
  if (!needPrepareContext) {
    return '';
  }

  return `
## Context
${context}

${buildCitationReminder()}
`;
};

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

export const buildWebSearchSystemPrompt = () => {
  return `You are an AI assistant developed by Refly, specializing in providing accurate information based on web search results. Your task is to synthesize information from multiple web sources to provide comprehensive and accurate answers.

${buildCitationRules()}

## Guidelines
1. ALWAYS directly address the user's specific question using web search results
2. Stay focused on the exact query - don't add unnecessary information
3. Answer questions directly and concisely with proper source citations
4. If search results don't fully address the query, acknowledge this
6. Maintain a friendly and professional tone

${buildQueryPriorityInstruction()}

${buildQueryProcessAndChatHistoryInstructions()}

${buildChatHistoryRules()}

${buildWebSearchExamples()}

${buildWebSearchChatHistoryExamples()}

## Performance Optimization
1. Focus on key information first
2. Use simple, clear language
3. Keep responses concise but informative
4. Group related information with shared citations
5. Prioritize recent and authoritative sources

## FINAL CHECKLIST
- ✓ Prioritize user's original query intent
- ✓ Only cite when context is relevant
- ✓ Citations immediately follow statements
- ✓ Answer is clear and concise
- ✓ Considered full chat history for context
- ✓ Properly handled follow-up questions

${buildContextFormat()}

${buildSpecificQueryInstruction()}
`;
};

export const buildWebSearchUserPrompt = ({
  originalQuery,
  optimizedQuery,
  rewrittenQueries,
  locale,
}: {
  originalQuery: string;
  optimizedQuery: string;
  rewrittenQueries: string[];
  locale: string;
}) => {
  if (originalQuery === optimizedQuery) {
    return `## Search Query
${originalQuery}

${buildCitationReminder()}

${chatHistoryReminder()}

${buildLocaleFollowInstruction(locale)}
`;
  }

  return `## User Query

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
`;
};

export const buildWebSearchContextUserPrompt = (context: string, needPrepareContext: boolean) => {
  if (!needPrepareContext) {
    return '';
  }

  return `
## Web Search Results
${context}

${buildCitationReminder()}
`;
};

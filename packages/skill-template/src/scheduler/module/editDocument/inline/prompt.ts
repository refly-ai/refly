import { Document } from '@refly/openapi-schema';
import { HighlightSelection } from '../types';
import { referenceContextHandlingPrompt } from '../common';
import { buildLocaleFollowInstruction } from '../../common/locale-follow';
import {
  importantRemindersPrompt,
  buildInlineEditDocumentCoreInstructionsPrompt,
  inlineHighlightContextEmphasisPrompt,
  inlineEditPriorityRulesPrompt,
  inlineOperationRulesPrompt,
} from './core';
import { contextualExamples, noContextExamples } from './examples';
import {
  buildContextualInlineEditDocumentContext,
  buildNoContextInlineEditDocumentContext,
} from './context';
import { commonQueryAndContextPriorityRules, editDocumentContextRules } from '../common';
import { buildSpecificQueryInstruction } from '../../common/query';
import { buildFormatDisplayInstruction } from '../../common/format';

// response.reflyDocument frontend need return surround content

// Update buildNoContextInlineEditDocumentPrompt
export const buildNoContextInlineEditDocumentPrompt = () => `
# Refly AI Inline Content Editor

${inlineHighlightContextEmphasisPrompt}

## Role
You are an AI content editor focusing on precise inline document modifications.

## Edit Processing Steps
1. Content Analysis
   - Identify target document (title and entityId same as documentContext)
   - Identify highlighted inline text
   - Understand edit requirements
   - Review surrounding context
   - Analyze document style

2. Edit Planning
   - Plan content modifications
   - Consider text flow
   - Ensure natural transitions
   - Maintain paragraph coherence

3. Edit Execution
   - Apply changes within highlight markers
   - Create seamless integration
   - Preserve document style
   - Verify readability

${inlineEditPriorityRulesPrompt}

${buildInlineEditDocumentCoreInstructionsPrompt()}

${commonQueryAndContextPriorityRules()}

${noContextExamples}

${importantRemindersPrompt}

${buildSpecificQueryInstruction()}
`;

// Update buildContextualInlineEditDocumentPrompt
export const buildContextualInlineEditDocumentPrompt = () => `
# Refly AI Context-Aware Inline Editor

${inlineHighlightContextEmphasisPrompt}

## Role
You are an AI content editor specializing in context-integrated inline modifications.

## Edit Processing Steps
1. Content Analysis
   - Identify target document (title and entityId same as documentContext)
   - Identify highlighted inline text
   - Understand edit requirements
   - Review available context
   - Analyze document style

2. Context Integration
   - Evaluate knowledge base relevance
   - Consider chat history context
   - Plan seamless integration
   - Maintain text flow

3. Edit Execution
   - Apply changes within highlight markers
   - Integrate context naturally
   - Preserve document style
   - Ensure readability

${inlineEditPriorityRulesPrompt}

${buildInlineEditDocumentCoreInstructionsPrompt()}

${editDocumentContextRules}

${commonQueryAndContextPriorityRules()}

${referenceContextHandlingPrompt}

${contextualExamples}

${importantRemindersPrompt}

${buildSpecificQueryInstruction()}
`;

export const buildInlineEditDocumentSystemPrompt = (
  _locale: string,
  needPrepareContext: boolean,
) => {
  if (needPrepareContext) {
    return buildContextualInlineEditDocumentPrompt();
  }

  return buildNoContextInlineEditDocumentPrompt();
};

export const buildInlineEditDocumentUserPrompt = ({
  originalQuery,
  optimizedQuery,
  locale,
}: {
  originalQuery: string;
  optimizedQuery: string;
  locale: string;
}) => {
  return `
## User Query (Primary)
${originalQuery}

${
  optimizedQuery !== originalQuery
    ? `
## AI Optimized Query (Secondary)
// Consider this as supplementary context only
${optimizedQuery}
`
    : ''
}

${importantRemindersPrompt}

${inlineEditPriorityRulesPrompt}

${inlineHighlightContextEmphasisPrompt}

${inlineOperationRulesPrompt}

${buildLocaleFollowInstruction(locale)}

${buildFormatDisplayInstruction()}
`;
};

export const buildContextualInlineEditDocumentContextUserPrompt = (documentContext: {
  document: Document;
  selectedContent: HighlightSelection;
}) => {
  return (context: string, needPrepareContext: boolean) => {
    return needPrepareContext
      ? buildContextualInlineEditDocumentContext(documentContext, context)
      : buildNoContextInlineEditDocumentContext(documentContext);
  };
};

import { Document } from '@refly/openapi-schema';
import { HighlightSelection } from '../types';
import {
  commonQueryAndContextPriorityRules,
  referenceContextHandlingPrompt,
  editDocumentContextRules,
} from '../common';
import { buildLocaleFollowInstruction } from '../../common/locale-follow';
import { contextualExamples, noContextExamples } from './examples';
import { buildSpecificQueryInstruction } from '../../common/query';
import {
  buildBlockEditDocumentCoreInstructionsPrompt,
  importantRemindersPrompt,
  editPriorityRulesPrompt,
  highlightContextEmphasisPrompt,
  highlightOperationRulesPrompt,
} from './core';
import {
  buildContextualBlockEditDocumentContext,
  buildNoContextBlockEditDocumentContext,
} from './context';
import { buildFormatDisplayInstruction } from '../../common/format';

export const buildNoContextBlockEditDocumentPrompt = () => `
# Refly AI Block Content Editor (No Context Mode)

${highlightContextEmphasisPrompt}

## Role
You are an AI content editor focusing on direct document editing without external context.

## Edit Processing Steps
1. Document Analysis
   - Identify target document (title and entityId same as documentContext)
   - Locate highlight markers
   - Understand user's edit requirements
   - Review document structure and style

2. Content Planning
   - Analyze edit requirements
   - Plan content structure
   - Determine appropriate block types
   - Ensure coherence with surrounding content

3. Edit Execution
   - Apply changes within highlight markers
   - Maintain document flow
   - Follow document style
   - Verify content completeness

${editPriorityRulesPrompt}

${buildBlockEditDocumentCoreInstructionsPrompt()}

${commonQueryAndContextPriorityRules()}

${noContextExamples}

${importantRemindersPrompt}

${buildSpecificQueryInstruction()}
`;

export const buildContextualBlockEditDocumentPrompt = () => `
# Refly AI Context-Aware Block Content Editor

${highlightContextEmphasisPrompt}

## Role
You are an AI content editor specializing in context-integrated document editing.

## Edit Processing Steps
1. Document Analysis
   - Identify target document (title and entityId same as documentContext)
   - Locate highlight markers
   - Understand user's edit requirements
   - Review available context
   - Cross-reference multiple sources
   - Prioritize mentioned context

2. Context Integration
   - Evaluate knowledge base relevance
   - Consider chat history context
   - Identify useful reference material
   - Plan coherent integration

3. Content Enhancement
   - Enrich content with contextual information
   - Maintain document coherence
   - Ensure proper source attribution
   - Preserve document style

4. Edit Execution
   - Apply changes within highlight markers
   - Maintain document flow
   - Integrate context appropriately

${editPriorityRulesPrompt}

${buildBlockEditDocumentCoreInstructionsPrompt()}

${editDocumentContextRules}

${commonQueryAndContextPriorityRules()}

${referenceContextHandlingPrompt}

${contextualExamples}

${importantRemindersPrompt}

${buildSpecificQueryInstruction()}
`;

export const buildBlockEditDocumentSystemPrompt = (
  _locale: string,
  needPrepareContext: boolean,
) => {
  if (needPrepareContext) {
    return buildContextualBlockEditDocumentPrompt();
  }
  return buildNoContextBlockEditDocumentPrompt();
};

export const buildBlockEditDocumentUserPrompt = ({
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

${editPriorityRulesPrompt}

${highlightContextEmphasisPrompt}

${highlightOperationRulesPrompt}

${buildLocaleFollowInstruction(locale)}

${buildFormatDisplayInstruction()}
`;
};

export const buildContextualBlockEditDocumentContextUserPrompt = (documentContext: {
  document: Document;
  selectedContent: HighlightSelection;
}) => {
  return (context: string, needPrepareContext: boolean) => {
    return needPrepareContext
      ? buildContextualBlockEditDocumentContext(documentContext, context)
      : buildNoContextBlockEditDocumentContext(documentContext);
  };
};

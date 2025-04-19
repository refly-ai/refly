import { Document } from '@refly/openapi-schema';
import { HighlightSelection } from './types';
import { InPlaceEditType } from '@refly/utils';
import {
  buildBlockEditDocumentSystemPrompt,
  buildBlockEditDocumentUserPrompt,
  buildContextualBlockEditDocumentContextUserPrompt,
} from './block';
import {
  buildInlineEditDocumentSystemPrompt,
  buildInlineEditDocumentUserPrompt,
  buildContextualInlineEditDocumentContextUserPrompt,
} from './inline';

const getModules = (documentContext: {
  document: Document;
  selectedContent: HighlightSelection;
}) => {
  return {
    block: {
      buildSystemPrompt: buildBlockEditDocumentSystemPrompt,
      buildUserPrompt: buildBlockEditDocumentUserPrompt,
      buildContextUserPrompt: buildContextualBlockEditDocumentContextUserPrompt(documentContext),
    },
    inline: {
      buildSystemPrompt: buildInlineEditDocumentSystemPrompt,
      buildUserPrompt: buildInlineEditDocumentUserPrompt,
      buildContextUserPrompt: buildContextualInlineEditDocumentContextUserPrompt(documentContext),
    },
  };
};

export const getEditDocumentModule = (
  type: InPlaceEditType,
  documentContext: {
    document: Document;
    selectedContent: HighlightSelection;
  },
) => {
  return getModules(documentContext)[type];
};

// Re-export types and helpers
export * from './types';
export * from './helper';

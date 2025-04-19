import { Document } from '@refly/openapi-schema';
import { HighlightSelection } from '../types';

export const buildContextualInlineEditDocumentDocumentContext = (documentContext: {
  document: Document;
  selectedContent: HighlightSelection;
}) => {
  const { document, selectedContent } = documentContext;

  return `
    <documentContext>
    <reflyArtifact 
    type="document" 
    title="${document.title}"
    entityId="${document?.docId}"
  >
  ${selectedContent.beforeHighlight}<highlight>${selectedContent.highlightedText}</highlight>${selectedContent.afterHighlight}
  </reflyArtifact>
    </documentContext>`;
};

export const buildContextualInlineEditDocumentReferenceContext = (referenceContext: string) => `
    <referenceContext>
    ${referenceContext}
    </referenceContext>`;

export const buildContextualInlineEditDocumentContext = (
  documentContext: { document: Document; selectedContent: HighlightSelection },
  referenceContext: string,
) => {
  const documentContextString = buildContextualInlineEditDocumentDocumentContext(documentContext);
  const referenceContextString =
    buildContextualInlineEditDocumentReferenceContext(referenceContext);

  return `
    <context>
    ${documentContextString}
    ${referenceContextString}
    </context>`;
};

export const buildNoContextInlineEditDocumentContext = (documentContext: {
  document: Document;
  selectedContent: HighlightSelection;
}) => {
  const { document, selectedContent } = documentContext;

  return `
  <context>
  <reflyArtifact 
    type="document" 
    title="${document.title}"
    entityId="${document?.docId}"
  >
  ${selectedContent.beforeHighlight}<highlight>${selectedContent.highlightedText}</highlight>${selectedContent.afterHighlight}
  </reflyArtifact>
  </context>`;
};

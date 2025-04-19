import { HighlightSelection } from '../types';
import { Document } from '@refly/openapi-schema';

export const buildContextualBlockEditDocumentDocumentContext = (documentContext: {
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
   ${selectedContent.beforeHighlight}
   <highlight></highlight>
   ${selectedContent.afterHighlight}
   </reflyArtifact>
   </documentContext>`;
};

export const buildContextualBlockEditDocumentReferenceContext = (referenceContext: string) => `
   <referenceContext>
   ${referenceContext}
   </referenceContext>`;

export const buildContextualBlockEditDocumentContext = (
  documentContext: { document: Document; selectedContent: HighlightSelection },
  referenceContext: string,
) => {
  const documentContextString = buildContextualBlockEditDocumentDocumentContext(documentContext);
  const referenceContextString = buildContextualBlockEditDocumentReferenceContext(referenceContext);

  return `
   <context>
   ${documentContextString}
   ${referenceContextString}
   </context>`;
};

export const buildNoContextBlockEditDocumentContext = (documentContext: {
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
  ${selectedContent.beforeHighlight}
  <highlight></highlight>
  ${selectedContent.afterHighlight}
  </reflyArtifact>
  </context>`;
};

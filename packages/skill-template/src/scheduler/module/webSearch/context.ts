export const buildContextFormat = () => {
  return `
  ## Context Format
<Context>
<MentionedContext>
    <KnowledgeBaseDocuments>
      <ContextItem citationIndex='[[citation:x]]' type='document' entityId={id} title={title}>content</ContextItem>
    </KnowledgeBaseDocuments>
    <UserSelectedContent>
      <ContextItem citationIndex='[[citation:x]]' type='selectedContent' from={source} entityId={id} title={title} weblinkUrl={url}>content</ContextItem>
    </UserSelectedContent>
  </MentionedContext>
  
  <OtherContext>
    <KnowledgeBaseResources>
      <ContextItem citationIndex='[[citation:x]]' type='resource' entityId={id} title={title}>content</ContextItem>
    </KnowledgeBaseResources>
  </OtherContext>

  <WebSearchContext>
    <ContextItem citationIndex='[[citation:x]]' type='webSearchSource' url={url} title={title}>content</ContextItem>
  </WebSearchContext>

</Context>
  `;
};

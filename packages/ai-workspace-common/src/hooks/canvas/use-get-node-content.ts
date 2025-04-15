import { Node } from '@xyflow/react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

export const useGetNodeContent = (node: Node) => {
  const fetchNodeContent = async (node: Node) => {
    if (!node) return '';

    const id = node?.data?.entityId as string;
    const type = node?.type;
    const contentPreview = node?.data?.contentPreview;

    if (!id || !type) return contentPreview || '';

    try {
      switch (type) {
        case 'document': {
          const { data, error } = await getClient().getDocumentDetail({ query: { docId: id } });
          if (error) {
            return contentPreview || '';
          }
          return data?.data?.content || contentPreview || '';
        }

        case 'resource': {
          const { data, error } = await getClient().getResourceDetail({
            query: { resourceId: id },
          });
          if (error) {
            return contentPreview || '';
          }
          return data?.data?.content || contentPreview || '';
        }

        case 'skillResponse': {
          const { data, error } = await getClient().getActionResult({ query: { resultId: id } });
          if (error) {
            return contentPreview || '';
          }
          return (
            data?.data?.steps
              ?.map((step) => step?.content || '')
              .filter(Boolean)
              .join('\n\n') ||
            contentPreview ||
            ''
          );
        }

        case 'codeArtifact': {
          const { data, error } = await getClient().getCodeArtifactDetail({
            query: { artifactId: id },
          });
          if (error) {
            return contentPreview || '';
          }
          return data?.data?.content || contentPreview || '';
        }

        default:
          return contentPreview || '';
      }
    } catch (error) {
      console.error('Error fetching node content:', error);
      return contentPreview || '';
    }
  };
  return {
    fetchNodeContent: () => fetchNodeContent(node),
  };
};

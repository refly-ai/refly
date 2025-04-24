import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

export const useExportDocumentToMarkdown = () => {
  const exportDocumentToMarkdown = async (docId: string) => {
    if (!docId) return '';
    try {
      const { data, error } = await getClient().exportDocumentToMarkdown({ query: { docId } });
      if (error) {
        console.error('Export document failed:', error);
        return '';
      }
      return data?.data?.content || '';
    } catch (err) {
      console.error('Export document error:', err);
      return '';
    }
  };

  return {
    exportDocumentToMarkdown,
  };
};

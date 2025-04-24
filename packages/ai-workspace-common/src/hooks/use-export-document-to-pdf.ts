import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

export const useExportDocumentToPdf = () => {
  const exportDocumentToPdf = async (docId: string) => {
    if (!docId) return '';
    try {
      const { data, error } = await getClient().exportDocumentToPdf({ query: { docId } });
      if (error) {
        console.error('Export document failed:', error);
        return '';
      }
      return data || '';
    } catch (err) {
      console.error('Export document error:', err);
      return '';
    }
  };

  return {
    exportDocumentToPdf,
  };
};

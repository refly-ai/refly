import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
export const useExportDocumentToDocx = () => {
  const exportDocumentToDocx = async (docId: string) => {
    try {
      const { data, error } = await getClient().exportDocumentToDocx({ query: { docId } });
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
    exportDocumentToDocx,
  };
};

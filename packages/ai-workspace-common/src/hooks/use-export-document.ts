import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

export type ExportType = 'markdown' | 'docx' | 'pdf';

export const useExportDocument = () => {
  const exportDocument = async (docId: string, format: ExportType = 'markdown') => {
    if (!docId) return '';
    try {
      const { data, error } = await getClient().exportDocument({
        query: {
          docId,
          format,
        },
      });

      if (error) {
        console.error('Export document falied:', error);
        return '';
      }

      return data || '';
    } catch (err) {
      console.error('Export document error:', err);
      return '';
    }
  };

  return {
    exportDocument,
  };
};

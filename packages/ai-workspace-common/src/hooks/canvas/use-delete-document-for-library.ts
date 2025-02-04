import { useState } from 'react';
import * as Y from 'yjs';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useThrottledCallback } from 'use-debounce';
import { useDocumentStoreShallow } from '@refly-packages/ai-workspace-common/stores/document';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useSubscriptionUsage } from '../use-subscription-usage';

export const useDeleteDocumentForLibrary = () => {
  const [isRemoving, setIsRemoving] = useState(false);
  const { deleteDocumentData } = useDocumentStoreShallow((state) => ({
    deleteDocumentData: state.deleteDocumentData,
  }));

  const { refetchUsage } = useSubscriptionUsage();

  const deleteDocument = async (docId: string) => {
    if (isRemoving) return;
    let success = false;
    try {
      setIsRemoving(true);
      const { data } = await getClient().deleteDocument({
        body: {
          docId,
        },
      });

      if (data?.success) {
        success = true;
        deleteDocumentData(docId);

        // Clear IndexedDB persistence for the deleted document
        const indexedDbProvider = new IndexeddbPersistence(docId, new Y.Doc());
        await indexedDbProvider.clearData();
        await indexedDbProvider.destroy();
      }
    } finally {
      setIsRemoving(false);
      refetchUsage();
    }
    return success;
  };

  const throttledDeleteDocument = useThrottledCallback((documentId: string) => {
    return deleteDocument(documentId);
  }, 300);

  return { deleteDocumentForLibrary: throttledDeleteDocument, isRemoving };
};

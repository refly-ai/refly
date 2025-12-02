import { useState } from 'react';
import * as Y from 'yjs';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useDebouncedCallback } from 'use-debounce';
import { useDocumentStoreShallow } from '@refly/stores';
import { IndexeddbPersistence } from 'y-indexeddb';
import { ensureIndexedDbSupport } from '@refly-packages/ai-workspace-common/utils/indexeddb';
import { useSubscriptionUsage } from '../use-subscription-usage';

export const useDeleteDocument = () => {
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
        try {
          const canUseIndexedDb = await ensureIndexedDbSupport();
          if (canUseIndexedDb) {
            const indexedDbProvider = new IndexeddbPersistence(docId, new Y.Doc());
            await indexedDbProvider.clearData();
            await indexedDbProvider.destroy();
          }
        } catch (error) {
          console.error('Failed to clear document IndexedDB state:', error);
        }
      }
    } finally {
      setIsRemoving(false);
      refetchUsage();
    }
    return success;
  };

  const debouncedDeleteDocument = useDebouncedCallback(
    (documentId: string) => {
      return deleteDocument(documentId);
    },
    300,
    { leading: true },
  );

  return { deleteDocument: debouncedDeleteDocument, isRemoving };
};

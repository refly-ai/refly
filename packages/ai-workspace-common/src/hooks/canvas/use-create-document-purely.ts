import { useCallback, useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';
import { parseMarkdownCitationsAndCanvasTags } from '@refly/utils/parse';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { useSubscriptionStoreShallow } from '@refly-packages/ai-workspace-common/stores/subscription';
import { getAvailableFileCount } from '@refly/utils/quota';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { Document } from '@refly/openapi-schema';

export const useCreateDocumentPurely = () => {
  const [isCreating, setIsCreating] = useState(false);
  const { t } = useTranslation();
  const { storageUsage, refetchUsage } = useSubscriptionUsage();
  const { projectId } = useGetProjectCanvasId();
  const { sourceList, setSourceList } = useSiderStoreShallow((state) => ({
    sourceList: state.sourceList,
    setSourceList: state.setSourceList,
  }));
  const { setStorageExceededModalVisible } = useSubscriptionStoreShallow((state) => ({
    setStorageExceededModalVisible: state.setStorageExceededModalVisible,
  }));

  const pushDocumentToSourceList = useCallback(
    (data: Document) => {
      if (projectId) {
        setSourceList([
          {
            ...data,
            entityId: data.docId,
            entityType: 'document',
          },
          ...sourceList,
        ]);
      }
    },
    [projectId, sourceList, setSourceList],
  );

  const checkStorageUsage = useCallback(() => {
    if (getAvailableFileCount(storageUsage) <= 0) {
      setStorageExceededModalVisible(true);
      return false;
    }
    return true;
  }, [storageUsage, setStorageExceededModalVisible]);

  const createDocument = useCallback(
    async (title: string, content: string, onSuccess?: () => void) => {
      if (!checkStorageUsage()) {
        return null;
      }

      const parsedContent = parseMarkdownCitationsAndCanvasTags(content, []);

      setIsCreating(true);
      const { data, error } = await getClient().createDocument({
        body: {
          projectId,
          title,
          initialContent: parsedContent,
        },
      });
      setIsCreating(false);

      if (!data?.success || error) {
        return;
      }

      const docId = data?.data?.docId;

      message.success(t('common.putSuccess'));
      onSuccess?.();
      refetchUsage();

      pushDocumentToSourceList(data?.data);

      return docId;
    },
    [checkStorageUsage],
  );

  const debouncedCreateDocument = useDebouncedCallback(
    (title: string, content: string, onSuccess?: () => void) => {
      return createDocument(title, content, onSuccess);
    },
    300,
    { leading: true },
  );

  return {
    createDocument: debouncedCreateDocument,
    isCreating,
  };
};

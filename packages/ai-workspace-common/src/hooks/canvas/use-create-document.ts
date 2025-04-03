import { useCallback, useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { CanvasNodeType } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { useDebouncedCallback } from 'use-debounce';
import { parseMarkdownCitationsAndCanvasTags } from '@refly-packages/utils/parse';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useDocumentStoreShallow } from '@refly-packages/ai-workspace-common/stores/document';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { useSubscriptionStoreShallow } from '@refly-packages/ai-workspace-common/stores/subscription';
import { getAvailableFileCount } from '@refly-packages/utils/quota';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useReactFlow } from '@xyflow/react';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { Document } from '@refly/openapi-schema';

export const useCreateDocument = () => {
  const [isCreating, setIsCreating] = useState(false);
  const { canvasId } = useCanvasContext();
  const { t } = useTranslation();
  const { addNode } = useAddNode();
  const { getNodes } = useReactFlow();
  const { storageUsage, refetchUsage } = useSubscriptionUsage();
  const { projectId } = useGetProjectCanvasId();
  const { sourceList, setSourceList } = useSiderStoreShallow((state) => ({
    sourceList: state.sourceList,
    setSourceList: state.setSourceList,
  }));
  const { setStorageExceededModalVisible } = useSubscriptionStoreShallow((state) => ({
    setStorageExceededModalVisible: state.setStorageExceededModalVisible,
  }));
  const { setDocumentLocalSyncedAt, setDocumentRemoteSyncedAt } = useDocumentStoreShallow(
    (state) => ({
      setDocumentLocalSyncedAt: state.setDocumentLocalSyncedAt,
      setDocumentRemoteSyncedAt: state.setDocumentRemoteSyncedAt,
    }),
  );

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
    async (
      title: string,
      content: string,
      {
        sourceNodeId,
        addToCanvas,
        sourceType,
      }: { sourceNodeId?: string; addToCanvas?: boolean; sourceType?: string },
    ) => {
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
      refetchUsage();

      pushDocumentToSourceList(data?.data);

      if (addToCanvas) {
        const nodes = getNodes();

        // Find the source node
        const sourceNode = nodes.find((n) => n.data?.entityId === sourceNodeId);

        if (!sourceNode) {
          console.warn('Source node not found');
          return null;
        }

        const newNode = {
          type: 'document' as CanvasNodeType,
          data: {
            entityId: docId,
            title,
            contentPreview: parsedContent.slice(0, 500),
          },
        };

        addNode(newNode, [
          {
            type: sourceType as CanvasNodeType,
            entityId: sourceNodeId,
          },
        ]);
      }

      return docId;
    },
    [addNode, canvasId, checkStorageUsage],
  );

  const debouncedCreateDocument = useDebouncedCallback(
    (
      title: string,
      content: string,
      {
        sourceNodeId,
        addToCanvas,
        sourceType,
      }: { sourceNodeId?: string; addToCanvas?: boolean; sourceType?: string },
    ) => {
      return createDocument(title, content, { sourceNodeId, addToCanvas, sourceType });
    },
    300,
    { leading: true },
  );

  const createSingleDocumentInCanvas = useCallback(
    async (position?: { x: number; y: number }) => {
      if (!checkStorageUsage()) {
        return null;
      }

      const title = '';

      setIsCreating(true);
      const { data, error } = await getClient().createDocument({
        body: {
          projectId,
          title,
        },
      });
      setIsCreating(false);

      if (!data?.success || error) {
        return;
      }

      const doc = data?.data;
      const docId = doc?.docId;

      message.success(t('common.putSuccess'));
      pushDocumentToSourceList(doc);
      if (canvasId && canvasId !== 'empty') {
        const newNode = {
          type: 'document' as CanvasNodeType,
          data: {
            title,
            entityId: docId,
            contentPreview: '',
          },
          position: position,
        };

        addNode(newNode, [], true, true);
      }
    },
    [
      checkStorageUsage,
      canvasId,
      addNode,
      t,
      refetchUsage,
      setDocumentLocalSyncedAt,
      setDocumentRemoteSyncedAt,
    ],
  );

  const duplicateDocument = useCallback(
    async (title: string, content: string, sourceDocId: string, metadata?: any) => {
      if (!checkStorageUsage()) {
        return null;
      }

      const newTitle = `${title} ${t('canvas.nodeActions.copy')}`;

      setIsCreating(true);
      const { data, error } = await getClient().createDocument({
        body: {
          projectId,
          title: newTitle,
          initialContent: content,
        },
      });
      setIsCreating(false);

      if (!data?.success || error) {
        return;
      }

      const docId = data?.data?.docId;

      message.success(t('common.putSuccess'));
      pushDocumentToSourceList(data?.data);
      if (canvasId && canvasId !== 'empty') {
        const newNode = {
          type: 'document' as CanvasNodeType,
          data: {
            title: newTitle,
            entityId: docId,
            contentPreview: content.slice(0, 500),
            metadata: {
              ...metadata,
              status: 'finish',
            },
          },
        };

        addNode(newNode, [{ type: 'document', entityId: sourceDocId }], false, true);
      }

      return docId;
    },
    [
      checkStorageUsage,
      canvasId,
      addNode,
      t,
      refetchUsage,
      setDocumentLocalSyncedAt,
      setDocumentRemoteSyncedAt,
    ],
  );

  return {
    createDocument,
    debouncedCreateDocument,
    isCreating,
    createSingleDocumentInCanvas,
    duplicateDocument,
  };
};

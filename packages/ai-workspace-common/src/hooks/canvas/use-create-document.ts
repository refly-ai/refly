import { useCallback, useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useDebouncedCallback } from 'use-debounce';
import { parseMarkdownCitationsAndCanvasTags } from '@refly/utils/parse';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useDocumentStoreShallow } from '@refly/stores';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { useSubscriptionStoreShallow } from '@refly/stores';
import { getAvailableFileCount } from '@refly/utils/quota';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useReactFlow, XYPosition } from '@xyflow/react';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useSiderStoreShallow } from '@refly/stores';
import { CanvasNode, Document } from '@refly/openapi-schema';
import { CanvasNodeFilter } from '@refly/canvas-common';

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
            id: data.docId,
            type: 'document',
            name: data.title,
          },
          ...sourceList,
        ]);
      }
    },
    [projectId, sourceList, setSourceList],
  );

  const checkStorageUsage = useCallback(() => {
    if (storageUsage && getAvailableFileCount(storageUsage) <= 0) {
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
        targetNodeId,
        addToCanvas,
        position,
      }: {
        sourceNodeId?: string;
        targetNodeId?: string;
        addToCanvas?: boolean;
        sourceType?: string;
        position?: XYPosition;
      },
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

      const docId = data?.data?.docId ?? '';

      message.success(t('common.putSuccess'));
      refetchUsage();

      if (data?.data) {
        pushDocumentToSourceList(data.data);
      }

      if (addToCanvas) {
        const nodes = getNodes();

        // Find the source node
        const sourceNode = nodes.find((n) => n.data?.entityId === sourceNodeId);
        const targetNode = nodes.find((n) => n.data?.entityId === targetNodeId);
        const connectTo: CanvasNodeFilter[] = [];

        if (sourceNodeId && sourceNode) {
          connectTo.push({
            type: sourceNode.type as CanvasNodeType,
            entityId: sourceNodeId,
            handleType: 'source',
          });
        }

        if (targetNodeId && targetNode) {
          connectTo.push({
            type: targetNode.type as CanvasNodeType,
            entityId: targetNodeId,
            handleType: 'target',
          });
        }

        if (!sourceNode && !targetNode) {
          console.warn('Source node not found');
          return null;
        }

        const newNode: Partial<CanvasNode> = {
          type: 'document' as CanvasNodeType,
          data: {
            entityId: docId,
            title,
            contentPreview: parsedContent.slice(0, 500),
          },
          position,
        };

        addNode(newNode, connectTo);
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
        targetNodeId,
        addToCanvas,
        sourceType,
        position,
      }: {
        sourceNodeId?: string;
        targetNodeId?: string;
        addToCanvas?: boolean;
        sourceType?: string;
        position?: XYPosition;
      },
    ) => {
      return createDocument(title, content, {
        sourceNodeId,
        targetNodeId,
        addToCanvas,
        sourceType,
        position,
      });
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
      const docId = doc?.docId ?? '';

      message.success(t('common.putSuccess'));
      if (doc) {
        pushDocumentToSourceList(doc);
      }
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
    async (
      title: string,
      content: string,
      metadata?: any,
      nodeInfo?: {
        position?: XYPosition;
        connectTo?: CanvasNodeFilter[];
      },
      onSuccess?: () => void,
    ) => {
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

      const docId = data?.data?.docId ?? '';

      message.success(t('common.putSuccess'));
      if (data?.data) {
        pushDocumentToSourceList(data.data);
      }
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
          position: nodeInfo?.position,
        };
        addNode(newNode, nodeInfo?.connectTo, false, true);

        onSuccess?.();
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

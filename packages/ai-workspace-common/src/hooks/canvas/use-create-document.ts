import { useCallback, useState } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { CanvasNodeType } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { useDebouncedCallback } from 'use-debounce';
import { parseMarkdownCitationsAndCanvasTags } from '@refly-packages/utils/parse';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { genDocumentID } from '@refly-packages/utils/id';
import { parseMarkdown } from '@refly-packages/utils/editor';
import { useDocumentStoreShallow } from '@refly-packages/ai-workspace-common/stores/document';
import { prosemirrorToYXmlFragment } from 'y-prosemirror';
import { useCanvasStore } from '@refly-packages/ai-workspace-common/stores/canvas';

const createLocalDocument = async (docId: string, title: string, content: string) => {
  const ydoc = new Y.Doc();
  const localProvider = new IndexeddbPersistence(docId, ydoc);

  // Wait for local sync
  await new Promise<void>((resolve) => {
    localProvider.once('synced', () => resolve());
  });

  const yTitle = ydoc.getText('title');
  yTitle.insert(0, title);

  const node = parseMarkdown(content);
  prosemirrorToYXmlFragment(node, ydoc.getXmlFragment('default'));
};

export const useCreateDocument = () => {
  const [isCreating, setIsCreating] = useState(false);
  const { canvasId } = useCanvasContext();
  const { t } = useTranslation();
  const { addNode } = useAddNode();

  const { setDocumentLocalSyncedAt, setDocumentRemoteSyncedAt } = useDocumentStoreShallow((state) => ({
    setDocumentLocalSyncedAt: state.setDocumentLocalSyncedAt,
    setDocumentRemoteSyncedAt: state.setDocumentRemoteSyncedAt,
  }));

  const createDocument = useCallback(
    async (
      title: string,
      content: string,
      { sourceNodeId, addToCanvas }: { sourceNodeId?: string; addToCanvas?: boolean },
    ) => {
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];
      const docId = genDocumentID();
      const parsedContent = parseMarkdownCitationsAndCanvasTags(content, []);

      await createLocalDocument(docId, title, parsedContent);

      setDocumentLocalSyncedAt(docId, Date.now());
      setDocumentRemoteSyncedAt(docId, Date.now());

      message.success(t('common.putSuccess'));

      if (addToCanvas) {
        // Find the source node
        const sourceNode = nodes.find((n) => n.type === 'skillResponse' && n.data?.entityId === sourceNodeId);

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
            type: 'skillResponse',
            entityId: sourceNodeId,
          },
        ]);
      }

      return docId;
    },
    [addNode, canvasId],
  );

  const debouncedCreateDocument = useDebouncedCallback(
    (
      title: string,
      content: string,
      { sourceNodeId, addToCanvas }: { sourceNodeId?: string; addToCanvas?: boolean },
    ) => {
      return createDocument(title, content, { sourceNodeId, addToCanvas });
    },
    300,
    { leading: true },
  );

  const createSingleDocumentInCanvas = async (position?: { x: number; y: number }) => {
    const docId = genDocumentID();
    const title = t('common.newDocument');

    await createLocalDocument(docId, title, '');

    setDocumentLocalSyncedAt(docId, Date.now());
    setDocumentRemoteSyncedAt(docId, Date.now());

    message.success(t('common.putSuccess'));

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

      addNode(newNode);
    }
  };

  const duplicateDocument = async (title: string, content: string, sourceDocId: string, metadata?: any) => {
    const docId = genDocumentID();
    const newTitle = `${title} ${t('canvas.nodeActions.copy')}`;

    await createLocalDocument(docId, newTitle, content);

    setDocumentLocalSyncedAt(docId, Date.now());
    setDocumentRemoteSyncedAt(docId, Date.now());

    message.success(t('common.putSuccess'));

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
  };

  return { createDocument, debouncedCreateDocument, isCreating, createSingleDocumentInCanvas, duplicateDocument };
};

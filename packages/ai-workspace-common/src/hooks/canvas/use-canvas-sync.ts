import { useMemo } from 'react';
import { useCanvasContext } from '../../context/canvas';
import { useThrottledCallback } from 'use-debounce';
import { Edge } from '@xyflow/react';
import { UndoManager } from 'yjs';
import { omit } from '@refly/utils';
import { purgeContextItems, CanvasNode } from '@refly/canvas-common';
import { isDesktop } from '@refly-packages/ai-workspace-common/utils/env';

export const useCanvasSync = () => {
  const { provider } = useCanvasContext();
  const ydoc = provider?.document;

  const undoManager = useMemo(() => {
    if (!ydoc) return null;

    // Create UndoManager tracking title, nodes and edges
    return new UndoManager(
      [ydoc.getText('title'), ydoc.getArray('nodes'), ydoc.getArray('edges')],
      {
        captureTimeout: 1000,
      },
    );
  }, [ydoc]);

  const syncFunctions = useMemo(() => {
    const isProviderActive = () => {
      return ydoc && (provider?.status === 'connected' || isDesktop());
    };

    const safeTransaction = (transactionFn: () => void) => {
      if (!isProviderActive()) return;

      try {
        ydoc?.transact(transactionFn);
      } catch (error) {
        // Log the error but don't crash the application
        console.error('Transaction error:', error);

        // If we get an InvalidStateError, we could implement reconnection logic here
        if (error instanceof DOMException && error.name === 'InvalidStateError') {
          console.warn('Database connection is closing. Transaction aborted.');
        }
      }
    };

    const syncTitleToYDoc = (title: string) => {
      safeTransaction(() => {
        const yTitle = ydoc?.getText('title');
        if (!yTitle) return;

        yTitle.delete(0, yTitle.length ?? 0);
        yTitle.insert(0, title);
      });
    };

    const syncNodesToYDoc = (nodes: CanvasNode<any>[]) => {
      const nodesToSync = nodes || [];

      // Purge context items from nodes
      const purgedNodes = nodesToSync.map((node) => ({
        ...node,
        data: {
          ...node.data,
          metadata: {
            ...node.data?.metadata,
            contextItems: purgeContextItems(node.data?.metadata?.contextItems),
          },
        },
      }));

      safeTransaction(() => {
        const yNodes = ydoc?.getArray('nodes');
        if (!yNodes) return;

        yNodes.delete(0, yNodes.length ?? 0);
        yNodes.push(purgedNodes);
      });
    };

    const syncEdgesToYDoc = (edges: Edge[]) => {
      if (!edges?.length) return;

      safeTransaction(() => {
        const yEdges = ydoc?.getArray('edges');
        if (!yEdges) return;

        yEdges.delete(0, yEdges.length ?? 0);
        yEdges.push(edges.map((edge) => omit(edge, ['style'])));
      });
    };

    return {
      syncTitleToYDoc,
      syncNodesToYDoc,
      syncEdgesToYDoc,
    };
  }, [ydoc, provider]);

  const throttledSyncNodesToYDoc = useThrottledCallback(syncFunctions.syncNodesToYDoc, 500, {
    leading: true,
    trailing: true,
  });

  const throttledSyncEdgesToYDoc = useThrottledCallback(syncFunctions.syncEdgesToYDoc, 500, {
    leading: true,
    trailing: true,
  });

  return {
    ...syncFunctions,
    throttledSyncNodesToYDoc,
    throttledSyncEdgesToYDoc,
    undoManager,
  };
};

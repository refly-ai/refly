import React, { useCallback } from 'react';
import { message } from 'antd';
import { useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import DeleteNodeMessageContent from '../../components/message/delete-node-message';

interface DeleteNodeOptions {
  showMessage?: boolean;
}

export const useDeleteNode = () => {
  const { setNodes, setEdges } = useReactFlow();
  const { t } = useTranslation();

  const deleteSingleNode = useCallback(
    (node: CanvasNode<any>, options: DeleteNodeOptions = {}) => {
      const { showMessage = true } = options;

      // Delete node from canvas
      setNodes((nodes) => nodes.filter((n) => n.id !== node.id));

      // Delete connected edges
      setEdges((edges) => edges.filter((e) => e.source !== node.id && e.target !== node.id));

      if (showMessage) {
        // Get node title based on node type
        const nodeTitle = node.data?.title ?? t('knowledgeBase.context.untitled');

        // Show success message
        message.success({
          content: React.createElement(DeleteNodeMessageContent, {
            title: nodeTitle || t('common.untitled'),
            action: t('knowledgeBase.context.deleteSuccessWithTitle', {
              type: t(`canvas.nodeTypes.${node.type}`),
            }),
          }),
          key: 'delete-success',
        });
      }

      return true;
    },
    [setNodes, setEdges, t],
  );

  const deleteNodes = useCallback(
    (nodes: CanvasNode[], options: DeleteNodeOptions = {}) => {
      // Delete each node
      const results = nodes.map((node) => deleteSingleNode(node, { ...options }));

      return results.filter(Boolean).length; // Return number of successfully deleted nodes
    },
    [deleteSingleNode],
  );

  return {
    deleteNode: deleteSingleNode,
    deleteNodes,
  };
};

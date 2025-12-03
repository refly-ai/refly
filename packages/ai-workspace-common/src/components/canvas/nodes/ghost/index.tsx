import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from 'antd';
import {
  createNodeEventName,
  nodeActionEmitter,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { CanvasNode, CanvasNodeData } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { AiChat } from 'refly-icons';
import { XYPosition } from '@xyflow/react';

export const GhostNode = React.memo(({ id, data }: { id: string; data: CanvasNodeData }) => {
  const { getNode, getEdges } = useReactFlow();
  const { deleteNode } = useDeleteNode();
  const { t } = useTranslation();
  const position = useMemo(
    () => (data?.metadata?.position as XYPosition) ?? undefined,
    [data?.metadata?.position],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceId = useMemo(
    () => getEdges().find((edge) => edge.target === id)?.source,
    [id, getEdges],
  );
  const sourceNode = useMemo(() => getNode(sourceId), [sourceId, getNode]);
  const currentNode = useMemo(() => getNode(id), [id, getNode]) as CanvasNode;

  const close = useCallback(() => {
    deleteNode(currentNode, { showMessage: false });
  }, [currentNode, deleteNode]);

  const dragCreateInfo = useMemo(
    () => ({
      nodeId: sourceNode?.id,
      handleType: 'source' as const,
      position: position,
    }),
    [sourceNode?.id, position],
  );

  const handleAskAI = useCallback(() => {
    nodeActionEmitter.emit(createNodeEventName(sourceNode.id, 'askAI'), { dragCreateInfo });
    close();
  }, [close, dragCreateInfo, sourceNode?.id]);

  const menuItems = useMemo(() => {
    return [
      {
        key: 'askAI',
        icon: AiChat,
        label: t('canvas.nodeActions.askAI'),
        onClick: handleAskAI,
      },
    ];
  }, [handleAskAI, t]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    if (containerRef.current) {
      // Use capture phase to ensure we catch all events before they can be stopped
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [close, dragCreateInfo]);

  return (
    <div className="relative bg-refly-bg-float-z3 rounded-lg shadow-refly-m" ref={containerRef}>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!bg-transparent !border-gray-300 !w-3 !h-3 opacity-0"
      />
      {menuItems.map((item) => {
        const button = (
          <Button
            key={item.key}
            className={`
              w-full
              h-auto
              flex
              items-center
              justify-start
              px-4
              py-2
              rounded-lg
              text-sm
              transition-colors
              text-refly-text-0
              hover:!bg-refly-tertiary-hover
            `}
            type="text"
            onClick={item.onClick}
          >
            {item.icon ? <item.icon size={20} /> : undefined}
            {item.label}
          </Button>
        );

        return <div key={item.key}>{button}</div>;
      })}
    </div>
  );
});

GhostNode.displayName = 'GhostNode';

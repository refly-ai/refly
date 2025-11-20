import { FC, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { NodeActionMenu } from '../node-action-menu';
import { CanvasNodeType } from '@refly/openapi-schema';
import {
  NodeContextMenuSource,
  NodeDragCreateInfo,
} from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { CreateNodeMenu } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/create-node-menu';

interface NodeContextMenuProps {
  open: boolean;
  position: { x: number; y: number };
  nodeId: string;
  nodeType: CanvasNodeType;
  source?: NodeContextMenuSource;
  dragCreateInfo?: NodeDragCreateInfo;
  setOpen: (open: boolean) => void;
}

export const NodeContextMenu: FC<NodeContextMenuProps> = ({
  open,
  position,
  nodeId,
  nodeType,
  source,
  dragCreateInfo,
  setOpen,
}) => {
  const reactFlowInstance = useReactFlow();
  const { setNodes, setEdges } = useReactFlow();
  const menuRef = useRef<HTMLDivElement>(null);

  // Clean up ghost nodes when menu closes
  const handleClose = () => {
    setNodes((nodes) => nodes.filter((node) => !node.id.startsWith('ghost-')));
    setEdges((edges) => edges.filter((edge) => !edge.id.startsWith('temp-edge-')));
    setOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    if (open) {
      // Use capture phase to ensure we catch all events before they can be stopped
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, dragCreateInfo, setNodes, setEdges]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] rounded-lg bg-refly-bg-float-z3 shadow-refly-m"
      style={{
        left: `${reactFlowInstance.flowToScreenPosition(position).x}px`,
        top: `${reactFlowInstance.flowToScreenPosition(position).y}px`,
      }}
      onClick={(e) => {
        // Only stop propagation, don't prevent default to allow button clicks
        e.stopPropagation();
      }}
    >
      {source === 'handle' ? (
        <CreateNodeMenu
          nodeId={nodeId}
          nodeType={nodeType}
          onClose={handleClose}
          dragCreateInfo={dragCreateInfo}
        />
      ) : (
        <NodeActionMenu nodeId={nodeId} nodeType={nodeType} onClose={handleClose} />
      )}
    </div>
  );
};

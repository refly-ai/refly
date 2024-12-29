import { FC, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { NodeActionMenu } from '../node-action-menu';
import { CanvasNodeType } from '@refly/openapi-schema';

interface NodeContextMenuProps {
  open: boolean;
  position: { x: number; y: number };
  nodeId: string;
  nodeType: CanvasNodeType;
  setOpen: (open: boolean) => void;
}

export const NodeContextMenu: FC<NodeContextMenuProps> = ({ open, position, nodeId, nodeType, setOpen }) => {
  const reactFlowInstance = useReactFlow();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999]"
      style={{
        left: `${reactFlowInstance.flowToScreenPosition(position).x}px`,
        top: `${reactFlowInstance.flowToScreenPosition(position).y}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <NodeActionMenu nodeId={nodeId} nodeType={nodeType} onClose={() => setOpen(false)} />
    </div>
  );
};

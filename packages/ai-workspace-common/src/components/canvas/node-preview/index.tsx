import { CanvasNode } from '../nodes/types';
import { SkillResponseNodePreview } from './skill-response';
import { ToolResponseNodePreview } from './tool-response';
import { ResourceNodePreview } from './resource';
import { SkillNodePreview } from './skill';
import { ToolNodePreview } from './tool';
import { DocumentNodePreview } from './document';
import { NodePreviewHeader } from './node-preview-header';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useCanvasControl } from '@refly-packages/ai-workspace-common/hooks/use-canvas-control';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
export const NodePreview = ({
  node,
  canvasId,
  isPinned,
  selected,
}: {
  node: CanvasNode<any>;
  canvasId: string;
  isPinned: boolean;
  selected: boolean;
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const { onNodesChange } = useCanvasControl();
  const { addPinnedNode, removePinnedNode } = useCanvasStoreShallow((state) => ({
    addPinnedNode: state.addPinnedNode,
    removePinnedNode: state.removePinnedNode,
  }));

  const unselectNode = useCallback(
    (node: CanvasNode<any>) => {
      onNodesChange([
        {
          id: node.id,
          type: 'select',
          selected: false,
        },
      ]);
    },
    [onNodesChange],
  );

  const handlePin = useCallback(() => {
    if (isPinned) {
      removePinnedNode(canvasId, node);
    } else {
      addPinnedNode(canvasId, node);
    }
  }, [node, addPinnedNode, removePinnedNode, isPinned]);

  const handleClose = useCallback(() => {
    if (isPinned) {
      removePinnedNode(canvasId, node);
    }
    unselectNode(node);
  }, [node, removePinnedNode, isPinned, unselectNode]);

  const previewComponent = useMemo(() => {
    if (!node?.type) return null;

    switch (node.type) {
      case 'resource':
        return <ResourceNodePreview resourceId={node.data.entityId} />;
      case 'document':
        return (
          <DocumentNodePreview
            nodeData={{
              entityId: node.data?.entityId,
              entityType: 'document',
            }}
          />
        );
      case 'skill':
        return <SkillNodePreview />;
      case 'tool':
        return <ToolNodePreview />;
      case 'skillResponse':
        return <SkillResponseNodePreview resultId={node.data.entityId} />;
      case 'toolResponse':
        return <ToolResponseNodePreview resultId={node.data.entityId} />;
      default:
        return null;
    }
  }, [node?.type, node?.data?.entityId]);

  const previewStyles = useMemo(
    () => ({
      height: isMaximized ? '100vh' : 'calc(100vh - 72px)',
      width: isMaximized ? 'calc(100vw)' : '420px',
      top: isMaximized ? 0 : null,
      right: isMaximized ? 0 : null,
      zIndex: isMaximized ? 50 : 10,
      transition: isMaximized ? 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)' : 'all 50ms cubic-bezier(0.4, 0, 0.2, 1)',
    }),
    [isMaximized],
  );

  const previewClassName = useMemo(
    () => `
    bg-white 
    rounded-lg 
    border
    border-[rgba(16,24,40,0.0784)]
    shadow-[0px_4px_6px_0px_rgba(16,24,40,0.03)]
    will-change-transform
    ${isMaximized ? 'fixed' : ''}
  `,
    [isMaximized],
  );

  useEffect(() => {
    if (isPinned && selected) {
      setTimeout(() => {
        previewRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'end',
        });
      }, 100);
    }
  }, [selected]);

  return (
    <div className="pointer-events-none" ref={previewRef}>
      <div className={previewClassName} style={previewStyles}>
        <div className="pointer-events-auto">
          <NodePreviewHeader
            node={node}
            onClose={handleClose}
            onPin={handlePin}
            onMaximize={() => setIsMaximized(!isMaximized)}
            isPinned={isPinned}
            isMaximized={isMaximized}
          />
        </div>
        <div className="h-[calc(100%-52px)] overflow-auto rounded-b-lg pointer-events-auto preview-container">
          {previewComponent}
        </div>
      </div>
    </div>
  );
};

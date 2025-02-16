import { CanvasNode } from '../nodes/shared/types';
import { SkillResponseNodePreview } from './skill-response';
import { ResourceNodePreview } from './resource';
import { SkillNodePreview } from './skill';
import { ToolNodePreview } from './tool';
import { DocumentNodePreview } from './document';
import { NodePreviewHeader } from './node-preview-header';
import { useState, useMemo, useCallback, useRef, memo } from 'react';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';

const PreviewComponent = memo(
  ({ node }: { node: CanvasNode<any> }) => {
    if (!node?.type) return null;

    switch (node.type) {
      case 'resource':
        return <ResourceNodePreview resourceId={node.data.entityId} nodeId={node.id} />;
      case 'document':
        return (
          <DocumentNodePreview
            nodeData={{
              entityId: node.data?.entityId,
              entityType: 'document',
              node: node,
            }}
          />
        );
      case 'skill':
        return <SkillNodePreview />;
      case 'tool':
        return <ToolNodePreview />;
      case 'skillResponse':
        return <SkillResponseNodePreview node={node} resultId={node.data.entityId} />;
      default:
        return null;
    }
  },
  (prevProps, nextProps) => {
    return (
      prevProps.node?.type === nextProps.node?.type &&
      prevProps.node?.data?.entityId === nextProps.node?.data?.entityId
    );
  },
);

export const NodePreview = memo(
  ({ node, canvasId }: { node: CanvasNode<any>; canvasId: string }) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);

    const { removePinnedNode } = useCanvasStoreShallow((state) => ({
      removePinnedNode: state.removeNodePreview,
    }));

    const handleClose = useCallback(() => {
      removePinnedNode(canvasId, node.id);
    }, [node, removePinnedNode, canvasId]);

    const previewStyles = useMemo(
      () => ({
        height: isMaximized ? '100vh' : 'calc(100vh - 72px)',
        width: isMaximized ? 'calc(100vw)' : '420px',
        top: isMaximized ? 0 : null,
        right: isMaximized ? 0 : null,
        zIndex: isMaximized ? 50 : 10,
        transition: isMaximized
          ? 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
          : 'all 50ms cubic-bezier(0.4, 0, 0.2, 1)',
      }),
      [isMaximized],
    );

    const previewClassName = useMemo(
      () => `
    bg-white 
    rounded-lg 
    will-change-transform
    ${isMaximized ? 'fixed' : ''}
  `,
      [isMaximized],
    );

    const handleMaximize = useCallback(() => {
      setIsMaximized(!isMaximized);
    }, [isMaximized]);

    return (
      <div
        data-preview-id={node?.id}
        className="pointer-events-none border border-solid border-gray-100 rounded-lg shadow-lg bg-transparent"
        ref={previewRef}
      >
        <div className={previewClassName} style={previewStyles}>
          <div className="pointer-events-auto">
            <NodePreviewHeader
              node={node}
              onClose={handleClose}
              onMaximize={handleMaximize}
              isMaximized={isMaximized}
            />
          </div>
          <div className="h-[calc(100%-52px)] overflow-auto rounded-b-lg pointer-events-auto preview-container">
            <PreviewComponent node={node} />
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.node?.id === nextProps.node?.id &&
      prevProps.canvasId === nextProps.canvasId &&
      prevProps.node?.data?.metadata?.rawFileKey === nextProps.node?.data?.metadata?.rawFileKey
    );
  },
);

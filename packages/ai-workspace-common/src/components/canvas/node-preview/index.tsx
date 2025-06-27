import { CanvasNode } from '@refly/canvas-common';
import { ResourceNodePreview } from './resource';
import { SkillNodePreview } from './skill';
import { ToolNodePreview } from './tool';
import { DocumentNodePreview } from './document';
import { NodePreviewHeader } from './node-preview-header';
import { useState, useMemo, useCallback, useRef, memo, useEffect } from 'react';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { CodeArtifactNodePreview } from './code-artifact';
import { WebsiteNodePreview } from './website';
import { fullscreenEmitter } from '@refly-packages/ai-workspace-common/events/fullscreen';
import {
  nodeActionEmitter,
  createNodeEventName,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useDrag, useDrop, DndProvider, XYCoord } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import withScrolling, { createHorizontalStrength } from 'react-dnd-scrolling';
import { getFreshNodePreviews } from '@refly-packages/ai-workspace-common/utils/canvas';
import { Slideshow } from '@refly-packages/ai-workspace-common/components/canvas/slideshow';
import { EnhancedSkillResponse } from './skill-response/enhanced-skill-response';
import { useReactFlow } from '@xyflow/react';
import { useSearchParams } from 'react-router-dom';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { preloadMonacoEditor } from '@refly-packages/ai-workspace-common/modules/artifacts/code-runner/monaco-editor/monacoPreloader';
import { LinearThreadContainer } from '@refly-packages/ai-workspace-common/components/canvas/linear-thread';

// DnD item type constant
const ITEM_TYPE = 'node-preview';

// Create a scrolling component with enhanced horizontal sensitivity
const ScrollingComponent = withScrolling('div');
const horizontalStrength = createHorizontalStrength(250);

// DnD item interface
interface DragItem {
  id: string;
  index: number;
}

const PreviewComponent = memo(
  ({ node }: { node: CanvasNode<any> }) => {
    if (!node?.type) return null;

    // Use useMemo to create the appropriate preview component
    return useMemo(() => {
      switch (node.type) {
        case 'resource':
          return <ResourceNodePreview node={node} resourceId={node.data?.entityId} />;
        case 'document':
          return <DocumentNodePreview node={node} />;
        case 'skill':
          return <SkillNodePreview node={node} />;
        case 'tool':
          return <ToolNodePreview />;
        case 'skillResponse':
          return <EnhancedSkillResponse node={node} resultId={node.data?.entityId} />;
        case 'codeArtifact':
          return <CodeArtifactNodePreview nodeId={node.id} />;
        case 'website':
          return <WebsiteNodePreview nodeId={node.id} />;
        default:
          return null;
      }
    }, [
      node.type,
      node.data?.entityId,
      node.data?.contentPreview,
      node.data?.title,
      node.data?.metadata?.status,
      node.data?.metadata?.activeTab,
      node.data?.metadata?.url,
      node.data?.metadata?.viewMode,
    ]);
  },
  (prevProps, nextProps) => {
    // Check type and entity ID
    const basicPropsEqual =
      prevProps.node?.type === nextProps.node?.type &&
      prevProps.node?.data?.entityId === nextProps.node?.data?.entityId;

    if (!basicPropsEqual) return false;

    // Check content preview
    const contentEqual =
      prevProps.node?.data?.contentPreview === nextProps.node?.data?.contentPreview;

    // Check title
    const titleEqual = prevProps.node?.data?.title === nextProps.node?.data?.title;

    // Check metadata status (for generating state)
    const statusEqual =
      prevProps.node?.data?.metadata?.status === nextProps.node?.data?.metadata?.status;

    // Check node-specific metadata
    let nodeSpecificEqual = true;
    if (prevProps.node?.type === 'codeArtifact') {
      nodeSpecificEqual =
        prevProps.node?.data?.metadata?.activeTab === nextProps.node?.data?.metadata?.activeTab;
    } else if (prevProps.node?.type === 'website') {
      nodeSpecificEqual =
        prevProps.node?.data?.metadata?.url === nextProps.node?.data?.metadata?.url &&
        prevProps.node?.data?.metadata?.viewMode === nextProps.node?.data?.metadata?.viewMode;
    }

    return basicPropsEqual && contentEqual && titleEqual && statusEqual && nodeSpecificEqual;
  },
);

export const DraggableNodePreview = memo(
  ({
    node,
    canvasId,
    index,
    moveCard,
  }: {
    node: CanvasNode<any>;
    canvasId: string;
    index: number;
    moveCard: (dragIndex: number, hoverIndex: number) => void;
  }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [isMaximized, setIsMaximized] = useState(() => {
      return searchParams.get('isMaximized') === 'true';
    });
    const [isWideMode, setIsWideMode] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<HTMLDivElement>(null);

    // Add ESC key handler to exit fullscreen
    useEffect(() => {
      const handleEscKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && isMaximized) {
          setIsMaximized(false);
          searchParams.delete('isMaximized');
          setSearchParams(searchParams);
        }
      };

      document.addEventListener('keydown', handleEscKey);

      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }, [isMaximized]);

    const { removePinnedNode } = useCanvasStoreShallow((state) => ({
      removePinnedNode: state.removeNodePreview,
    }));

    const handleClose = useCallback(() => {
      removePinnedNode(canvasId, node.id);
      searchParams.delete('isMaximized');
      setSearchParams(searchParams);
    }, [node.id, removePinnedNode, canvasId]);

    useEffect(() => {
      const handleFullScreenPreview = () => {
        setIsMaximized(true);
        searchParams.set('isMaximized', 'true');
        setSearchParams(searchParams);
      };

      const eventName = createNodeEventName(node.id, 'fullScreenPreview');
      nodeActionEmitter.on(eventName, handleFullScreenPreview);

      return () => {
        nodeActionEmitter.off(eventName, handleFullScreenPreview);
      };
    }, [node.id]);

    const previewStyles = useMemo(
      () => ({
        height: isMaximized ? '100vh' : 'calc(100vh - 72px)',
        width: isMaximized ? 'calc(100vw)' : isWideMode ? '840px' : '420px',
        top: isMaximized ? 0 : null,
        right: isMaximized ? 0 : null,
        zIndex: isMaximized ? 50 : 10,
        transition: isMaximized
          ? 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
          : 'all 50ms cubic-bezier(0.4, 0, 0.2, 1)',
      }),
      [isMaximized, isWideMode],
    );

    const previewClassName = useMemo(
      () => `
    bg-white dark:bg-gray-900
    rounded-lg 
    will-change-transform
    ${isMaximized ? 'fixed' : ''}
  `,
      [isMaximized],
    );

    const handleMaximize = useCallback(() => {
      const newIsMaximized = !isMaximized;
      setIsMaximized(newIsMaximized);
      if (newIsMaximized) {
        searchParams.set('isMaximized', 'true');
      } else {
        searchParams.delete('isMaximized');
      }
      setSearchParams(searchParams);
    }, [isMaximized]);

    const handleWideMode = useCallback(() => {
      setIsWideMode(!isWideMode);
    }, [isWideMode]);

    // Listen for exitFullscreenForFix event
    useEffect(() => {
      const handleExitFullscreenForFix = (data: { nodeId: string }) => {
        // Only exit fullscreen if this is the node requesting the fix
        if (data.nodeId === node.id && isMaximized) {
          setIsMaximized(false);
        }
      };

      fullscreenEmitter.on('exitFullscreenForFix', handleExitFullscreenForFix);

      return () => {
        fullscreenEmitter.off('exitFullscreenForFix', handleExitFullscreenForFix);
      };
    }, [node.id, isMaximized]);

    // Setup drag
    const [{ isDragging }, drag, preview] = useDrag({
      type: ITEM_TYPE,
      item: useMemo(() => ({ id: node.id, index }), [node.id, index]),
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
      canDrag: () => !isMaximized, // Prevent dragging when maximized
    });

    // Memoize hover handler for better performance
    const handleHover = useCallback(
      (item: DragItem, monitor) => {
        if (!previewRef.current) return;

        const dragIndex = item.index;
        const hoverIndex = index;

        // Don't replace items with themselves
        if (dragIndex === hoverIndex) return;

        // Determine mouse position
        const hoverBoundingRect = previewRef.current.getBoundingClientRect();
        const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
        const clientOffset = monitor.getClientOffset();
        const hoverClientX = (clientOffset as XYCoord).x - hoverBoundingRect.left;

        // Only perform the move when the mouse has crossed half of the items width
        // Dragging right to left
        if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) return;

        // Dragging left to right
        if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) return;

        // Time to actually perform the action
        moveCard(dragIndex, hoverIndex);

        // Update the index for performance
        item.index = hoverIndex;
      },
      [index, moveCard],
    );

    // Setup drop
    const [, drop] = useDrop({
      accept: ITEM_TYPE,
      hover: handleHover,
    });

    // Connect the refs
    drag(dragRef);
    drop(preview(previewRef));

    // Memoize container styles
    const containerStyle = useMemo(() => ({ opacity: isDragging ? 0.4 : 1 }), [isDragging]);

    // Memoize NodePreviewHeader props to prevent unnecessary re-renders
    const headerProps = useMemo(
      () => ({
        node,
        onClose: handleClose,
        onMaximize: handleMaximize,
        onWideMode: handleWideMode,
        isMaximized,
        isWideMode,
        dragHandleProps: { ref: dragRef },
        isDragging,
      }),
      [
        node,
        node.data?.title,
        handleClose,
        handleMaximize,
        handleWideMode,
        isMaximized,
        isWideMode,
        isDragging,
      ],
    );

    // Memoize PreviewComponent to prevent unnecessary re-renders
    const previewComponent = useMemo(() => <PreviewComponent node={node} />, [node]);

    return (
      <div
        data-preview-id={node?.id}
        className="pointer-events-none border border-solid border-gray-100 rounded-lg bg-transparent dark:border-gray-800"
        ref={previewRef}
        style={containerStyle}
      >
        <div className={previewClassName} style={previewStyles}>
          <div ref={dragRef} className="pointer-events-auto">
            <NodePreviewHeader {...headerProps} />
          </div>
          <div className="h-[calc(100%-48px)] overflow-auto rounded-b-lg pointer-events-auto preview-container">
            {previewComponent}
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    const basicPropsEqual =
      prevProps.node?.id === nextProps.node?.id &&
      prevProps.canvasId === nextProps.canvasId &&
      prevProps.index === nextProps.index;

    if (!basicPropsEqual) return false;

    const contentEqual =
      prevProps.node?.data?.contentPreview === nextProps.node?.data?.contentPreview;

    const titleEqual = prevProps.node?.data?.title === nextProps.node?.data?.title;

    const statusEqual =
      prevProps.node?.data?.metadata?.status === nextProps.node?.data?.metadata?.status;

    // Check node-specific metadata
    let nodeSpecificEqual = true;
    if (prevProps.node?.type === 'codeArtifact') {
      nodeSpecificEqual =
        prevProps.node?.data?.metadata?.activeTab === nextProps.node?.data?.metadata?.activeTab;
    } else if (prevProps.node?.type === 'website') {
      nodeSpecificEqual =
        prevProps.node?.data?.metadata?.url === nextProps.node?.data?.metadata?.url &&
        prevProps.node?.data?.metadata?.viewMode === nextProps.node?.data?.metadata?.viewMode;
    }

    return basicPropsEqual && contentEqual && titleEqual && statusEqual && nodeSpecificEqual;
  },
);

export const NodePreviewContainer = memo(
  ({
    canvasId,
    nodes,
  }: {
    canvasId: string;
    nodes: CanvasNode<any>[];
  }) => {
    const { readonly } = useCanvasContext();
    const { getNodes } = useReactFlow<CanvasNode<any>>();
    const { showLinearThread, rawNodePreviews, reorderNodePreviews, showSlideshow } =
      useCanvasStoreShallow((state) => ({
        showLinearThread: state.showLinearThread,
        rawNodePreviews: state.config[canvasId]?.nodePreviews ?? [],
        reorderNodePreviews: state.reorderNodePreviews,
        showSlideshow: state.showSlideshow,
      }));

    useEffect(() => {
      preloadMonacoEditor();
    }, []);

    // Compute fresh node previews using the utility function
    const nodePreviews = useMemo(() => {
      // Prefer flowNodes from ReactFlow but fall back to canvas store nodes
      const nodesSource = nodes?.length > 0 ? nodes : getNodes();

      return getFreshNodePreviews(nodesSource, rawNodePreviews);
    }, [nodes, rawNodePreviews, canvasId]);

    const moveCard = useCallback(
      (dragIndex: number, hoverIndex: number) => {
        reorderNodePreviews(canvasId, dragIndex, hoverIndex);
      },
      [canvasId, reorderNodePreviews],
    );

    // Memoize rendering of node previews
    const nodePreviewsRendered = useMemo(() => {
      return nodePreviews
        ?.filter(Boolean)
        ?.map((node, index) => (
          <DraggableNodePreview
            key={node?.id}
            node={node}
            canvasId={canvasId}
            index={index}
            moveCard={moveCard}
          />
        ));
    }, [nodePreviews, canvasId, moveCard]);

    // Memoize ScrollingComponent props
    const scrollingComponentProps = useMemo(
      () => ({
        horizontalStrength,
        verticalStrength: () => 0,
        className: 'flex flex-row gap-2 overflow-x-auto w-full h-full',
      }),
      [],
    );

    return (
      <DndProvider backend={HTML5Backend}>
        <div className="flex h-full w-full">
          <ScrollingComponent {...scrollingComponentProps}>
            {showSlideshow && !readonly && <Slideshow canvasId={canvasId} />}
            {showLinearThread && <LinearThreadContainer />}
            {nodePreviewsRendered}
          </ScrollingComponent>
        </div>
      </DndProvider>
    );
  },
  (prevProps, nextProps) => prevProps.canvasId === nextProps.canvasId,
);

// Maintain the original NodePreview component for backward compatibility,
// but use the draggable container internally
export const NodePreview = memo(
  ({ node, canvasId }: { node: CanvasNode<any>; canvasId: string }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [isMaximized, setIsMaximized] = useState(() => {
      return searchParams.get('isMaximized') === 'true';
    });
    const [isWideMode, setIsWideMode] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);

    // Add ESC key handler to exit fullscreen
    useEffect(() => {
      const handleEscKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && isMaximized) {
          setIsMaximized(false);
          searchParams.delete('isMaximized');
          setSearchParams(searchParams);
        }
      };

      document.addEventListener('keydown', handleEscKey);

      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }, [isMaximized]);

    const { removePinnedNode } = useCanvasStoreShallow((state) => ({
      removePinnedNode: state.removeNodePreview,
    }));

    const handleClose = useCallback(() => {
      removePinnedNode(canvasId, node.id);
      searchParams.delete('isMaximized');
      setSearchParams(searchParams);
    }, [node.id, removePinnedNode, canvasId]);

    useEffect(() => {
      const handleFullScreenPreview = () => {
        setIsMaximized(true);
        searchParams.set('isMaximized', 'true');
        setSearchParams(searchParams);
      };

      const eventName = createNodeEventName(node.id, 'fullScreenPreview');
      nodeActionEmitter.on(eventName, handleFullScreenPreview);

      return () => {
        nodeActionEmitter.off(eventName, handleFullScreenPreview);
      };
    }, [node.id]);

    const previewStyles = useMemo(
      () => ({
        height: isMaximized ? '100vh' : 'calc(100vh - 72px)',
        width: isMaximized ? 'calc(100vw)' : isWideMode ? '840px' : '420px',
        top: isMaximized ? 0 : null,
        right: isMaximized ? 0 : null,
        zIndex: isMaximized ? 50 : 10,
        transition: isMaximized
          ? 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
          : 'all 50ms cubic-bezier(0.4, 0, 0.2, 1)',
      }),
      [isMaximized, isWideMode],
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
      const newIsMaximized = !isMaximized;
      setIsMaximized(newIsMaximized);
      if (newIsMaximized) {
        searchParams.set('isMaximized', 'true');
      } else {
        searchParams.delete('isMaximized');
      }
      setSearchParams(searchParams);
    }, [isMaximized]);

    const handleWideMode = useCallback(() => {
      setIsWideMode(!isWideMode);
    }, [isWideMode]);

    // Listen for exitFullscreenForFix event
    useEffect(() => {
      const handleExitFullscreenForFix = (data: { nodeId: string }) => {
        // Only exit fullscreen if this is the node requesting the fix
        if (data.nodeId === node.id && isMaximized) {
          setIsMaximized(false);
        }
      };

      fullscreenEmitter.on('exitFullscreenForFix', handleExitFullscreenForFix);

      return () => {
        fullscreenEmitter.off('exitFullscreenForFix', handleExitFullscreenForFix);
      };
    }, [node.id, isMaximized]);

    // Memoize NodePreviewHeader props to prevent unnecessary re-renders
    const headerProps = useMemo(
      () => ({
        node,
        onClose: handleClose,
        onMaximize: handleMaximize,
        onWideMode: handleWideMode,
        isMaximized,
        isWideMode,
      }),
      [node, handleClose, handleMaximize, handleWideMode, isMaximized, isWideMode],
    );

    // Memoize PreviewComponent to prevent unnecessary re-renders
    const previewComponent = useMemo(() => <PreviewComponent node={node} />, [node]);

    return (
      <div
        data-preview-id={node?.id}
        className="pointer-events-none border border-solid border-gray-100 rounded-lg shadow-lg bg-transparent"
        ref={previewRef}
      >
        <div className={previewClassName} style={previewStyles}>
          <div className="pointer-events-auto">
            <NodePreviewHeader {...headerProps} />
          </div>
          <div className="h-[calc(100%-48px)] overflow-auto rounded-b-lg pointer-events-auto preview-container">
            {previewComponent}
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    const basicPropsEqual =
      prevProps.node?.id === nextProps.node?.id && prevProps.canvasId === nextProps.canvasId;

    if (!basicPropsEqual) return false;

    const contentEqual =
      prevProps.node?.data?.contentPreview === nextProps.node?.data?.contentPreview;

    const titleEqual = prevProps.node?.data?.title === nextProps.node?.data?.title;

    const statusEqual =
      prevProps.node?.data?.metadata?.status === nextProps.node?.data?.metadata?.status;

    // Check node-specific metadata
    let nodeSpecificEqual = true;
    if (prevProps.node?.type === 'codeArtifact') {
      nodeSpecificEqual =
        prevProps.node?.data?.metadata?.activeTab === nextProps.node?.data?.metadata?.activeTab;
    } else if (prevProps.node?.type === 'website') {
      nodeSpecificEqual =
        prevProps.node?.data?.metadata?.url === nextProps.node?.data?.metadata?.url &&
        prevProps.node?.data?.metadata?.viewMode === nextProps.node?.data?.metadata?.viewMode;
    }

    return basicPropsEqual && contentEqual && titleEqual && statusEqual && nodeSpecificEqual;
  },
);

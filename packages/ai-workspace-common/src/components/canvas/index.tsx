import { useCallback, useMemo, useEffect, useState, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReactFlow,
  Background,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  Node,
  Edge,
  useStoreApi,
} from '@xyflow/react';
import { nodeTypes, CanvasNode } from './nodes';
import { LaunchPad } from './launchpad';
import { CanvasToolbar } from './canvas-toolbar';
import { TopToolbar } from './top-toolbar';
import { NodePreview } from './node-preview';
import { ContextMenu } from './context-menu';
import { NodeContextMenu } from './node-context-menu';
import { useNodeOperations } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-operations';
import { useNodeSelection } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-selection';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import {
  CanvasProvider,
  useCanvasContext,
} from '@refly-packages/ai-workspace-common/context/canvas';
import { useEdgeStyles } from './constants';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import {
  useCanvasStore,
  useCanvasStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/canvas';
import { BigSearchModal } from '@refly-packages/ai-workspace-common/components/search/modal';
import { CanvasListModal } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal';
import { LibraryModal } from '@refly-packages/ai-workspace-common/components/workspace/library-modal';
import { useCanvasNodesStore } from '@refly-packages/ai-workspace-common/stores/canvas-nodes';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { LayoutControl } from './layout-control';
import { locateToNodePreviewEmitter } from '@refly-packages/ai-workspace-common/events/locateToNodePreview';
import { MenuPopper } from './menu-popper';
import { useNodePreviewControl } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-preview-control';
import {
  EditorPerformanceProvider,
  useEditorPerformance,
} from '@refly-packages/ai-workspace-common/context/editor-performance';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useEdgeOperations } from '@refly-packages/ai-workspace-common/hooks/canvas/use-edge-operations';
import { MultiSelectionMenus } from './multi-selection-menu';
import { CustomEdge } from './edges/custom-edge';
import NotFoundOverlay from './NotFoundOverlay';
import { getFreshNodePreviews } from '../../utils/canvas';
import { NODE_MINI_MAP_COLORS } from './nodes/shared/colors';
import { useDragToCreateNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-drag-create-node';

import '@xyflow/react/dist/style.css';
import './index.scss';
import { SelectionContextMenu } from '@refly-packages/ai-workspace-common/components/canvas/selection-context-menu';
import { useUserStore, useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useUpdateSettings } from '@refly-packages/ai-workspace-common/queries';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { useCanvasSync } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-sync';
import { EmptyGuide } from './empty-guide';

const selectionStyles = `
  .react-flow__selection {
    background: rgba(0, 150, 143, 0.03) !important;
    border: 0.5px solid #00968F !important;
  }
  
  .react-flow__nodesselection-rect {
    background: rgba(0, 150, 143, 0.03) !important;
    border: 0.5px solid #00968F !important;
  }
`;

interface ContextMenuState {
  open: boolean;
  position: { x: number; y: number };
  type: 'canvas' | 'node' | 'selection';
  nodeId?: string;
  nodeType?: CanvasNodeType;
  isSelection?: boolean;
}

// Add new memoized components
const MemoizedBackground = memo(Background);
const MemoizedMiniMap = memo(MiniMap);

const MiniMapNode = (props: any) => {
  const { x, y, width, height, style, className, id: nodeId } = props;
  const nodes = useStoreApi().getState().nodes;
  const node = nodes.find((n) => n.id === nodeId);

  const getMiniMapNodeColor = useCallback((node: Node) => {
    if (node.type === 'memo') {
      const data = node.data as any;
      return data?.metadata?.bgColor ?? '#FFFEE7';
    }
    if (node.type === 'group') {
      return 'transparent';
    }

    return NODE_MINI_MAP_COLORS[node.type as CanvasNodeType] ?? '#6172F3';
  }, []);

  const getMiniMapNodeStrokeColor = useCallback((node: Node) => {
    return node.type === 'group' ? '#363434' : 'transparent';
  }, []);

  if (!node || node.type !== 'image' || !(node.data as any)?.metadata?.imageUrl) {
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={12}
        ry={12}
        style={{
          fill: getMiniMapNodeColor(node),
          stroke: getMiniMapNodeStrokeColor(node),
          strokeWidth: 10,
          opacity: 0.5,
          strokeDasharray: node?.type === 'group' ? '10,10' : 'none',
        }}
      />
    );
  }

  return (
    <image
      href={(node.data as any)?.metadata?.imageUrl}
      x={x}
      y={y}
      width={width}
      height={height}
      className={`minimap-node-image ${className || ''}`}
      style={{
        ...style,
        objectFit: 'cover',
        borderRadius: '12px',
      }}
    />
  );
};

const Flow = memo(({ canvasId }: { canvasId: string }) => {
  const { t } = useTranslation();
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const { addNode } = useAddNode();
  const { nodes, edges } = useCanvasStoreShallow((state) => ({
    nodes: state.data[canvasId]?.nodes ?? [],
    edges: state.data[canvasId]?.edges ?? [],
  }));
  const selectedNodes = nodes.filter((node) => node.selected) || [];

  const { onNodesChange } = useNodeOperations();
  const { setSelectedNode } = useNodeSelection();

  const { onEdgesChange, onConnect } = useEdgeOperations();
  const edgeStyles = useEdgeStyles();

  const { showPreview, showLaunchpad, showMaxRatio } = useCanvasStoreShallow((state) => ({
    showPreview: state.showPreview,
    showLaunchpad: state.showLaunchpad,
    showMaxRatio: state.showMaxRatio,
  }));

  const { rawNodePreviews } = useCanvasStoreShallow((state) => ({
    rawNodePreviews: state.config[canvasId]?.nodePreviews ?? [],
  }));

  // Use the ReactFlow useNodes hoo

  // Compute fresh node previews using the utility function
  const nodePreviews = useMemo(() => {
    // Prefer flowNodes from ReactFlow but fall back to canvas store nodes
    const canvasNodes = useCanvasStore.getState().data[canvasId]?.nodes ?? [];
    const nodesSource = nodes.length > 0 ? nodes : canvasNodes;

    return getFreshNodePreviews(nodesSource, rawNodePreviews);
  }, [nodes, rawNodePreviews, canvasId]);

  const { showCanvasListModal, showLibraryModal, setShowCanvasListModal, setShowLibraryModal } =
    useSiderStoreShallow((state) => ({
      showCanvasListModal: state.showCanvasListModal,
      showLibraryModal: state.showLibraryModal,
      setShowCanvasListModal: state.setShowCanvasListModal,
      setShowLibraryModal: state.setShowLibraryModal,
    }));

  const reactFlowInstance = useReactFlow();

  const { pendingNode, clearPendingNode } = useCanvasNodesStore();
  const { provider, readonly, shareNotFound, shareLoading } = useCanvasContext();

  const { config, operatingNodeId, setOperatingNodeId, setInitialFitViewCompleted } =
    useCanvasStoreShallow((state) => ({
      config: state.config[canvasId],
      operatingNodeId: state.operatingNodeId,
      setOperatingNodeId: state.setOperatingNodeId,
      setInitialFitViewCompleted: state.setInitialFitViewCompleted,
    }));
  const hasCanvasSynced = config?.localSyncedAt > 0 && config?.remoteSyncedAt > 0;

  const { handleNodePreview } = useNodePreviewControl({ canvasId });

  const interactionMode = useUserStore.getState().localSettings.canvasMode;
  const { localSettings, setLocalSettings } = useUserStore.getState();
  const { mutate: updateSettings } = useUpdateSettings();
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  const toggleInteractionMode = (mode: 'mouse' | 'touchpad') => {
    setLocalSettings({
      ...localSettings,
      canvasMode: mode,
    });
    if (isLogin) {
      updateSettings({
        body: {
          preferences: {
            operationMode: mode,
          },
        },
      });
    }
  };

  useEffect(() => {
    return () => {
      setInitialFitViewCompleted(canvasId, false);
    };
  }, [canvasId, setInitialFitViewCompleted]);

  useEffect(() => {
    // Only run fitView if we have nodes and this is the initial render
    const timeoutId = setTimeout(() => {
      const { initialFitViewCompleted } = useCanvasStore.getState().data[canvasId] ?? {};
      if (nodes?.length > 0 && !initialFitViewCompleted) {
        reactFlowInstance.fitView({
          padding: 0.2,
          duration: 200,
          minZoom: 0.1,
          maxZoom: 1,
        });
        setInitialFitViewCompleted(canvasId, true);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [canvasId, nodes?.length, reactFlowInstance, setInitialFitViewCompleted]);

  const defaultEdgeOptions = useMemo(
    () => ({
      style: edgeStyles.default,
    }),
    [edgeStyles],
  );

  const flowConfig = useMemo(
    () => ({
      defaultViewport: {
        x: 0,
        y: 0,
        zoom: 0.75,
      },
      minZoom: 0.1,
      maxZoom: 2,
      fitViewOptions: {
        padding: 0.2,
        minZoom: 0.1,
        maxZoom: 2,
        duration: 200,
      },
      defaultEdgeOptions,
    }),
    [defaultEdgeOptions],
  );

  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [lastClickTime, setLastClickTime] = useState(0);

  const { onConnectEnd: temporaryEdgeOnConnectEnd } = useDragToCreateNode();

  const cleanupTemporaryEdges = useCallback(() => {
    const rfInstance = reactFlowInstance;
    rfInstance.setNodes((nodes) => nodes.filter((node) => node.type !== 'temporaryEdge'));
    rfInstance.setEdges((edges) => {
      // Get the current nodes to check if source/target is a temporary node
      const currentNodes = rfInstance.getNodes();
      const isTemporaryNode = (id: string) =>
        currentNodes.some((node) => node.id === id && node.type === 'temporaryEdge');

      return edges.filter((edge) => !isTemporaryNode(edge.source) && !isTemporaryNode(edge.target));
    });
  }, [reactFlowInstance]);

  const handlePanelClick = useCallback(
    (event: React.MouseEvent) => {
      setOperatingNodeId(null);
      setContextMenu((prev) => ({ ...prev, open: false }));

      // Clean up temporary nodes when clicking on canvas
      cleanupTemporaryEdges();

      // Reset edge selection when clicking on canvas
      if (selectedEdgeId) {
        setSelectedEdgeId(null);
      }

      if (readonly) return;

      const currentTime = new Date().getTime();
      const timeDiff = currentTime - lastClickTime;

      if (timeDiff < 300) {
        const flowPosition = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        setMenuPosition(flowPosition);
        setMenuOpen(true);
      }

      setLastClickTime(currentTime);
    },
    [lastClickTime, setOperatingNodeId, reactFlowInstance, selectedEdgeId, cleanupTemporaryEdges],
  );

  const handleToolSelect = (tool: string) => {
    // Handle tool selection
    console.log('Selected tool:', tool);
  };

  // Add scroll position state and handler
  const [showLeftIndicator, setShowLeftIndicator] = useState(false);
  const [showRightIndicator, setShowRightIndicator] = useState(false);

  const updateIndicators = useCallback(
    (container: HTMLDivElement | null) => {
      if (!container) return;

      const shouldShowLeft = container.scrollLeft > 0;
      const shouldShowRight =
        container.scrollLeft < container.scrollWidth - container.clientWidth - 1;

      if (shouldShowLeft !== showLeftIndicator) {
        setShowLeftIndicator(shouldShowLeft);
      }
      if (shouldShowRight !== showRightIndicator) {
        setShowRightIndicator(shouldShowRight);
      }
    },
    [showLeftIndicator, showRightIndicator],
  );

  useEffect(() => {
    const container = document.querySelector('.preview-container') as HTMLDivElement;
    if (container) {
      const observer = new ResizeObserver(() => {
        updateIndicators(container);
      });

      observer.observe(container);
      updateIndicators(container);

      return () => {
        observer.disconnect();
      };
    }
  }, [updateIndicators]);

  // Handle pending node
  useEffect(() => {
    if (pendingNode) {
      addNode(pendingNode);
      clearPendingNode();
    }
  }, [pendingNode, addNode, clearPendingNode]);

  const [connectionTimeout, setConnectionTimeout] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (provider?.status !== 'connected') {
      timeoutId = setTimeout(() => {
        setConnectionTimeout(true);
      }, 10000);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [provider?.status]);

  useEffect(() => {
    const unsubscribe = locateToNodePreviewEmitter.on(
      'locateToNodePreview',
      ({ canvasId: emittedCanvasId, id }) => {
        if (emittedCanvasId === canvasId) {
          requestAnimationFrame(() => {
            const previewContainer = document.querySelector('.preview-container');
            const targetPreview = document.querySelector(`[data-preview-id="${id}"]`);

            if (previewContainer && targetPreview) {
              targetPreview.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center',
              });
            }
          });
        }
      },
    );

    return unsubscribe;
  }, [canvasId]);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    open: false,
    position: { x: 0, y: 0 },
    type: 'canvas',
  });

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setContextMenu({
        open: true,
        position: flowPosition,
        type: 'canvas',
      });
    },
    [reactFlowInstance],
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: CanvasNode<any>) => {
      event.preventDefault();
      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Map node type to menu type
      let menuNodeType: CanvasNodeType;
      switch (node.type) {
        case 'document':
          menuNodeType = 'document';
          break;
        case 'resource':
          menuNodeType = 'resource';
          break;
        case 'skillResponse':
          menuNodeType = 'skillResponse';
          break;
        case 'skill':
          menuNodeType = 'skill';
          break;
        case 'memo':
          menuNodeType = 'memo';
          break;
        case 'group':
          menuNodeType = 'group';
          break;
        case 'codeArtifact':
          menuNodeType = 'codeArtifact';
          break;
        case 'website':
          menuNodeType = 'website';
          break;
        default:
          return; // Don't show context menu for unknown node types
      }

      setContextMenu({
        open: true,
        position: flowPosition,
        type: 'node',
        nodeId: node.id,
        nodeType: menuNodeType,
      });
    },
    [reactFlowInstance],
  );

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: CanvasNode<any>) => {
      const { operatingNodeId } = useCanvasStore.getState();
      setContextMenu((prev) => ({ ...prev, open: false }));

      if (event.metaKey || event.shiftKey) {
        event.stopPropagation();
        return;
      }

      if (!node?.id) {
        console.warn('Invalid node clicked');
        return;
      }

      if (node.selected && node.id === operatingNodeId) {
        // Already in operating mode, do nothing
        return;
      }

      if (node.selected && !operatingNodeId) {
        setOperatingNodeId(node.id);
        event.stopPropagation();
      } else {
        setSelectedNode(node);
        setOperatingNodeId(null);
      }

      // Memo nodes are not previewable
      if (['memo', 'skill', 'group', 'image'].includes(node.type)) {
        return;
      }

      // Handle preview if enabled
      handleNodePreview(node);
    },
    [handleNodePreview, setOperatingNodeId, setSelectedNode],
  );

  // Memoize nodes and edges
  const memoizedNodes = useMemo(() => nodes, [nodes]);
  const memoizedEdges = useMemo(() => edges, [edges]);

  // Memoize LaunchPad component
  const memoizedLaunchPad = useMemo(
    () => (
      <div className="absolute bottom-[8px] left-1/2 -translate-x-1/2 w-[444px] z-50">
        <LaunchPad visible={!readonly && showLaunchpad} />
      </div>
    ),
    [readonly, showLaunchpad],
  );

  // Memoize MiniMap styles
  const miniMapStyles = useMemo(
    () => ({
      border: '1px solid rgba(16, 24, 40, 0.0784)',
      boxShadow: '0px 4px 6px 0px rgba(16, 24, 40, 0.03)',
    }),
    [],
  );

  // Memoize the Background and MiniMap components
  const memoizedBackground = useMemo(() => <MemoizedBackground />, []);
  const memoizedMiniMap = useMemo(
    () => (
      <MemoizedMiniMap
        position="bottom-left"
        style={miniMapStyles}
        className="bg-white/80 w-[140px] h-[92px] !mb-[46px] !ml-[10px] rounded-lg shadow-md p-2 [&>svg]:w-full [&>svg]:h-full"
        zoomable={false}
        pannable={false}
        nodeComponent={MiniMapNode}
      />
    ),
    [miniMapStyles],
  );

  // Memoize the node types configuration
  const memoizedNodeTypes = useMemo(() => nodeTypes, []);

  const readonlyNodesChange = useCallback(() => {
    // No-op function for readonly mode
    return nodes;
  }, [nodes]);

  const readonlyEdgesChange = useCallback(() => {
    // No-op function for readonly mode
    return edges;
  }, [edges]);

  const readonlyConnect = useCallback(() => {
    // No-op function for readonly mode
    return;
  }, []);

  // Optimize node dragging performance
  const { setIsNodeDragging, setDraggingNodeId } = useEditorPerformance();

  const onNodeDragStart = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setIsNodeDragging(true);
      setDraggingNodeId(node.id);
    },
    [setIsNodeDragging, setDraggingNodeId],
  );

  const onNodeDragStop = useCallback(() => {
    setIsNodeDragging(false);
    setDraggingNodeId(null);
  }, [setIsNodeDragging, setDraggingNodeId]);

  const onSelectionContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setContextMenu({
        open: true,
        position: flowPosition,
        type: 'selection',
        nodeType: 'group',
      });
    },
    [reactFlowInstance],
  );

  const { handleUploadImage } = useUploadImage();
  const { undoManager } = useCanvasSync();

  // Add drag and drop handlers
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files);
      const imageFile = files.find((file) => file.type.startsWith('image/'));

      if (imageFile) {
        handleUploadImage(imageFile, canvasId, event);
      }
    },
    [addNode, reactFlowInstance],
  );

  // Add edge types configuration
  const edgeTypes = useMemo(
    () => ({
      default: CustomEdge,
    }),
    [],
  );

  // Update handleKeyDown to handle edge deletion
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip all keyboard handling in readonly mode
      if (readonly) return;

      const target = e.target as HTMLElement;

      // Ignore input, textarea and contentEditable elements
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      // Check for mod key (Command on Mac, Ctrl on Windows/Linux)
      const isModKey = e.metaKey || e.ctrlKey;

      if (isModKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          // Mod+Shift+Z for Redo
          undoManager?.redo();
        } else {
          // Mod+Z for Undo
          undoManager?.undo();
        }
      }

      // Handle edge deletion
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEdgeId) {
        e.preventDefault();
        const { setEdges } = reactFlowInstance;
        setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
        setSelectedEdgeId(null);
      }
    },
    [selectedEdgeId, reactFlowInstance, undoManager, readonly],
  );

  // Add edge click handler for delete button
  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      // Check if click is on delete button
      if ((event.target as HTMLElement).closest('.edge-delete-button')) {
        const { setEdges } = reactFlowInstance;
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
        setSelectedEdgeId(null);
        return;
      }

      // Check if click is on edge label or edge label input
      if ((event.target as HTMLElement).closest('.edge-label')) {
        return;
      }

      setSelectedEdgeId(edge.id);
    },
    [reactFlowInstance],
  );

  // Update useEffect for keyboard events
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoManager, handleKeyDown]);

  useEffect(() => {
    const { setEdges } = reactFlowInstance;
    setEdges((eds) =>
      eds.map((e) => {
        return {
          ...e,
          selected: e.id === selectedEdgeId,
          style: e.id === selectedEdgeId ? edgeStyles.selected : edgeStyles.default,
        };
      }),
    );
  }, [selectedEdgeId, reactFlowInstance, edgeStyles]);

  return (
    <Spin
      className="w-full h-full"
      style={{ maxHeight: '100%' }}
      spinning={
        (!readonly && !hasCanvasSynced && provider?.status !== 'connected' && !connectionTimeout) ||
        (readonly && shareLoading)
      }
      tip={connectionTimeout ? t('common.connectionFailed') : t('common.loading')}
    >
      <div className="w-full h-screen relative flex flex-col overflow-hidden">
        {!readonly && (
          <CanvasToolbar onToolSelect={handleToolSelect} nodeLength={nodes?.length || 0} />
        )}
        <TopToolbar canvasId={canvasId} />
        <div className="flex-grow relative">
          <style>{selectionStyles}</style>
          <ReactFlow
            {...flowConfig}
            edgeTypes={edgeTypes}
            panOnScroll={interactionMode === 'touchpad'}
            panOnDrag={interactionMode === 'mouse'}
            zoomOnScroll={interactionMode === 'mouse'}
            zoomOnPinch={interactionMode === 'touchpad'}
            zoomOnDoubleClick={false}
            selectNodesOnDrag={!operatingNodeId && interactionMode === 'mouse' && !readonly}
            selectionOnDrag={!operatingNodeId && interactionMode === 'touchpad' && !readonly}
            nodeTypes={memoizedNodeTypes}
            nodes={memoizedNodes}
            edges={memoizedEdges}
            onNodesChange={readonly ? readonlyNodesChange : onNodesChange}
            onEdgesChange={readonly ? readonlyEdgesChange : onEdgesChange}
            onConnect={readonly ? readonlyConnect : onConnect}
            onConnectEnd={readonly ? undefined : temporaryEdgeOnConnectEnd}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePanelClick}
            onPaneContextMenu={readonly ? undefined : onPaneContextMenu}
            onNodeContextMenu={readonly ? undefined : onNodeContextMenu}
            onNodeDragStart={readonly ? undefined : onNodeDragStart}
            onNodeDragStop={readonly ? undefined : onNodeDragStop}
            nodeDragThreshold={10}
            nodesDraggable={!operatingNodeId && !readonly}
            nodesConnectable={!readonly}
            elementsSelectable={!readonly}
            onSelectionContextMenu={readonly ? undefined : onSelectionContextMenu}
            deleteKeyCode={readonly ? null : ['Backspace', 'Delete']}
            multiSelectionKeyCode={readonly ? null : ['Shift', 'Meta']}
            onDragOver={readonly ? undefined : handleDragOver}
            onDrop={readonly ? undefined : handleDrop}
            connectOnClick={false}
            edgesFocusable={false}
            nodesFocusable={!readonly}
            onEdgeClick={readonly ? undefined : handleEdgeClick}
          >
            {nodes?.length === 0 && hasCanvasSynced && <EmptyGuide canvasId={canvasId} />}

            {memoizedBackground}
            {memoizedMiniMap}
          </ReactFlow>

          <LayoutControl
            mode={interactionMode}
            changeMode={toggleInteractionMode}
            readonly={readonly}
          />

          {memoizedLaunchPad}
        </div>

        {/* Display the not found overlay when shareNotFound is true */}
        {readonly && shareNotFound && <NotFoundOverlay />}

        {showPreview && (
          <div
            ref={previewContainerRef}
            className="absolute top-[64px] bottom-0 right-2 overflow-x-auto preview-container"
            style={{
              maxWidth: showMaxRatio ? '900px' : '440px',
            }}
            onScroll={(e) => updateIndicators(e.currentTarget)}
          >
            <div className="relative h-full">
              <div className="flex gap-2 h-full">
                {nodePreviews?.filter(Boolean)?.map((node) => (
                  <NodePreview key={node?.id} node={node} canvasId={canvasId} />
                ))}
              </div>
            </div>
          </div>
        )}

        <CanvasListModal visible={showCanvasListModal} setVisible={setShowCanvasListModal} />
        <LibraryModal visible={showLibraryModal} setVisible={setShowLibraryModal} />
        <BigSearchModal />

        <MenuPopper open={menuOpen} position={menuPosition} setOpen={setMenuOpen} />

        {contextMenu.open && contextMenu.type === 'canvas' && (
          <ContextMenu
            open={contextMenu.open}
            position={contextMenu.position}
            setOpen={(open) => setContextMenu((prev) => ({ ...prev, open }))}
            isSelection={contextMenu.isSelection}
          />
        )}

        {contextMenu.open &&
          contextMenu.type === 'node' &&
          contextMenu.nodeId &&
          contextMenu.nodeType && (
            <NodeContextMenu
              open={contextMenu.open}
              position={contextMenu.position}
              nodeId={contextMenu.nodeId}
              nodeType={contextMenu.nodeType}
              setOpen={(open) => setContextMenu((prev) => ({ ...prev, open }))}
            />
          )}

        {contextMenu.open && contextMenu.type === 'selection' && (
          <SelectionContextMenu
            open={contextMenu.open}
            position={contextMenu.position}
            setOpen={(open) => setContextMenu((prev) => ({ ...prev, open }))}
          />
        )}

        {selectedNodes.length > 0 && <MultiSelectionMenus />}
      </div>
    </Spin>
  );
});

export const Canvas = (props: { canvasId: string; readonly?: boolean }) => {
  const { canvasId, readonly } = props;
  const setCurrentCanvasId = useCanvasStoreShallow((state) => state.setCurrentCanvasId);

  useEffect(() => {
    if (readonly) {
      return;
    }

    if (canvasId && canvasId !== 'empty') {
      setCurrentCanvasId(canvasId);
    } else {
      setCurrentCanvasId(null);
    }
  }, [canvasId, setCurrentCanvasId]);

  return (
    <EditorPerformanceProvider>
      <CanvasProvider readonly={readonly} canvasId={canvasId}>
        <ReactFlowProvider>
          <Flow canvasId={canvasId} />
        </ReactFlowProvider>
      </CanvasProvider>
    </EditorPerformanceProvider>
  );
};

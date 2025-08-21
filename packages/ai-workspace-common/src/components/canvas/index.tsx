import { useCallback, useMemo, useEffect, useState, useRef, memo } from 'react';
import { Button, Modal, Result, message, Splitter, Popover } from 'antd';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  ReactFlow,
  Background,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  Node,
  Edge,
  useStore,
  useStoreApi,
} from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { CanvasNode } from '@refly/canvas-common';
import { nodeTypes } from './nodes';
import { TopToolbar } from './top-toolbar';
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
import {
  useCanvasStore,
  useCanvasStoreShallow,
  useCanvasNodesStore,
  useUserStore,
  useUserStoreShallow,
  usePilotStoreShallow,
  useCanvasResourcesPanelStoreShallow,
} from '@refly/stores';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
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
import { NODE_MINI_MAP_COLORS } from './nodes/shared/colors';
import { useDragToCreateNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-drag-create-node';
import { useDragDropPaste } from '@refly-packages/ai-workspace-common/hooks/canvas/use-drag-drop-paste';

import '@xyflow/react/dist/style.css';
import './index.scss';
import { SelectionContextMenu } from '@refly-packages/ai-workspace-common/components/canvas/selection-context-menu';
import {
  useGetPilotSessionDetail,
  useUpdateSettings,
} from '@refly-packages/ai-workspace-common/queries';
import { EmptyGuide } from './empty-guide';
import { useLinearThreadReset } from '@refly-packages/ai-workspace-common/hooks/canvas/use-linear-thread-reset';
import HelperLines from './common/helper-line/index';
import { useListenNodeOperationEvents } from '@refly-packages/ai-workspace-common/hooks/canvas/use-listen-node-events';
import { runtime } from '@refly/ui-kit';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import {
  NodeContextMenuSource,
  NodeDragCreateInfo,
  nodeOperationsEmitter,
} from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { useCanvasInitialActions } from '@refly-packages/ai-workspace-common/hooks/use-canvas-initial-actions';
import { Pilot } from '@refly-packages/ai-workspace-common/components/pilot';
import SessionHeader from '@refly-packages/ai-workspace-common/components/pilot/session-header';
import { CanvasResources, CanvasResourcesWidescreenModal } from './canvas-resources';
import { ResourceOverview } from './canvas-resources/share/resource-overview';
import { NodePreviewContainer } from '@refly-packages/ai-workspace-common/components/canvas/node-preview';

const GRID_SIZE = 10;

const selectionStyles = `
  .react-flow__selection {
    background: rgba(0, 150, 143, 0.03) !important;
    border: 0.5px solid #0E9F77 !important;
  }
  
  .react-flow__nodesselection-rect {
    background: rgba(0, 150, 143, 0.03) !important;
    border: 0.5px solid #0E9F77 !important;
  }
`;

interface ContextMenuState {
  open: boolean;
  position: { x: number; y: number };
  type: 'canvas' | 'node' | 'selection';
  nodeId?: string;
  nodeType?: CanvasNodeType;
  isSelection?: boolean;
  source?: 'node' | 'handle';
  dragCreateInfo?: NodeDragCreateInfo;
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
          fill: node ? getMiniMapNodeColor(node) : '#6172F3',
          stroke: node ? getMiniMapNodeStrokeColor(node) : 'transparent',
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

  useCanvasInitialActions(canvasId);
  // useFollowPilotSteps();

  const { addNode } = useAddNode();
  const { nodes, edges } = useStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
    })),
  );
  const selectedNodes = nodes.filter((node) => node.selected) || [];

  const getPageByCanvasId = useCallback(async () => {
    if (!canvasId) return;

    const res = await getClient().getPageByCanvasId({
      path: { canvasId },
    });
    if (res?.data?.success) {
      const pageData = res.data.data;
      if (pageData?.page?.pageId) {
        setCanvasPage(canvasId, pageData.page.pageId);
      }
    }
  }, [canvasId]);

  const {
    onNodesChange,
    truncateAllNodesContent,
    onNodeDragStop,
    helperLineHorizontal,
    helperLineVertical,
  } = useNodeOperations();
  const { setSelectedNode } = useNodeSelection();

  const { onEdgesChange, onConnect } = useEdgeOperations();
  const edgeStyles = useEdgeStyles();

  // Call truncateAllNodesContent when nodes are loaded
  useEffect(() => {
    if (nodes.length > 0) {
      truncateAllNodesContent();
    }
  }, [canvasId, truncateAllNodesContent]);

  const reactFlowInstance = useReactFlow();

  const { pendingNode, clearPendingNode } = useCanvasNodesStore();
  const { loading, readonly, shareNotFound, shareLoading, undo, redo } = useCanvasContext();

  const { isPilotOpen, setIsPilotOpen, setActiveSessionId, activeSessionId } = usePilotStoreShallow(
    (state) => ({
      isPilotOpen: state.isPilotOpen,
      setIsPilotOpen: state.setIsPilotOpen,
      setActiveSessionId: state.setActiveSessionId,
      activeSessionId: state.activeSessionId,
    }),
  );

  const {
    canvasInitialized,
    operatingNodeId,
    setOperatingNodeId,
    setInitialFitViewCompleted,
    setCanvasPage,
    showSlideshow,
    setShowSlideshow,
    setContextMenuOpenedCanvasId,
  } = useCanvasStoreShallow((state) => ({
    canvasInitialized: state.canvasInitialized[canvasId],
    operatingNodeId: state.operatingNodeId,
    setOperatingNodeId: state.setOperatingNodeId,
    setInitialFitViewCompleted: state.setInitialFitViewCompleted,
    setCanvasPage: state.setCanvasPage,
    showSlideshow: state.showSlideshow,
    setShowSlideshow: state.setShowSlideshow,
    setContextMenuOpenedCanvasId: state.setContextMenuOpenedCanvasId,
  }));

  const { handleNodePreview } = useNodePreviewControl({ canvasId });

  const interactionMode = useUserStore.getState().localSettings.canvasMode;
  const { isLogin, setLocalSettings } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    setLocalSettings: state.setLocalSettings,
  }));
  const { mutate: updateSettings } = useUpdateSettings();

  const toggleInteractionMode = useCallback(
    (mode: 'mouse' | 'touchpad') => {
      const { localSettings } = useUserStore.getState();
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
    },
    [setLocalSettings, isLogin, updateSettings],
  );

  // Use the reset hook to handle canvas ID changes
  useLinearThreadReset(canvasId);

  useEffect(() => {
    return () => {
      setInitialFitViewCompleted(false);
    };
  }, [canvasId, setInitialFitViewCompleted]);

  useEffect(() => {
    // Only run fitView if we have nodes and this is the initial render
    const timeoutId = setTimeout(() => {
      const { initialFitViewCompleted } = useCanvasStore.getState();
      if (nodes?.length > 0 && !initialFitViewCompleted) {
        reactFlowInstance.fitView({
          padding: 0.2,
          duration: 200,
          minZoom: 0.1,
          maxZoom: 1,
        });
        setInitialFitViewCompleted(true);
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

  const { onConnectEnd: temporaryEdgeOnConnectEnd, onConnectStart: temporaryEdgeOnConnectStart } =
    useDragToCreateNode();

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

  // Track when provider first became unhealthy
  const unhealthyStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Skip if no provider or in desktop mode
    if (runtime === 'desktop') return;

    // Clear timeout state if provider becomes connected
    if (!loading) {
      setConnectionTimeout(false);
      unhealthyStartTimeRef.current = null;
      return;
    }

    // If provider is unhealthy and we haven't started tracking, start now
    if (unhealthyStartTimeRef.current === null) {
      unhealthyStartTimeRef.current = Date.now();
    }

    // Check status every two seconds after provider becomes unhealthy
    const intervalId = setInterval(() => {
      if (unhealthyStartTimeRef.current) {
        const unhealthyDuration = Date.now() - unhealthyStartTimeRef.current;

        // If provider has been unhealthy for more than 10 seconds, set timeout
        if (unhealthyDuration > 10000) {
          setConnectionTimeout(true);
          clearInterval(intervalId);
        }
      }

      // Provider became healthy, reset everything
      if (!loading) {
        clearInterval(intervalId);
        unhealthyStartTimeRef.current = null;
        setConnectionTimeout(false);
      }
    }, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [loading]);

  useEffect(() => {
    if (!readonly) {
      getPageByCanvasId();
    }

    if (showSlideshow) {
      setShowSlideshow(false);
    }

    if (isPilotOpen) {
      setActiveSessionId(null);
    }

    const unsubscribe = locateToNodePreviewEmitter.on(
      'locateToNodePreview',
      ({ canvasId: emittedCanvasId, id }) => {
        if (emittedCanvasId === canvasId) {
          requestAnimationFrame(() => {
            const previewContainer = document.querySelector('.preview-container');
            const targetPreview = document.querySelector(`[data-preview-id="${id}"]`);

            if (previewContainer && targetPreview) {
              targetPreview?.scrollIntoView?.({
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

  useEffect(() => {
    if (contextMenu.type === 'node') {
      setContextMenuOpenedCanvasId(contextMenu.open ? (contextMenu.nodeId ?? null) : null);
    }
  }, [contextMenu, setContextMenuOpenedCanvasId]);

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
    (
      event: React.MouseEvent,
      node: CanvasNode<any>,
      metaInfo?: {
        source?: NodeContextMenuSource;
        dragCreateInfo?: NodeDragCreateInfo;
      },
    ) => {
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
        case 'image':
          menuNodeType = 'image';
          break;
        case 'mediaSkill':
          menuNodeType = 'mediaSkill';
          break;
        case 'mediaSkillResponse':
          menuNodeType = 'mediaSkillResponse';
          break;
        case 'audio':
          menuNodeType = 'audio';
          break;
        case 'video':
          menuNodeType = 'video';
          break;
        default:
          return; // Don't show context menu for unknown node types
      }

      const { source, dragCreateInfo } = metaInfo || {};

      setContextMenu({
        open: true,
        position: flowPosition,
        type: 'node',
        source: source || 'node',
        dragCreateInfo,
        nodeId: node.id,
        nodeType: menuNodeType,
      });
    },
    [reactFlowInstance],
  );

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: CanvasNode<any>) => {
      if (!node) return;

      if (node.id.startsWith('ghost-')) {
        setContextMenu((prev) => ({ ...prev, open: false }));
        return;
      }

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
      if (
        [
          'memo',
          'skill',
          'group',
          'image',
          'mediaSkill',
          'video',
          'audio',
          'mediaSkillResponse',
        ].includes(node.type)
      ) {
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
        className="bg-white/80 dark:bg-gray-900/80 w-[140px] h-[92px] !mb-2 !ml-2 rounded-lg shadow-refly-m p-2 [&>svg]:w-full [&>svg]:h-full"
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

  const handleNodeDragStart = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setIsNodeDragging(true);
      setDraggingNodeId(node.id);
    },
    [setIsNodeDragging, setDraggingNodeId],
  );

  const [readonlyDragWarningDebounce, setReadonlyDragWarningDebounce] =
    useState<NodeJS.Timeout | null>(null);

  const handleReadonlyDrag = useCallback(
    (event: React.MouseEvent) => {
      if (readonly) {
        if (!readonlyDragWarningDebounce) {
          message.warning(t('common.readonlyDragDescription'));

          const debounceTimeout = setTimeout(() => {
            setReadonlyDragWarningDebounce(null);
          }, 3000);

          setReadonlyDragWarningDebounce(debounceTimeout);
        }

        event.preventDefault();
        event.stopPropagation();
      }
    },
    [readonly, readonlyDragWarningDebounce, t],
  );

  useEffect(() => {
    return () => {
      if (readonlyDragWarningDebounce) {
        clearTimeout(readonlyDragWarningDebounce);
      }
    };
  }, [readonlyDragWarningDebounce]);

  // Handle node drag stop and apply snap positions
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!node) return;

      // Call the hook's onNodeDragStop method
      onNodeDragStop(node.id);

      // Reset performance tracking
      setIsNodeDragging(false);
      setDraggingNodeId(null);
    },
    [onNodeDragStop, setIsNodeDragging, setDraggingNodeId],
  );

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

  // Use the new drag, drop, paste hook
  const { handlers, DropOverlay } = useDragDropPaste({
    canvasId,
    readonly,
  });

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
          redo();
        } else {
          // Mod+Z for Undo
          undo();
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
    [selectedEdgeId, reactFlowInstance, undo, redo, readonly],
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
  }, [handleKeyDown]);

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

  // Add event listener for node operations
  useListenNodeOperationEvents();

  // Add listener for opening node context menu
  useEffect(() => {
    const handleOpenContextMenu = (event: any) => {
      // 从事件名称中提取nodeId
      const nodeId = event.nodeId;

      // 检查事件是否包含必要的信息
      if (event?.nodeType) {
        // 构造一个合成的React鼠标事件
        const syntheticEvent = {
          ...event.originalEvent,
          clientX: event.x,
          clientY: event.y,
          preventDefault: () => {},
          stopPropagation: () => {},
        } as React.MouseEvent;

        // 构造一个简化的节点对象，包含必要的属性
        const node = {
          id: nodeId,
          type: event.nodeType as CanvasNodeType,
          data: { type: event.nodeType },
          position: { x: event.x, y: event.y },
        } as unknown as CanvasNode<any>;

        // 调用onNodeContextMenu处理上下文菜单
        onNodeContextMenu(syntheticEvent, node, {
          source: event.source,
          dragCreateInfo: event.dragCreateInfo,
        });
      }
    };

    // 监听所有包含openContextMenu的事件
    nodeOperationsEmitter.on('openNodeContextMenu', handleOpenContextMenu);

    return () => {
      // 清理事件监听器
      nodeOperationsEmitter.off('openNodeContextMenu', handleOpenContextMenu);
    };
  }, [onNodeContextMenu]);
  const { data: sessionData } = useGetPilotSessionDetail(
    {
      query: { sessionId: activeSessionId },
    },
    undefined,
    {
      enabled: !!activeSessionId,
    },
  );
  const session = useMemo(() => sessionData?.data, [sessionData]);
  const handleClick = useCallback(() => {
    setIsPilotOpen(!isPilotOpen);
  }, [setIsPilotOpen, isPilotOpen]);
  const handleSessionClick = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId);
    },
    [setActiveSessionId],
  );
  return (
    <Spin
      className="w-full h-full"
      style={{ maxHeight: '100%' }}
      spinning={(readonly && shareLoading) || loading}
      tip={connectionTimeout ? t('common.connectionFailed') : t('common.loading')}
    >
      <Modal
        centered
        open={connectionTimeout}
        onOk={() => window.location.reload()}
        onCancel={() => setConnectionTimeout(false)}
        okText={t('common.retry')}
        cancelText={t('common.cancel')}
      >
        <Result
          status="warning"
          title={t('canvas.connectionTimeout.title')}
          extra={t('canvas.connectionTimeout.extra')}
        />
      </Modal>
      <div className="w-full h-[calc(100vh-16px)] relative flex flex-col overflow-hidden border-[1px] border-solid border-refly-Card-Border rounded-xl shadow-sm">
        <AnimatePresence mode="wait">
          {isPilotOpen ? (
            <motion.div
              key="pilot-panel"
              className="absolute bottom-2 left-[calc(50%-284px)] transform -translate-x-1/2 z-20  w-[568px] rounded-[20px] shadow-refly-m border-[1px] border-solid border-refly-Card-Border bg-white dark:bg-refly-bg-content-z2"
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <Pilot canvasId={canvasId} />
            </motion.div>
          ) : nodes?.length > 0 ? (
            <motion.div
              key="session-header"
              className="absolute bottom-2 left-[calc(50%-284px)] transform -translate-x-1/2 z-20 shadow-sm rounded-[20px] w-[568px] border border-solid border-refly-Card-Border dark:border-gray-700 bg-white dark:bg-neutral-900/95"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <motion.div
                className="pb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                <SessionHeader
                  canvasId={canvasId}
                  session={session}
                  steps={session?.steps ?? []}
                  onClick={handleClick}
                  onSessionClick={handleSessionClick}
                />
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="start-button"
              className="absolute bottom-4 left-[calc(50%-140px)] z-20"
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <motion.div
                whileHover={{
                  scale: 1.02,
                  transition: { duration: 0.2 },
                }}
                whileTap={{
                  scale: 0.98,
                  transition: { duration: 0.1 },
                }}
              >
                <Button
                  type="default"
                  className="bg-white dark:bg-neutral-900/95 border border-neutral-200 dark:border-neutral-800 rounded-full h-14 px-4 shadow-sm hover:shadow transition-colors flex items-center gap-3 w-[280px] max-w-[92vw]"
                  onClick={() => setIsPilotOpen(true)}
                >
                  <motion.div
                    className="flex items-center shrink-0"
                    initial={{ x: -5 }}
                    animate={{ x: 0 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 49 22"
                      fill="none"
                      className="h-5 w-auto translate-y-[2px]"
                    >
                      <path
                        d="M3.31675 1.65329C3.35374 1.47891 3.49191 1.34349 3.66755 1.31304C4.30817 1.20198 4.95457 1.11983 5.60675 1.06659C6.35739 1.00531 7.03142 0.974672 7.62886 0.974672C8.33354 0.974672 8.99991 1.05893 9.62799 1.22743C10.2561 1.39594 10.7999 1.65637 11.2595 2.0087C11.719 2.34572 12.079 2.78997 12.3395 3.34146C12.6152 3.87762 12.7531 4.51336 12.7531 5.24867C12.7531 6.09122 12.6229 6.82653 12.3624 7.45461C12.1173 8.06737 11.788 8.58821 11.3744 9.01715C10.9607 9.43076 10.4859 9.76012 9.94969 10.0052C9.42885 10.235 8.89268 10.3882 8.3412 10.4648L11.18 16.6643C11.3139 16.9566 11.1002 17.2894 10.7787 17.2894H8.47041C8.2829 17.2894 8.11586 17.1709 8.05386 16.994L5.95143 10.9933L4.36592 10.6946L3.0606 16.9384C3.01784 17.1429 2.83751 17.2894 2.62856 17.2894H0.544825C0.264198 17.2894 0.0548222 17.031 0.113054 16.7564L3.31675 1.65329ZM4.82549 8.55758H6.04335C6.4876 8.55758 6.92419 8.51928 7.35312 8.44269C7.78205 8.35077 8.15737 8.19758 8.47907 7.98311C8.81608 7.75333 9.08417 7.45461 9.28331 7.08695C9.49778 6.7193 9.60501 6.25207 9.60501 5.68527C9.60501 5.16442 9.42885 4.72017 9.07651 4.35251C8.72417 3.96954 8.15737 3.77805 7.3761 3.77805C7.06972 3.77805 6.77866 3.79337 6.50292 3.82401C6.24249 3.83932 6.02037 3.8623 5.83654 3.89294L4.82549 8.55758Z"
                        fill="var(--refly-text-0)"
                      />
                      <path
                        d="M20.9581 16.1864C20.4832 16.5847 19.8704 16.9218 19.1198 17.1975C18.3692 17.4732 17.496 17.6111 16.5002 17.6111C15.2594 17.6111 14.279 17.2511 13.559 16.5311C12.8543 15.7958 12.502 14.7771 12.502 13.475C12.502 12.2495 12.6935 11.1465 13.0764 10.1661C13.4594 9.17034 13.9573 8.32779 14.57 7.63844C15.1981 6.94908 15.9028 6.42058 16.6841 6.05292C17.4653 5.66995 18.2466 5.47846 19.0279 5.47846C19.656 5.47846 20.1921 5.56271 20.6364 5.73122C21.0959 5.88441 21.4713 6.10654 21.7623 6.3976C22.0534 6.67334 22.2678 6.99504 22.4057 7.3627C22.5436 7.73035 22.6125 8.12099 22.6125 8.5346C22.6125 9.16268 22.4517 9.71416 22.13 10.1891C21.8083 10.6639 21.3564 11.0622 20.7742 11.3839C20.2074 11.6903 19.5181 11.9278 18.7062 12.0963C17.8943 12.2495 17.0058 12.3261 16.0407 12.3261C15.9181 12.3261 15.8032 12.3261 15.696 12.3261C15.5888 12.3107 15.4739 12.3031 15.3513 12.3031C15.3207 12.4869 15.2977 12.6554 15.2824 12.8086C15.2671 12.9465 15.2594 13.0767 15.2594 13.1992C15.2594 13.8886 15.4356 14.4018 15.7879 14.7388C16.1556 15.0758 16.6687 15.2443 17.3275 15.2443C18.0015 15.2443 18.6066 15.1447 19.1428 14.9456C19.6789 14.7465 20.0849 14.5473 20.3606 14.3482L20.9581 16.1864ZM15.7649 10.5108C16.1939 10.5108 16.6458 10.4954 17.1207 10.4648C17.6109 10.4342 18.0628 10.3652 18.4764 10.258C18.89 10.1354 19.2347 9.96693 19.5104 9.75246C19.7862 9.52267 19.924 9.2163 19.924 8.83332C19.924 8.60353 19.8398 8.37375 19.6713 8.14396C19.5028 7.89886 19.1504 7.77631 18.6143 7.77631C17.9402 7.77631 17.3504 8.03673 16.8449 8.55758C16.3547 9.07842 15.9947 9.72948 15.7649 10.5108Z"
                        fill="var(--refly-text-0)"
                      />
                      <path
                        d="M28.8432 7.28419L27.1428 17.1879C27.0509 17.7547 26.9207 18.2756 26.7522 18.7505C26.5837 19.2407 26.3462 19.6619 26.0398 20.0143C25.7488 20.3819 25.3735 20.6653 24.9139 20.8645C24.4543 21.0789 23.8875 21.1862 23.2135 21.1862C22.662 21.1862 22.1258 21.1402 21.605 21.0483C21.2014 20.9906 20.8412 20.8809 20.5244 20.7191C20.3432 20.6265 20.2764 20.4087 20.3476 20.2182L20.8479 18.8791C20.9352 18.6454 21.1983 18.5345 21.4404 18.5947C21.5565 18.6236 21.6727 18.6449 21.7888 18.6585C22.0492 18.6892 22.3786 18.7045 22.7769 18.7045C23.2671 18.7045 23.6424 18.5054 23.9028 18.1071C24.1786 17.7241 24.3854 17.096 24.5233 16.2228L25.9709 7.28419H24.908C24.6271 7.28419 24.4177 7.0253 24.4764 6.75061L24.7934 5.26658C24.8369 5.06294 25.0168 4.9174 25.225 4.9174H26.3386L26.6373 3.37784C26.7445 2.81104 26.8824 2.32083 27.0509 1.90722C27.2194 1.47828 27.4415 1.12595 27.7173 0.850205C28.0083 0.559144 28.353 0.344678 28.7513 0.206807C29.1649 0.0689356 29.6705 0 30.2679 0C30.513 0 30.7887 0.0153192 31.0951 0.0459577C31.4168 0.0612765 31.7309 0.099574 32.0372 0.16085C32.3436 0.206807 32.6423 0.268082 32.9334 0.344677C33.2245 0.421273 33.4849 0.513187 33.7147 0.62042L33.0483 2.71146C32.696 2.57359 32.336 2.48168 31.9683 2.43572C31.6006 2.38977 31.2406 2.36679 30.8883 2.36679C30.3981 2.36679 30.0381 2.51232 29.8083 2.80338C29.5939 3.09444 29.4407 3.54635 29.3488 4.15911L29.2109 4.9174H30.9734C31.2509 4.9174 31.4596 5.17048 31.4067 5.44291L31.1185 6.92694C31.0782 7.13439 30.8966 7.28419 30.6852 7.28419H28.8432Z"
                        fill="var(--refly-text-0)"
                      />
                      <path
                        d="M34.5713 13.8886C34.4794 14.3328 34.4794 14.6622 34.5713 14.8767C34.6785 15.0911 34.847 15.1984 35.0768 15.1984C35.2639 15.1984 35.4466 15.1823 35.6249 15.1503C35.9449 15.0928 36.282 15.3222 36.271 15.6472L36.2337 16.753C36.2287 16.9014 36.1505 17.0396 36.0158 17.1022C35.7601 17.221 35.4318 17.3218 35.0308 17.4043C34.51 17.5115 33.9968 17.5651 33.4913 17.5651C32.8326 17.5651 32.327 17.4426 31.9747 17.1975C31.6377 16.9371 31.4692 16.4622 31.4692 15.7728C31.4692 15.4205 31.5151 15.0145 31.607 14.555L34.3593 1.55442C34.4025 1.35041 34.5826 1.20446 34.7911 1.20446H36.715C36.9956 1.20446 37.205 1.46285 37.1468 1.73736L34.5713 13.8886Z"
                        fill="var(--refly-text-0)"
                      />
                      <path
                        d="M41.8804 12.2883C41.9097 12.5495 42.2605 12.6131 42.3796 12.3788L45.6018 6.04149C45.6771 5.89342 45.8292 5.80016 45.9953 5.80016H47.9983C48.3317 5.80016 48.5447 6.15559 48.3876 6.4496L43.2199 16.1175C42.7603 16.9754 42.3237 17.7643 41.9101 18.4843C41.5118 19.2043 41.1058 19.8247 40.6922 20.3455C40.2786 20.8664 39.8497 21.2723 39.4054 21.5634C38.9612 21.8545 38.4863 22 37.9808 22C37.4812 22 37.0742 21.9369 36.7597 21.8106C36.5761 21.7369 36.5078 21.5257 36.571 21.3383L37.1294 19.6799C37.1786 19.5338 37.3462 19.47 37.4982 19.4953C37.6055 19.5107 37.705 19.5183 37.7969 19.5183C38.1646 19.5183 38.5399 19.3422 38.9229 18.9898C39.3059 18.6375 39.6888 18.0707 40.0718 17.2894L38.0101 6.32309C37.9591 6.0514 38.1675 5.80016 38.4439 5.80016H40.7572C40.9819 5.80016 41.1708 5.96898 41.1958 6.19228L41.8804 12.2883Z"
                        fill="var(--refly-text-0)"
                      />
                    </svg>
                    <span className="text-neutral-900 dark:text-neutral-50 text-[14px] font-semibold">
                      Agent
                    </span>
                  </motion.div>
                  <motion.span
                    className="text-neutral-400 text-[16px] font-[400]"
                    initial={{ opacity: 0, x: 5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: 0.2 }}
                  >
                    {t('canvas.launchpad.placeholder', 'Describe needs...')}
                  </motion.span>
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <TopToolbar canvasId={canvasId} mode={interactionMode} changeMode={toggleInteractionMode} />
        <div className="flex-grow relative">
          <style>{selectionStyles}</style>
          {readonly && (
            <style>{`
              .react-flow__node {
                cursor: not-allowed !important;
                opacity: 0.9;
              }
              .react-flow__node:hover {
                box-shadow: none !important;
              }
            `}</style>
          )}
          <DropOverlay />
          <ReactFlow
            {...flowConfig}
            className="bg-refly-bg-canvas"
            snapToGrid={true}
            snapGrid={[GRID_SIZE, GRID_SIZE]}
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
            onConnectStart={readonly ? undefined : temporaryEdgeOnConnectStart}
            onConnectEnd={readonly ? undefined : temporaryEdgeOnConnectEnd}
            onNodeClick={handleNodeClick as any}
            onPaneClick={handlePanelClick}
            onPaneContextMenu={readonly ? undefined : (onPaneContextMenu as any)}
            onNodeContextMenu={readonly ? undefined : (onNodeContextMenu as any)}
            onNodeDragStart={readonly ? handleReadonlyDrag : handleNodeDragStart}
            onNodeDragStop={readonly ? undefined : handleNodeDragStop}
            nodeDragThreshold={10}
            nodesDraggable={!readonly}
            nodesConnectable={!readonly}
            elementsSelectable={!readonly}
            onSelectionContextMenu={readonly ? undefined : onSelectionContextMenu}
            deleteKeyCode={readonly ? null : ['Backspace', 'Delete']}
            multiSelectionKeyCode={readonly ? null : ['Shift', 'Meta']}
            onDragOver={handlers.handleDragOver}
            onDragLeave={handlers.handleDragLeave}
            onDrop={handlers.handleDrop}
            onPaste={handlers.handlePaste}
            connectOnClick={false}
            edgesFocusable={false}
            nodesFocusable={!readonly}
            onEdgeClick={readonly ? undefined : handleEdgeClick}
          >
            {nodes?.length === 0 && canvasInitialized && <EmptyGuide canvasId={canvasId} />}

            {memoizedBackground}
            {memoizedMiniMap}
            <HelperLines horizontal={helperLineHorizontal} vertical={helperLineVertical} />
          </ReactFlow>
        </div>

        {/* Display the not found overlay when shareNotFound is true */}
        {readonly && shareNotFound && <NotFoundOverlay />}

        <div
          className="absolute top-[64px] bottom-0 right-2 overflow-x-auto preview-container z-20"
          style={{
            maxWidth: 'calc(100% - 12px)',
          }}
        >
          <div className="relative h-full overflow-y-hidden">
            <NodePreviewContainer canvasId={canvasId} />
          </div>
        </div>

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
              source={contextMenu.source}
              dragCreateInfo={contextMenu.dragCreateInfo}
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

  const {
    sidePanelVisible,
    resourcesPanelWidth,
    setResourcesPanelWidth,
    showLeftOverview,
    setShowLeftOverview,
  } = useCanvasResourcesPanelStoreShallow((state) => ({
    sidePanelVisible: state.sidePanelVisible,
    resourcesPanelWidth: state.panelWidth,
    setResourcesPanelWidth: state.setPanelWidth,
    showLeftOverview: state.showLeftOverview,
    setShowLeftOverview: state.setShowLeftOverview,
  }));

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

  // Handle panel resize
  const handlePanelResize = useCallback(
    (sizes: number[]) => {
      if (sizes.length >= 2) {
        setResourcesPanelWidth(sizes[1]);
      }
    },
    [setResourcesPanelWidth],
  );

  // Calculate max width as 50% of parent container
  const [maxPanelWidth, setMaxPanelWidth] = useState(800);

  useEffect(() => {
    const updateMaxWidth = () => {
      const canvasContainer = document.querySelector('.canvas-splitter');
      if (canvasContainer) {
        setMaxPanelWidth(Math.floor(canvasContainer.clientWidth * 0.5));
      }
    };

    // Initial calculation
    updateMaxWidth();

    // Listen for window resize events
    const resizeObserver = new ResizeObserver(updateMaxWidth);
    const canvasContainer = document.querySelector('.canvas-splitter');
    if (canvasContainer) {
      resizeObserver.observe(canvasContainer);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Close resources overview popover when clicking outside
  const handleClickOutsideResourcesPopover = useCallback(
    (event: MouseEvent) => {
      if (!showLeftOverview) {
        return;
      }

      const targetEl = event.target as HTMLElement | null;
      const isInside = targetEl?.closest?.('[data-refly-resources-popover="true"]');
      if (isInside) return;

      setShowLeftOverview(false);
    },
    [showLeftOverview, setShowLeftOverview],
  );

  useEffect(() => {
    if (!showLeftOverview) {
      return;
    }

    // Use capture phase to ensure we catch early
    document.addEventListener('mousedown', handleClickOutsideResourcesPopover, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideResourcesPopover, true);
    };
  }, [showLeftOverview, handleClickOutsideResourcesPopover]);

  return (
    <EditorPerformanceProvider>
      <ReactFlowProvider>
        <CanvasProvider readonly={readonly} canvasId={canvasId}>
          <Splitter
            className="canvas-splitter w-full h-[calc(100vh-16px)]"
            onResize={handlePanelResize}
          >
            <Splitter.Panel>
              <Flow canvasId={canvasId} />
            </Splitter.Panel>

            <Splitter.Panel
              size={sidePanelVisible ? resourcesPanelWidth : 0}
              min={480}
              max={maxPanelWidth}
            >
              <Popover
                classNames={{
                  root: 'resources-panel-popover',
                }}
                open={showLeftOverview}
                onOpenChange={setShowLeftOverview}
                arrow={false}
                content={
                  <div className="flex w-[360px] h-full" data-refly-resources-popover="true">
                    <ResourceOverview />
                  </div>
                }
                placement="left"
                align={{
                  offset: [0, 0],
                }}
              >
                <CanvasResources />
              </Popover>
            </Splitter.Panel>
          </Splitter>
          <CanvasResourcesWidescreenModal />
        </CanvasProvider>
      </ReactFlowProvider>
    </EditorPerformanceProvider>
  );
};

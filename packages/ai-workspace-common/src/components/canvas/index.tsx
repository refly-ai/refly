import { useCallback, useMemo, useEffect, useState, useRef, memo } from 'react';
import { Button, Modal, Result, message, Splitter, Popover } from 'antd';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  ReactFlow,
  Background,
  ReactFlowProvider,
  useReactFlow,
  Node,
  Edge,
  useStore,
  SelectionMode,
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
import { useHandleOrphanNode } from '@refly-packages/ai-workspace-common/hooks/use-handle-orphan-node';
import { WorkflowRun } from './workflow-run';
import { useMatch } from '@refly-packages/ai-workspace-common/utils/router';
import { useInitializeWorkflow } from '@refly-packages/ai-workspace-common/hooks/use-initialize-workflow';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { UploadNotification } from '@refly-packages/ai-workspace-common/components/common/upload-notification';

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

const SessionContainerClassName = `
  absolute bottom-2 left-[calc(50%-284px)] transform -translate-x-1/2 z-20 w-[568px] overflow-hidden rounded-[20px] shadow-refly-xl border-[1px] border-solid border-refly-Card-Border bg-refly-bg-glass-content backdrop-blur-[20px]
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

const Flow = memo(({ canvasId }: { canvasId: string }) => {
  const { t } = useTranslation();

  useHandleOrphanNode();

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
      activeSessionId: state.activeSessionIdByCanvas?.[canvasId] ?? null,
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

  const { showWorkflowRun, setShowWorkflowRun } = useCanvasResourcesPanelStoreShallow((state) => ({
    setShowWorkflowRun: state.setShowWorkflowRun,
    showWorkflowRun: state.showWorkflowRun,
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
      message.success(t(`canvas.toolbar.modeChangeSuccess.${mode}`));
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

  // Custom selection state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

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

  // Custom selection handlers
  const handleSelectionStart = useCallback(
    (event: React.MouseEvent | React.TouchEvent, isRightClick = false) => {
      if (readonly) return;

      // Check for right click or two-finger + Shift touch
      const isRightButton = isRightClick || (event as React.MouseEvent).button === 2;
      const isTwoFingerWithShift =
        (event as React.TouchEvent).touches?.length === 2 && (event as React.TouchEvent).shiftKey;

      if (!isRightButton && !isTwoFingerWithShift) return;

      event.preventDefault();
      event.stopPropagation();

      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: clientX,
        y: clientY,
      });

      setIsSelecting(true);
      setSelectionStart(flowPosition);
      setSelectionBox({
        x: flowPosition.x,
        y: flowPosition.y,
        width: 0,
        height: 0,
      });
    },
    [readonly, reactFlowInstance],
  );

  const handleSelectionMove = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (!isSelecting || readonly) return;

      event.preventDefault();

      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: clientX,
        y: clientY,
      });

      if (selectionStart) {
        setSelectionBox({
          x: Math.min(selectionStart.x, flowPosition.x),
          y: Math.min(selectionStart.y, flowPosition.y),
          width: Math.abs(flowPosition.x - selectionStart.x),
          height: Math.abs(flowPosition.y - selectionStart.y),
        });
      }
    },
    [isSelecting, readonly, selectionStart, reactFlowInstance],
  );

  const handleSelectionEnd = useCallback(() => {
    if (!isSelecting || readonly) return;

    setIsSelecting(false);

    if (selectionBox && selectionBox.width > 5 && selectionBox.height > 5) {
      // Get nodes within selection area
      const nodes = reactFlowInstance.getNodes();
      const selectedNodes = nodes.filter((node) => {
        const nodeX = node.position.x;
        const nodeY = node.position.y;
        const nodeWidth = node.width || 200; // Default node width
        const nodeHeight = node.height || 100; // Default node height

        // Check if node intersects with selection box (supports partial selection)
        return (
          nodeX < selectionBox.x + selectionBox.width &&
          nodeX + nodeWidth > selectionBox.x &&
          nodeY < selectionBox.y + selectionBox.height &&
          nodeY + nodeHeight > selectionBox.y
        );
      });

      // Select nodes
      if (selectedNodes.length > 0) {
        reactFlowInstance.setNodes((nodes) =>
          nodes.map((node) => ({
            ...node,
            selected: selectedNodes.some((selected) => selected.id === node.id),
          })),
        );
      }
    }

    setSelectionStart(null);
    setSelectionBox(null);
  }, [isSelecting, readonly, selectionBox, reactFlowInstance]);

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

  // Add mouse and touch event listeners
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 2) {
        // Right click
        handleSelectionStart(event as any, true);
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      handleSelectionMove(event as any);
    };

    const handleMouseUp = () => {
      handleSelectionEnd();
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2 && event.shiftKey) {
        // Two-finger + Shift touch
        handleSelectionStart(event as any);
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && event.shiftKey) {
        handleSelectionMove(event as any);
      }
    };

    const handleTouchEnd = () => {
      handleSelectionEnd();
    };

    // Add event listeners
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleSelectionStart, handleSelectionMove, handleSelectionEnd]);

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

    if (showWorkflowRun) {
      setShowWorkflowRun(false);
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
        case 'start':
          menuNodeType = 'start';
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

  // Memoize the Background component
  const memoizedBackground = useMemo(() => <MemoizedBackground />, []);

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

  // Handle keyboard shortcuts for edge deletion and zoom
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

      // Handle zoom shortcuts (Cmd/Ctrl + +/-)
      if (isModKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        reactFlowInstance.zoomIn();
      }

      if (isModKey && e.key === '-') {
        e.preventDefault();
        reactFlowInstance.zoomOut();
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

  // Handle edge click for delete button
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

  // Add keyboard event listener
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
      setActiveSessionId(canvasId, sessionId);
    },
    [setActiveSessionId, canvasId],
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
        {!readonly && (
          <AnimatePresence mode="wait">
            {isPilotOpen ? (
              <motion.div
                key="pilot-panel"
                className={SessionContainerClassName}
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
                className={SessionContainerClassName}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                <SessionHeader
                  canvasId={canvasId}
                  session={session}
                  steps={session?.steps ?? []}
                  onClick={handleClick}
                  onSessionClick={handleSessionClick}
                />
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
                    className="rounded-[20px] h-14 py-3 px-4 shadow-refly-xl hover:shadow transition-colors flex items-center gap-3 w-[280px] max-w-[92vw] border-[1px] border-solid border-refly-Card-Border bg-refly-bg-glass-content backdrop-blur-[20px]"
                    onClick={() => setIsPilotOpen(true)}
                  >
                    <motion.div
                      className="flex items-center shrink-0"
                      initial={{ x: -5 }}
                      animate={{ x: 0 }}
                      transition={{ duration: 0.2, delay: 0.1 }}
                    >
                      <Logo logoProps={{ show: false }} />
                      <span className="text-refly-text-0 text-[14px] ml-0.5">Agent</span>
                    </motion.div>
                    <motion.span
                      className="text-refly-text-2 text-[16px] font-normal"
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
        )}

        <TopToolbar canvasId={canvasId} mode={interactionMode} changeMode={toggleInteractionMode} />
        <div className="flex-grow relative">
          <style>{selectionStyles}</style>
          {readonly && (
            <style>{`
              .react-flow__node {
                cursor: not-allowed !important;
              }
            `}</style>
          )}
          <DropOverlay />
          <ReactFlow
            {...flowConfig}
            selectionMode={SelectionMode.Partial}
            className="bg-refly-bg-canvas"
            snapToGrid={true}
            snapGrid={[GRID_SIZE, GRID_SIZE]}
            edgeTypes={edgeTypes}
            // Unified mouse and touchpad gesture configuration
            panOnScroll={true} // Enable scroll panning
            panOnScrollSpeed={0.5} // Adjust scroll speed
            panOnDrag={true} // Enable mouse left-click and touchpad single-finger drag
            zoomOnScroll={true} // Enable scroll zooming
            zoomOnPinch={true} // Enable touchpad two-finger pinch zoom
            zoomOnDoubleClick={false}
            // Disable default selection behavior, use custom implementation
            selectNodesOnDrag={false}
            selectionOnDrag={false}
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
            <HelperLines horizontal={helperLineHorizontal} vertical={helperLineVertical} />

            {/* Custom selection box */}
            {isSelecting && selectionBox && (
              <div
                className="absolute pointer-events-none border-2 border-blue-500 bg-blue-100 bg-opacity-20 z-50"
                style={{
                  left: selectionBox.x,
                  top: selectionBox.y,
                  width: selectionBox.width,
                  height: selectionBox.height,
                }}
              />
            )}
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
  const isPreviewCanvas = useMatch('/preview/canvas/:shareId');
  const { canvasId, readonly } = props;
  const setCurrentCanvasId = useCanvasStoreShallow((state) => state.setCurrentCanvasId);
  const { initializeWorkflow, loading, executionId, workflowStatus, isPolling, pollingError } =
    useInitializeWorkflow(canvasId);
  const {
    sidePanelVisible,
    resourcesPanelWidth,
    setResourcesPanelWidth,
    showLeftOverview,
    setShowLeftOverview,
    showWorkflowRun,
  } = useCanvasResourcesPanelStoreShallow((state) => ({
    sidePanelVisible: state.sidePanelVisible,
    resourcesPanelWidth: state.panelWidth,
    setResourcesPanelWidth: state.setPanelWidth,
    showLeftOverview: state.showLeftOverview,
    setShowLeftOverview: state.setShowLeftOverview,
    showWorkflowRun: state.showWorkflowRun,
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
        <CanvasProvider
          readonly={readonly}
          canvasId={canvasId}
          workflowRun={{
            initialize: (startNodes?: string[]) => initializeWorkflow({ canvasId, startNodes }),
            loading,
            executionId,
            workflowStatus,
            isPolling,
            pollingError,
          }}
        >
          <UploadNotification />

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
              {showWorkflowRun && !readonly && !isPreviewCanvas ? (
                <WorkflowRun
                  initializeWorkflow={initializeWorkflow}
                  loading={loading}
                  executionId={executionId}
                  workflowStatus={workflowStatus}
                  isPolling={isPolling}
                  pollingError={pollingError}
                />
              ) : (
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
              )}
            </Splitter.Panel>
          </Splitter>
          <CanvasResourcesWidescreenModal />
        </CanvasProvider>
      </ReactFlowProvider>
    </EditorPerformanceProvider>
  );
};

// Re-export providers for external use
export { ReactFlowProvider } from '@xyflow/react';

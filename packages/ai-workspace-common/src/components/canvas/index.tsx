import { useCallback, useMemo, useEffect, useState, useRef, memo } from 'react';
import { Modal, Result, message } from 'antd';
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
  useCanvasResourcesPanelStoreShallow,
  useUserStoreShallow,
  useCopilotStoreShallow,
} from '@refly/stores';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { locateToNodePreviewEmitter } from '@refly-packages/ai-workspace-common/events/locateToNodePreview';
import { UnifiedContextMenu } from './unified-context-menu';
import { useNodePreviewControl } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-preview-control';
import {
  EditorPerformanceProvider,
  useEditorPerformance,
} from '@refly-packages/ai-workspace-common/context/editor-performance';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useEdgeOperations } from '@refly-packages/ai-workspace-common/hooks/canvas/use-edge-operations';
import { CustomEdge } from './edges/custom-edge';
import NotFoundOverlay from './NotFoundOverlay';
import { useDragToCreateNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-drag-create-node';
import { useDragDropPaste } from '@refly-packages/ai-workspace-common/hooks/canvas/use-drag-drop-paste';

import '@xyflow/react/dist/style.css';
import './index.scss';
import { EmptyGuide } from './empty-guide';
import { useLinearThreadReset } from '@refly-packages/ai-workspace-common/hooks/canvas/use-linear-thread-reset';
import HelperLines from './common/helper-line/index';
import { useListenNodeOperationEvents } from '@refly-packages/ai-workspace-common/hooks/canvas/use-listen-node-events';
import { runtime } from '@refly/ui-kit';
import {
  NodeContextMenuSource,
  NodeDragCreateInfo,
  nodeOperationsEmitter,
} from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { WorkflowRun } from './workflow-run';
import { useCanvasInitialActions } from '@refly-packages/ai-workspace-common/hooks/use-canvas-initial-actions';
import { CanvasDrive, CanvasResourcesWidescreenModal } from './canvas-resources';
import { ToolbarButtons } from './top-toolbar/toolbar-buttons';
import { CanvasControlButtons } from './top-toolbar/canvas-control-buttons';
import { ToggleCopilotPanel } from './top-toolbar/toggle-copilot-panel';
import { useHandleOrphanNode } from '@refly-packages/ai-workspace-common/hooks/use-handle-orphan-node';
import { UploadNotification } from '@refly-packages/ai-workspace-common/components/common/upload-notification';
import { useCanvasLayout } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-layout';
import { PreviewBoxInCanvas } from './preview-box-in-canvas';
import { CopilotContainer } from './copilot-container';
import { cn } from '@refly/utils/cn';

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
  
  /* Prevent text selection outside canvas during drag */
  .react-flow__pane.selecting {
    user-select: none;
  }
  
  .react-flow__pane.selecting * {
    user-select: none !important;
  }
  
  /* Ensure canvas selection works properly */
  .react-flow__pane {
    user-select: auto;
  }
`;

interface ContextMenuState {
  open: boolean;
  position: { x: number; y: number };
  type: 'canvas' | 'node' | 'selection' | 'doubleClick';
  nodeId?: string;
  nodeType?: CanvasNodeType;
  isSelection?: boolean;
  source?: 'node' | 'handle';
  dragCreateInfo?: NodeDragCreateInfo;
}

// Add new memoized components
const MemoizedBackground = memo(Background);

interface FlowProps {
  canvasId: string;
  copilotWidth: number;
  setCopilotWidth: (width: number | null) => void;
  maxPanelWidth: number;
}

const Flow = memo(({ canvasId, copilotWidth, setCopilotWidth, maxPanelWidth }: FlowProps) => {
  const { t } = useTranslation();

  // Wrap setCopilotWidth to handle null values
  const handleSetCopilotWidth = useCallback(
    (width: number) => {
      if (width !== null && width !== undefined) {
        setCopilotWidth(width);
      }
    },
    [setCopilotWidth],
  );

  useHandleOrphanNode();

  useCanvasInitialActions(canvasId);

  const { addNode } = useAddNode();
  const { nodes, edges } = useStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
    })),
  );

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
  const { onLayout } = useCanvasLayout();

  const {
    canvasInitialized,
    operatingNodeId,
    setOperatingNodeId,
    setInitialFitViewCompleted,
    setContextMenuOpenedCanvasId,
  } = useCanvasStoreShallow((state) => ({
    canvasInitialized: state.canvasInitialized[canvasId],
    operatingNodeId: state.operatingNodeId,
    setOperatingNodeId: state.setOperatingNodeId,
    setInitialFitViewCompleted: state.setInitialFitViewCompleted,
    setContextMenuOpenedCanvasId: state.setContextMenuOpenedCanvasId,
  }));

  const { showWorkflowRun, setShowWorkflowRun, sidePanelVisible } =
    useCanvasResourcesPanelStoreShallow((state) => ({
      setShowWorkflowRun: state.setShowWorkflowRun,
      showWorkflowRun: state.showWorkflowRun,
      sidePanelVisible: state.sidePanelVisible,
    }));

  const { handleNodePreview } = useNodePreviewControl({ canvasId });

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

  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [lastClickTime, setLastClickTime] = useState(0);

  // Handle selection state to prevent text selection outside canvas
  useEffect(() => {
    let isDragging = false;
    let dragStartTime = 0;
    let hasStartedDrag = false;

    const resetDragState = () => {
      if (isDragging || hasStartedDrag) {
        isDragging = false;
        hasStartedDrag = false;
        // Re-enable text selection
        document.body.style.userSelect = '';
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      // Only handle left mouse button
      if (event.button !== 0) return;

      // Check if clicking on interactive elements (don't start selection)
      const target = event.target as HTMLElement;
      const isInteractiveElement = target.closest(
        'input, textarea, [contenteditable="true"], [role="textbox"], .chat-composer, .rich-input, [data-cy="chat-input"], [data-cy="rich-chat-input"], .ProseMirror',
      );

      if (isInteractiveElement) return;

      isDragging = false;
      hasStartedDrag = false;
      dragStartTime = Date.now();
    };

    const handleMouseMove = (event: MouseEvent) => {
      // Only handle left mouse button
      if (event.buttons !== 1) return;

      // Check if we've moved enough to consider it a drag
      const timeSinceStart = Date.now() - dragStartTime;
      const hasMovedEnough = timeSinceStart > 10;

      if (!isDragging && hasMovedEnough && !hasStartedDrag) {
        isDragging = true;
        hasStartedDrag = true;
        // Temporarily disable text selection on the document
        document.body.style.userSelect = 'none';
      }
    };

    const handleMouseUp = () => {
      resetDragState();
    };

    const handleMouseLeave = () => {
      resetDragState();
    };

    // Global mouse up handler to ensure state reset
    const handleGlobalMouseUp = () => {
      resetDragState();
    };

    // Listen for ReactFlow selection events
    const canvasContainer = document.querySelector('.react-flow');
    if (canvasContainer) {
      canvasContainer.addEventListener('mousedown', handleMouseDown);
      canvasContainer.addEventListener('mousemove', handleMouseMove);
      canvasContainer.addEventListener('mouseup', handleMouseUp);
      canvasContainer.addEventListener('mouseleave', handleMouseLeave);
    }

    // Add global event listeners for cleanup
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      if (canvasContainer) {
        canvasContainer.removeEventListener('mousedown', handleMouseDown);
        canvasContainer.removeEventListener('mousemove', handleMouseMove);
        canvasContainer.removeEventListener('mouseup', handleMouseUp);
        canvasContainer.removeEventListener('mouseleave', handleMouseLeave);
      }

      // Remove global event listeners
      document.removeEventListener('mouseup', handleGlobalMouseUp);

      // Ensure text selection is re-enabled on cleanup
      document.body.style.userSelect = '';
    };
  }, []);

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
      setShowWorkflowRun(false);

      // Handle double click detection
      const currentTime = new Date().getTime();
      const timeDiff = currentTime - lastClickTime;

      if (timeDiff < 300 && !readonly) {
        const flowPosition = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        setContextMenu({
          open: true,
          position: flowPosition,
          type: 'doubleClick',
        });
      }

      setLastClickTime(currentTime);
    },
    [
      lastClickTime,
      setOperatingNodeId,
      reactFlowInstance,
      selectedEdgeId,
      cleanupTemporaryEdges,
      readonly,
      setShowWorkflowRun,
    ],
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

  // Global menu close logic
  useEffect(() => {
    const isInsideMenu = (target: HTMLElement) => {
      return (
        target.closest('[data-unified-menu]') ||
        target.closest('.canvas-search-list') ||
        target.closest('.menu-popper')
      );
    };

    const handleGlobalClick = (event: MouseEvent) => {
      if (contextMenu.open) {
        // Check if click is inside any menu
        const target = event.target as HTMLElement;
        if (!isInsideMenu(target)) {
          setContextMenu((prev) => ({ ...prev, open: false }));
        }
      }
    };

    const handleGlobalMouseDown = (event: MouseEvent) => {
      if (contextMenu.open && event.button === 0) {
        // Left mouse button - check if click is inside menu before closing
        const target = event.target as HTMLElement;
        if (!isInsideMenu(target)) {
          setContextMenu((prev) => ({ ...prev, open: false }));
        }
      }
    };

    if (contextMenu.open) {
      document.addEventListener('click', handleGlobalClick);
      document.addEventListener('mousedown', handleGlobalMouseDown);
    }

    return () => {
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('mousedown', handleGlobalMouseDown);
    };
  }, [contextMenu.open]);

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
      setShowWorkflowRun(false);

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
    [handleNodePreview, setOperatingNodeId, setSelectedNode, setShowWorkflowRun],
  );

  // Memoize nodes and edges
  const memoizedNodes = useMemo(() => nodes, [nodes]);
  const memoizedEdges = useMemo(() => edges, [edges]);
  const selectedNode = useMemo(() => nodes.find((node) => node.selected) as CanvasNode, [nodes]);

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

      // Fit view (Cmd/Ctrl + 0)
      if (isModKey && e.key === '0') {
        e.preventDefault();
        reactFlowInstance?.fitView?.();
      }

      // Auto layout (Cmd/Ctrl + Shift + L)
      if (isModKey && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        onLayout?.('LR');
      }

      // Handle edge deletion
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEdgeId) {
        e.preventDefault();
        const { setEdges } = reactFlowInstance;
        setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
        setSelectedEdgeId(null);
      }
    },
    [selectedEdgeId, reactFlowInstance, undo, redo, readonly, onLayout],
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
      // Extract nodeId from event name
      const nodeId = event.nodeId;

      // Check if event contains necessary information
      if (event?.nodeType) {
        // Create a synthetic React mouse event
        const syntheticEvent = {
          ...event.originalEvent,
          clientX: event.x,
          clientY: event.y,
          preventDefault: () => {},
          stopPropagation: () => {},
        } as React.MouseEvent;

        // Create a simplified node object with necessary properties
        const node = {
          id: nodeId,
          type: event.nodeType as CanvasNodeType,
          data: { type: event.nodeType },
          position: { x: event.x, y: event.y },
        } as unknown as CanvasNode<any>;

        // Call onNodeContextMenu to handle context menu
        onNodeContextMenu(syntheticEvent, node, {
          source: event.source,
          dragCreateInfo: event.dragCreateInfo,
        });
      }
    };

    // Listen for all events containing openContextMenu
    nodeOperationsEmitter.on('openNodeContextMenu', handleOpenContextMenu);

    return () => {
      // Clean up event listeners
      nodeOperationsEmitter.off('openNodeContextMenu', handleOpenContextMenu);
    };
  }, [onNodeContextMenu]);

  return (
    <Spin
      className="canvas-spin w-full h-full"
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
      <div className="w-full h-full relative flex flex-col overflow-hidden shadow-sm rounded-xl border-solid border-[1px] border-refly-Card-Border">
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
            // Enable default selection behavior
            selectNodesOnDrag={true}
            selectionOnDrag={true}
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
          </ReactFlow>
        </div>
        {/* Display the not found overlay when shareNotFound is true */}
        {readonly && shareNotFound && <NotFoundOverlay />}
        {!sidePanelVisible && <CanvasControlButtons />}
        <ToolbarButtons canvasId={canvasId} />
        <PreviewBoxInCanvas node={selectedNode} />
        <WorkflowRun />
        <CopilotContainer
          copilotWidth={copilotWidth}
          setCopilotWidth={handleSetCopilotWidth}
          maxPanelWidth={maxPanelWidth}
        />
        <ToggleCopilotPanel copilotWidth={copilotWidth} setCopilotWidth={setCopilotWidth} />
        <UnifiedContextMenu
          open={contextMenu.open}
          position={contextMenu.position}
          menuType={contextMenu.type}
          context={{
            nodeId: contextMenu.nodeId,
            nodeType: contextMenu.nodeType,
            source: contextMenu.source,
            dragCreateInfo: contextMenu.dragCreateInfo,
            isSelection: contextMenu.isSelection,
          }}
          setOpen={(open) => setContextMenu((prev) => ({ ...prev, open }))}
        />
      </div>
    </Spin>
  );
});

export const Canvas = (props: { canvasId: string; readonly?: boolean }) => {
  const { canvasId, readonly } = props;
  const setCurrentCanvasId = useCanvasStoreShallow((state) => state.setCurrentCanvasId);

  const { sidePanelVisible, setSidePanelVisible, resetState } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      sidePanelVisible: state.sidePanelVisible,
      setSidePanelVisible: state.setSidePanelVisible,
      resetState: state.resetState,
    }),
  );

  const { canvasCopilotWidth, setCanvasCopilotWidth } = useCopilotStoreShallow((state) => ({
    canvasCopilotWidth: state.canvasCopilotWidth[canvasId] ?? 400,
    setCanvasCopilotWidth: state.setCanvasCopilotWidth,
  }));
  const isLogin = useUserStoreShallow((state) => state.isLogin);

  const [copilotWidth, setCopilotWidth] = useState(!readonly && isLogin ? 400 : 0);

  const handleSetCopilotWidth = useCallback(
    (width: number) => {
      setCopilotWidth(width);
      setCanvasCopilotWidth(canvasId, width);
    },
    [canvasId, setCanvasCopilotWidth, setCopilotWidth],
  );

  useEffect(() => {
    if (readonly || !isLogin) {
      handleSetCopilotWidth(0);
      return;
    }
    if (!canvasCopilotWidth && canvasCopilotWidth !== 0) {
      handleSetCopilotWidth(400);
    } else {
      setCopilotWidth(canvasCopilotWidth);
    }
  }, [canvasCopilotWidth, canvasId]);

  useEffect(() => {
    setSidePanelVisible(false);

    if (readonly) {
      return;
    }

    if (canvasId && canvasId !== 'empty') {
      setCurrentCanvasId(canvasId);
    } else {
      setCurrentCanvasId(null);
    }

    return () => {
      setCurrentCanvasId(null);
    };
  }, [canvasId, setCurrentCanvasId]);

  // Calculate max width as 50% of parent container
  const [maxPanelWidth, setMaxPanelWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateMaxWidth = () => {
      if (containerRef.current) {
        setMaxPanelWidth(Math.floor(containerRef.current.clientWidth * 0.5));
      }
    };

    // Initial calculation
    updateMaxWidth();

    // Listen for window resize events
    const resizeObserver = new ResizeObserver(updateMaxWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    resetState();
  }, [canvasId]);

  return (
    <EditorPerformanceProvider>
      <ReactFlowProvider>
        <CanvasProvider readonly={readonly} canvasId={canvasId}>
          <UploadNotification />
          <TopToolbar canvasId={canvasId} />

          <div
            ref={containerRef}
            className={cn(
              'canvas-container flex w-full h-full flex-grow overflow-hidden',
              !sidePanelVisible ? 'gap-0' : 'gap-2',
            )}
          >
            <Flow
              canvasId={canvasId}
              copilotWidth={copilotWidth}
              setCopilotWidth={handleSetCopilotWidth}
              maxPanelWidth={maxPanelWidth}
            />
            <CanvasDrive className={!sidePanelVisible ? 'hidden' : ''} />
          </div>
          <CanvasResourcesWidescreenModal />
        </CanvasProvider>
      </ReactFlowProvider>
    </EditorPerformanceProvider>
  );
};

// Re-export providers for external use
export { ReactFlowProvider } from '@xyflow/react';

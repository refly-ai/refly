import { useCallback, useMemo, useEffect, useState, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReactFlow,
  Background,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  Node,
} from '@xyflow/react';
import { Button } from 'antd';
import { nodeTypes, CanvasNode } from './nodes';
import { LaunchPad } from './launchpad';
import { CanvasToolbar } from './canvas-toolbar';
import { TopToolbar } from './top-toolbar';
import { NodePreview } from './node-preview';
import { ContextMenu } from './context-menu';
import { NodeContextMenu } from './node-context-menu';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
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

import '@xyflow/react/dist/style.css';
import './index.scss';
import { SelectionContextMenu } from '@refly-packages/ai-workspace-common/components/canvas/selection-context-menu';
import { useUserStore } from '@refly-packages/ai-workspace-common/stores/user';
import { useUpdateSettings } from '@refly-packages/ai-workspace-common/queries';
import { IconCreateDocument } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { useCanvasSync } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-sync';

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

  const { onEdgesChange, onConnect } = useEdgeOperations(canvasId);
  const edgeStyles = useEdgeStyles();

  const { nodePreviews, showPreview, showLaunchpad, showMaxRatio } = useCanvasStoreShallow(
    (state) => ({
      nodePreviews: state.config[canvasId]?.nodePreviews,
      showPreview: state.showPreview,
      showLaunchpad: state.showLaunchpad,
      showMaxRatio: state.showMaxRatio,
    }),
  );

  const { showCanvasListModal, showLibraryModal, setShowCanvasListModal, setShowLibraryModal } =
    useSiderStoreShallow((state) => ({
      showCanvasListModal: state.showCanvasListModal,
      showLibraryModal: state.showLibraryModal,
      setShowCanvasListModal: state.setShowCanvasListModal,
      setShowLibraryModal: state.setShowLibraryModal,
    }));

  const reactFlowInstance = useReactFlow();

  const { pendingNode, clearPendingNode } = useCanvasNodesStore();
  const { provider } = useCanvasContext();

  const { config, operatingNodeId, setOperatingNodeId, setInitialFitViewCompleted } =
    useCanvasStoreShallow((state) => ({
      config: state.config[canvasId],
      operatingNodeId: state.operatingNodeId,
      setOperatingNodeId: state.setOperatingNodeId,
      setInitialFitViewCompleted: state.setInitialFitViewCompleted,
    }));
  const hasCanvasSynced = config?.localSyncedAt > 0 && config?.remoteSyncedAt > 0;

  const { createSingleDocumentInCanvas, isCreating: isCreatingDocument } = useCreateDocument();

  const { handleNodePreview } = useNodePreviewControl({ canvasId });

  const interactionMode = useUserStore.getState().localSettings.canvasMode;
  const { localSettings, setLocalSettings } = useUserStore.getState();
  const { mutate: updateSettings } = useUpdateSettings();
  const toggleInteractionMode = (mode: 'mouse' | 'touchpad') => {
    setLocalSettings({
      ...localSettings,
      canvasMode: mode,
    });
    updateSettings({
      body: {
        preferences: {
          operationMode: mode,
        },
      },
    });
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
  const [lastClickTime, setLastClickTime] = useState(0);

  const handlePanelClick = useCallback(
    (event: React.MouseEvent) => {
      setOperatingNodeId(null);
      setContextMenu((prev) => ({ ...prev, open: false }));

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
    [lastClickTime, setOperatingNodeId, reactFlowInstance],
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
        <LaunchPad visible={showLaunchpad} />
      </div>
    ),
    [showLaunchpad],
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
      />
    ),
    [miniMapStyles],
  );

  // Memoize the node types configuration
  const memoizedNodeTypes = useMemo(() => nodeTypes, []);

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

  const handleKeyDown = (e: KeyboardEvent) => {
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
        undoManager.redo();
      } else {
        // Mod+Z for Undo
        undoManager.undo();
      }
    }
  };

  // Set up keyboard shortcuts for undo/redo
  useEffect(() => {
    if (!undoManager) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoManager]);

  return (
    <Spin
      className="w-full h-full"
      style={{ maxHeight: '100%' }}
      spinning={!hasCanvasSynced && provider.status !== 'connected' && !connectionTimeout}
      tip={connectionTimeout ? t('common.connectionFailed') : t('common.loading')}
    >
      <div className="w-full h-screen relative flex flex-col overflow-hidden">
        <CanvasToolbar onToolSelect={handleToolSelect} />
        <TopToolbar canvasId={canvasId} />
        <div className="flex-grow relative">
          <style>{selectionStyles}</style>
          <ReactFlow
            {...flowConfig}
            panOnScroll={interactionMode === 'touchpad'}
            panOnDrag={interactionMode === 'mouse'}
            zoomOnScroll={interactionMode === 'mouse'}
            zoomOnPinch={interactionMode === 'touchpad'}
            zoomOnDoubleClick={false}
            selectNodesOnDrag={!operatingNodeId && interactionMode === 'mouse'}
            selectionOnDrag={!operatingNodeId && interactionMode === 'touchpad'}
            nodeTypes={memoizedNodeTypes}
            nodes={memoizedNodes}
            edges={memoizedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePanelClick}
            onPaneContextMenu={onPaneContextMenu}
            onNodeContextMenu={onNodeContextMenu}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            nodeDragThreshold={10}
            nodesDraggable={!operatingNodeId}
            onSelectionContextMenu={onSelectionContextMenu}
            deleteKeyCode={['Backspace', 'Delete']}
            multiSelectionKeyCode={['Shift', 'Meta']}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {nodes?.length === 0 && hasCanvasSynced && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
                <div className="flex items-center justify-center text-gray-500 text-center">
                  <div className="text-[20px]">{t('canvas.emptyText')}</div>
                  <Button
                    loading={isCreatingDocument}
                    icon={<IconCreateDocument className="-mr-1 flex items-center justify-center" />}
                    type="text"
                    className="ml-0.5 text-[20px] text-[#00968F] py-[4px] px-[8px]"
                    onClick={() => createSingleDocumentInCanvas()}
                    data-cy="canvas-create-document-button"
                  >
                    {t('canvas.toolbar.createDocument')}
                  </Button>
                </div>
              </div>
            )}

            {memoizedBackground}
            {memoizedMiniMap}
          </ReactFlow>

          <LayoutControl mode={interactionMode} changeMode={toggleInteractionMode} />

          {memoizedLaunchPad}
        </div>

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

export const Canvas = (props: { canvasId: string }) => {
  const { canvasId } = props;
  const setCurrentCanvasId = useCanvasStoreShallow((state) => state.setCurrentCanvasId);

  useEffect(() => {
    if (canvasId && canvasId !== 'empty') {
      setCurrentCanvasId(canvasId);
    } else {
      setCurrentCanvasId(null);
    }
  }, [canvasId, setCurrentCanvasId]);

  return (
    <EditorPerformanceProvider>
      <CanvasProvider canvasId={canvasId}>
        <ReactFlowProvider>
          <Flow canvasId={canvasId} />
        </ReactFlowProvider>
      </CanvasProvider>
    </EditorPerformanceProvider>
  );
};

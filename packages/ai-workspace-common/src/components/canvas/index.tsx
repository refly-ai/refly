import { useCallback, useMemo, useEffect, useState, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactFlow, Background, MiniMap, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { Button, Modal, Result } from 'antd';
import { nodeTypes, CanvasNode } from './nodes';
import { LaunchPad } from './launchpad';
import { CanvasToolbar } from './canvas-toolbar';
import { TopToolbar } from './top-toolbar';
import { NodePreview } from './node-preview';
import { HiOutlineDocumentAdd } from 'react-icons/hi';
import { ContextMenu } from './context-menu';
import { NodeContextMenu } from './node-context-menu';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';

import '@xyflow/react/dist/style.css';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { CanvasProvider, useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useEdgeStyles } from './constants';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useCanvasStore, useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { BigSearchModal } from '@refly-packages/ai-workspace-common/components/search/modal';
import { CanvasListModal } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal';
import { LibraryModal } from '@refly-packages/ai-workspace-common/components/workspace/library-modal';
import { useCanvasNodesStore } from '@refly-packages/ai-workspace-common/stores/canvas-nodes';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { LayoutControl } from './layout-control';
import { addPinnedNodeEmitter } from '@refly-packages/ai-workspace-common/events/addPinnedNode';
import { MenuPopper } from './menu-popper';
import { useNodePreviewControl } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-preview-control';
import {
  EditorPerformanceProvider,
  useEditorPerformance,
} from '@refly-packages/ai-workspace-common/context/editor-performance';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useEdgeOperations } from '@refly-packages/ai-workspace-common/hooks/canvas/use-edge-operations';
import { useNodeSelection } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-selection';
import { useNodeOperations } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-operations';

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

const POLLING_COOLDOWN_TIME = 5000;

interface ContextMenuState {
  open: boolean;
  position: { x: number; y: number };
  type: 'canvas' | 'node';
  nodeId?: string;
  nodeType?: CanvasNodeType;
}

// Add new memoized components
const MemoizedBackground = memo(Background);
const MemoizedMiniMap = memo(MiniMap);

const Flow = memo(({ canvasId }: { canvasId: string }) => {
  const { t } = useTranslation();
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const { addNode } = useAddNode(canvasId);
  const { nodes, edges } = useCanvasStoreShallow((state) => ({
    nodes: state.data[canvasId]?.nodes ?? [],
    edges: state.data[canvasId]?.edges ?? [],
  }));
  const { onNodesChange } = useNodeOperations(canvasId);
  const { setSelectedNode } = useNodeSelection();
  const { onEdgesChange, onConnect } = useEdgeOperations(canvasId);
  const edgeStyles = useEdgeStyles();

  const {
    pinnedNodes,
    showPreview,
    showLaunchpad,
    showMaxRatio,
    interactionMode,
    setInteractionMode,
    clickToPreview,
    showEdges,
  } = useCanvasStoreShallow((state) => ({
    pinnedNodes: state.config[canvasId]?.pinnedNodes,
    showPreview: state.showPreview,
    showLaunchpad: state.showLaunchpad,
    showMaxRatio: state.showMaxRatio,
    interactionMode: state.interactionMode,
    setInteractionMode: state.setInteractionMode,
    clickToPreview: state.clickToPreview,
    showEdges: state.showEdges,
  }));

  const { showCanvasListModal, showLibraryModal, setShowCanvasListModal, setShowLibraryModal } = useSiderStoreShallow(
    (state) => ({
      showCanvasListModal: state.showCanvasListModal,
      showLibraryModal: state.showLibraryModal,
      setShowCanvasListModal: state.setShowCanvasListModal,
      setShowLibraryModal: state.setShowLibraryModal,
    }),
  );

  const reactFlowInstance = useReactFlow();

  const { pendingNode, clearPendingNode } = useCanvasNodesStore();
  const { provider } = useCanvasContext();

  const { config, operatingNodeId, setOperatingNodeId, setInitialFitViewCompleted } = useCanvasStoreShallow(
    (state) => ({
      config: state.config[canvasId],
      operatingNodeId: state.operatingNodeId,
      setOperatingNodeId: state.setOperatingNodeId,
      setInitialFitViewCompleted: state.setInitialFitViewCompleted,
    }),
  );
  const hasCanvasSynced = config?.localSyncedAt > 0 && config?.remoteSyncedAt > 0;

  const { createSingleDocumentInCanvas, isCreating: isCreatingDocument } = useCreateDocument();

  const { handleNodePreview } = useNodePreviewControl({ canvasId });

  const toggleInteractionMode = (mode: 'mouse' | 'touchpad') => {
    setInteractionMode(mode);
  };

  useEffect(() => {
    return () => {
      setInitialFitViewCompleted(canvasId, false);
    };
  }, [canvasId]);

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
  }, [canvasId, nodes?.length]);

  const defaultEdgeOptions = {
    style: edgeStyles.default,
  };

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
    [edgeStyles],
  );

  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);

  const onPaneClick = useCallback(
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
    [lastClickTime, setOperatingNodeId],
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
      const shouldShowRight = container.scrollLeft < container.scrollWidth - container.clientWidth - 1;

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
  }, [pendingNode]);

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
    const unsubscribe = addPinnedNodeEmitter.on('addPinnedNode', ({ canvasId: emittedCanvasId }) => {
      if (emittedCanvasId === canvasId) {
        previewContainerRef.current?.scrollTo({
          left: 0,
          behavior: 'smooth',
        });
      }
    });

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
      setContextMenu((prev) => ({ ...prev, open: false }));

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
      if (node.type === 'memo' || node.type === 'skill') {
        return;
      }

      // Handle preview if enabled
      handleNodePreview(node);
    },
    [operatingNodeId, handleNodePreview, setOperatingNodeId, setSelectedNode],
  );

  // 缓存节点数据
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
  const { setIsNodeDragging } = useEditorPerformance();

  const onNodeDragStart = useCallback(() => {
    setIsNodeDragging(true);
  }, [setIsNodeDragging]);

  const onNodeDragStop = useCallback(() => {
    setIsNodeDragging(false);
  }, [setIsNodeDragging]);

  return (
    <Spin
      className="w-full h-full"
      style={{ maxHeight: '100%' }}
      spinning={!hasCanvasSynced && provider.status !== 'connected' && !connectionTimeout}
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
            onPaneClick={onPaneClick}
            onPaneContextMenu={onPaneContextMenu}
            onNodeContextMenu={onNodeContextMenu}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            nodeDragThreshold={10}
            nodesDraggable={!operatingNodeId}
            onlyRenderVisibleElements={true}
            elevateNodesOnSelect={false}
          >
            {nodes?.length === 0 && hasCanvasSynced && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
                <div className="flex items-center justify-center text-gray-500 text-center">
                  <div className="text-[20px]">{t('canvas.emptyText')}</div>
                  <Button
                    loading={isCreatingDocument}
                    icon={<HiOutlineDocumentAdd className="-mr-1 flex items-center justify-center" />}
                    type="text"
                    className="ml-0.5 text-[20px] text-[#00968F] py-[4px] px-[8px]"
                    onClick={() => createSingleDocumentInCanvas()}
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
            className={`absolute top-[64px] bottom-0 right-2 overflow-x-auto preview-container`}
            style={{
              maxWidth: showMaxRatio ? '900px' : '440px',
            }}
            onScroll={(e) => updateIndicators(e.currentTarget)}
          >
            <div className="relative h-full">
              <div className="flex gap-2 h-full">
                {pinnedNodes
                  ?.filter(Boolean)
                  ?.map((node) => <NodePreview key={node?.id} node={node} canvasId={canvasId} />)}
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
          />
        )}

        {contextMenu.open && contextMenu.type === 'node' && contextMenu.nodeId && contextMenu.nodeType && (
          <NodeContextMenu
            open={contextMenu.open}
            position={contextMenu.position}
            nodeId={contextMenu.nodeId}
            nodeType={contextMenu.nodeType}
            setOpen={(open) => setContextMenu((prev) => ({ ...prev, open }))}
          />
        )}
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
  }, [canvasId]);

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

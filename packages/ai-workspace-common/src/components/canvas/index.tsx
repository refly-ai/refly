import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
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
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/use-create-document';

import '@xyflow/react/dist/style.css';
import { useCanvasControl } from '@refly-packages/ai-workspace-common/hooks/use-canvas-control';
import { CanvasProvider, useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useEdgeStyles } from './constants';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { BigSearchModal } from '@refly-packages/ai-workspace-common/components/search/modal';
import { CanvasListModal } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal';
import { LibraryModal } from '@refly-packages/ai-workspace-common/components/workspace/library-modal';
import { useCanvasNodesStore } from '@refly-packages/ai-workspace-common/stores/canvas-nodes';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { LayoutControl } from './layout-control';
import { addPinnedNodeEmitter } from '@refly-packages/ai-workspace-common/events/addPinnedNode';
import { MenuPopper } from './menu-popper';

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
  nodeType?: 'document' | 'resource' | 'skillResponse';
}

const Flow = ({ canvasId }: { canvasId: string }) => {
  const { t } = useTranslation();
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const { nodes, edges, mode, setSelectedNode, onNodesChange, onEdgesChange, onConnect, addNode } =
    useCanvasControl(canvasId);
  const edgeStyles = useEdgeStyles();

  const { pinnedNodes, showPreview, showLaunchpad, showMaxRatio, interactionMode, setInteractionMode } =
    useCanvasStoreShallow((state) => ({
      pinnedNodes: state.config[canvasId]?.pinnedNodes,
      showPreview: state.showPreview,
      showLaunchpad: state.showLaunchpad,
      showMaxRatio: state.showMaxRatio,
      interactionMode: state.interactionMode,
      setInteractionMode: state.setInteractionMode,
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
  const { getNode } = reactFlowInstance;

  const { pendingNode, clearPendingNode } = useCanvasNodesStore();
  const { provider } = useCanvasContext();

  const { operatingNodeId, setOperatingNodeId } = useCanvasStoreShallow((state) => ({
    operatingNodeId: state.operatingNodeId,
    setOperatingNodeId: state.setOperatingNodeId,
  }));

  const { createSingleDocumentInCanvas, isCreating: isCreatingDocument } = useCreateDocument();

  const toggleInteractionMode = (mode: 'mouse' | 'touchpad') => {
    setInteractionMode(mode);
  };

  useEffect(() => {
    // Only run fitView if we have nodes and this is the initial render
    const timeoutId = setTimeout(() => {
      if (nodes?.length > 0) {
        reactFlowInstance.fitView({
          padding: 0.2,
          duration: 200,
          minZoom: 0.1,
          maxZoom: 1,
        });
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [canvasId]); // Run only once on mount

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
    [mode, edgeStyles],
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

  const selectedNodes = nodes?.filter((node) => node.selected);

  const handleToolSelect = (tool: string) => {
    // Handle tool selection
    console.log('Selected tool:', tool);
  };

  // Add scroll position state and handler
  const [showLeftIndicator, setShowLeftIndicator] = useState(false);
  const [showRightIndicator, setShowRightIndicator] = useState(false);

  const updateIndicators = useCallback((container: HTMLDivElement) => {
    setShowLeftIndicator(container.scrollLeft > 0);
    setShowRightIndicator(container.scrollLeft < container.scrollWidth - container.clientWidth - 1);
  }, []);

  useEffect(() => {
    const container = document.querySelector('.preview-container');
    if (container) {
      updateIndicators(container as HTMLDivElement);
    }
  }, [selectedNodes, pinnedNodes, updateIndicators]);

  // Handle pending node
  useEffect(() => {
    if (pendingNode) {
      addNode(pendingNode);
      clearPendingNode();
    }
  }, [pendingNode]);

  const [connectionTimeout, setConnectionTimeout] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (provider?.status !== 'connected') {
        setConnectionTimeout(true);
      }
    }, 10000); // 10 seconds timeout

    // Clear timeout if provider becomes connected
    if (provider?.status === 'connected') {
      clearTimeout(timeoutId);
    }

    return () => clearTimeout(timeoutId);
  }, [provider?.status]); // Update dependency to specifically watch status

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
      let menuNodeType: 'document' | 'resource' | 'skillResponse';
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

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: CanvasNode<any>) => {
      setContextMenu((prev) => ({ ...prev, open: false }));

      if (!node?.id) {
        console.warn('Invalid node clicked');
        return;
      }

      // If clicking the currently selected node, toggle operating mode
      if (node.selected && node.id === operatingNodeId) {
        // Already in operating mode, do nothing
        return;
      } else if (node.selected && !operatingNodeId) {
        // Enter operating mode
        setOperatingNodeId(node.id);
        event.stopPropagation();
      } else {
        // Just select the node
        setOperatingNodeId(null);
        setSelectedNode(node);
      }
    },
    [setSelectedNode, operatingNodeId, setOperatingNodeId],
  );

  return (
    <Spin
      className="w-full h-full"
      spinning={provider.status !== 'connected' && !connectionTimeout}
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
            nodeTypes={nodeTypes}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onPaneContextMenu={onPaneContextMenu}
            onNodeContextMenu={onNodeContextMenu}
            nodeDragThreshold={10}
            nodesDraggable={!operatingNodeId}
          >
            {nodes?.length === 0 && (
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

            <Background />
            <MiniMap
              position="bottom-left"
              style={{
                border: '1px solid rgba(16, 24, 40, 0.0784)',
                boxShadow: '0px 4px 6px 0px rgba(16, 24, 40, 0.03)',
              }}
              className="bg-white/80 w-[140px] h-[92px] !mb-[46px] !ml-[10px] rounded-lg shadow-md p-2 [&>svg]:w-full [&>svg]:h-full"
            />
          </ReactFlow>

          <LayoutControl mode={interactionMode} changeMode={toggleInteractionMode} />

          <div className="absolute bottom-[8px] left-1/2 -translate-x-1/2 w-[444px] z-50">
            <LaunchPad visible={showLaunchpad} />
          </div>
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
                {/* Left shadow and arrow indicator */}
                {/* {showLeftIndicator && (
                <div className="sticky left-0 top-0 w-12 h-full bg-gradient-to-r from-white to-transparent z-10 flex items-center justify-start pointer-events-none absolute">
                  <div className="text-gray-400 ml-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M15 19l-7-7 7-7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              )} */}

                {pinnedNodes
                  ?.filter(Boolean)
                  ?.map((node) => <NodePreview key={node?.id} node={node} canvasId={canvasId} />)}

                {/* Right shadow and arrow indicator */}
                {/* {showRightIndicator && (
                <div className="sticky right-0 top-0 w-12 h-full bg-gradient-to-l from-white to-transparent z-10 flex items-center justify-end pointer-events-none absolute">
                  <div className="text-gray-400 mr-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 5l7 7-7 7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              )} */}
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
};
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
    <CanvasProvider canvasId={canvasId}>
      <ReactFlowProvider>
        <Flow canvasId={canvasId} />
      </ReactFlowProvider>
    </CanvasProvider>
  );
};

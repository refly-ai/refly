import { memo, useEffect, useState, useCallback, useMemo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { StartNodeHeader } from './shared/start-node-header';
import cn from 'classnames';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { getNodeCommonStyles } from './shared/styles';
import { CustomHandle } from './shared/custom-handle';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { useTranslation } from 'react-i18next';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { CreateVariablesModal } from '../workflow-variables';
import {
  nodeActionEmitter,
  createNodeEventName,
  cleanupNodeEvents,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genNodeEntityId } from '@refly/utils/id';
import { useGetNodeConnectFromDragCreateInfo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-connect';
import { NodeDragCreateInfo } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { CanvasNode } from '@refly/openapi-schema';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { useCanvasStoreShallow } from '@refly/stores';
import { InputParameterRow } from './shared/input-parameter-row';

const NODE_SIDE_CONFIG = { width: 250, height: 'auto' };

// Define StartNodeProps type
type StartNodeProps = NodeProps & {
  onNodeClick?: () => void;
  data: CanvasNode;
};

export const StartNode = memo(({ id, onNodeClick, data }: StartNodeProps) => {
  const { canvasId, shareData } = useCanvasContext();
  const { nodePreviewId } = useCanvasStoreShallow((state) => ({
    nodePreviewId: state.config[canvasId]?.nodePreviewId,
  }));

  const selected = useMemo(() => {
    return nodePreviewId === id;
  }, [nodePreviewId, id]);

  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const { edges } = useCanvasData();
  const { setNodeStyle } = useNodeData();
  const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);

  const [showCreateVariablesModal, setShowCreateVariablesModal] = useState(false);
  const { data: variables } = useVariablesManagement(canvasId);
  const { addNode } = useAddNode();
  const { getConnectionInfo } = useGetNodeConnectFromDragCreateInfo();

  const workflowVariables = shareData?.variables ?? variables;

  // Check if node has any connections
  const isSourceConnected = edges?.some((edge) => edge.source === id);

  const handleMouseEnter = useCallback(() => {
    if (!isHovered) {
      setIsHovered(true);
      onHoverStart(selected);
    }
  }, [isHovered, onHoverStart, selected]);

  const handleMouseLeave = useCallback(() => {
    if (isHovered) {
      setIsHovered(false);
      onHoverEnd(selected);
    }
  }, [isHovered, onHoverEnd, selected]);

  const handleAskAI = useCallback(
    (event?: {
      dragCreateInfo?: NodeDragCreateInfo;
    }) => {
      // For start node, we can create a skill node with workflow variables as context
      const { position, connectTo } = getConnectionInfo(
        { entityId: data?.entityId as string, type: 'start' },
        event?.dragCreateInfo,
      );

      addNode(
        {
          type: 'skillResponse',
          data: {
            title: '',
            entityId: genNodeEntityId('skillResponse'),
            metadata: {
              status: 'init',
            },
          },
          position,
        },
        connectTo,
        true,
        true,
      );
    },
    [id, addNode, getConnectionInfo],
  );

  // Effect to handle width changes and maintain right edge position
  useEffect(() => {
    setNodeStyle(id, NODE_SIDE_CONFIG);
  }, [id, setNodeStyle]);

  // Add event handling for askAI
  useEffect(() => {
    // Create node-specific event handler
    const handleNodeAskAI = (event?: { dragCreateInfo?: NodeDragCreateInfo }) => {
      handleAskAI(event);
    };

    // Register event with node ID
    nodeActionEmitter.on(createNodeEventName(id, 'askAI'), handleNodeAskAI);

    return () => {
      // Cleanup event when component unmounts
      nodeActionEmitter.off(createNodeEventName(id, 'askAI'), handleNodeAskAI);

      // Clean up all node events
      cleanupNodeEvents(id);
    };
  }, [id, handleAskAI]);

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} onClick={onNodeClick}>
      <CustomHandle
        id={`${id}-source`}
        nodeId={id}
        type="source"
        position={Position.Right}
        isConnected={isSourceConnected}
        isNodeHovered={isHovered}
        nodeType="start"
      />

      <div
        style={NODE_SIDE_CONFIG}
        className={cn(
          'h-full flex flex-col relative box-border z-1 p-0',
          getNodeCommonStyles({ selected, isHovered }),
          'rounded-2xl border-solid border border-gray-200 bg-refly-bg-content-z2',
        )}
      >
        {/* Header section */}
        <StartNodeHeader source="node" />

        {/* Input parameters section */}
        {workflowVariables.length > 0 ? (
          <div className="flex flex-col p-3">
            <div className="space-y-2">
              {workflowVariables.slice(0, 6).map((variable) => (
                <InputParameterRow
                  key={variable.name}
                  variable={variable}
                  readonly={true}
                  isHighlighted={false}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col p-3 text-xs text-refly-text-2">
            {t('canvas.nodeActions.selectToEdit')}
          </div>
        )}
      </div>

      <CreateVariablesModal
        visible={showCreateVariablesModal}
        onCancel={setShowCreateVariablesModal}
        mode="create"
        onViewCreatedVariable={() => {
          // For start node variables, we can reopen the modal in edit mode
          setShowCreateVariablesModal(false);
          setTimeout(() => {
            setShowCreateVariablesModal(true);
          }, 100);
        }}
      />
    </div>
  );
});

StartNode.displayName = 'StartNode';

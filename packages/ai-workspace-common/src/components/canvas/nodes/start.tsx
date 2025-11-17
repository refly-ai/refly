import { memo, useEffect, useState, useCallback, useMemo } from 'react';
import { NodeProps, Position, useReactFlow } from '@xyflow/react';
import { StartNodeHeader } from './shared/start-node-header';
import { BiText } from 'react-icons/bi';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { getNodeCommonStyles } from './shared/styles';
import { CustomHandle } from './shared/custom-handle';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { useSelectedNodeZIndex } from '@refly-packages/ai-workspace-common/hooks/canvas/use-selected-node-zIndex';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { useTranslation } from 'react-i18next';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { CreateVariablesModal } from '../workflow-variables';
import { Attachment, List } from 'refly-icons';
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
import cn from 'classnames';

const NODE_SIDE_CONFIG = { width: 320, height: 'auto' };

export const VARIABLE_TYPE_ICON_MAP = {
  string: BiText,
  option: List,
  resource: Attachment,
};

// Input parameter row component
export const InputParameterRow = memo(
  ({
    variableType,
    label,
    isRequired = false,
    isSingle = false,
  }: {
    variableType: 'string' | 'option' | 'resource';
    label: string;
    isRequired?: boolean;
    isSingle?: boolean;
  }) => {
    const { t } = useTranslation();
    const Icon = useMemo(() => {
      // Fallback to BiText if the mapped icon is missing
      return VARIABLE_TYPE_ICON_MAP[variableType] ?? BiText;
    }, [variableType]);

    return (
      <div className="flex gap-2 items-center justify-between py-1.5 px-3 bg-refly-bg-control-z0 rounded-lg">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <div className="text-xs font-medium text-refly-text-1 truncate max-w-full">{label}</div>
          {isRequired && (
            <div className="h-4 px-1 flex items-center justify-center text-refly-text-2 text-[10px] leading-[14px] border-[1px] border-solid border-refly-Card-Border rounded-[4px] flex-shrink-0">
              {t('canvas.workflow.variables.required')}
            </div>
          )}
          {['option', 'resource'].includes(variableType) && (
            <div className="h-4 px-1 flex items-center justify-center text-refly-text-2 text-[10px] leading-[14px] border-[1px] border-solid border-refly-Card-Border rounded-[4px] flex-shrink-0">
              {t(`canvas.workflow.variables.${isSingle ? 'singleSelect' : 'multipleSelect'}`)}
            </div>
          )}
        </div>

        <Icon size={14} color="var(--refly-text-3)" className="flex-shrink-0" />
      </div>
    );
  },
);

InputParameterRow.displayName = 'InputParameterRow';

// Define StartNodeProps type
type StartNodeProps = NodeProps & {
  onNodeClick?: () => void;
  data: CanvasNode;
};

export const StartNode = memo(({ id, selected, onNodeClick, data }: StartNodeProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [previousWidth, setPreviousWidth] = useState<string | number>('fit-content');
  const { edges } = useCanvasData();
  const { setNodeStyle, setNodePosition } = useNodeData();
  const { getNode } = useReactFlow();
  useSelectedNodeZIndex(id, selected);
  const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);
  const { workflow } = useCanvasContext();
  const [showCreateVariablesModal, setShowCreateVariablesModal] = useState(false);
  const { workflowVariables } = workflow;
  const { addNode } = useAddNode();
  const { getConnectionInfo } = useGetNodeConnectFromDragCreateInfo();

  // Check if node has any connections
  const isSourceConnected = edges?.some((edge) => edge.source === id);

  const handleMouseEnter = useCallback(() => {
    if (!isHovered) {
      setIsHovered(true);
      onHoverStart();
    }
  }, [isHovered, onHoverStart]);

  const handleMouseLeave = useCallback(() => {
    if (isHovered) {
      setIsHovered(false);
      onHoverEnd();
    }
  }, [isHovered, onHoverEnd]);

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
              contextItems: workflowVariables.map((variable) => ({
                name: variable.name,
                value: variable.value,
              })),
            },
          },
          position,
        },
        connectTo,
        false,
        true,
      );
    },
    [id, workflowVariables, addNode, getConnectionInfo],
  );

  // Function to calculate width difference and adjust position
  const adjustPositionForWidthChange = useCallback(
    (
      oldWidth: string | number,
      newWidth: string | number,
      currentPosition: { x: number; y: number },
    ) => {
      // Only adjust if we have a valid current position
      if (!currentPosition) return currentPosition;

      // Calculate width difference
      let widthDifference = 0;

      if (oldWidth === 'fit-content' && newWidth === 320) {
        // From fit-content to 320px - move left by the difference
        // Estimate fit-content width based on the header content (icon + text + padding)
        // Icon (~24px) + text (~60px) + padding (32px) = ~116px
        const estimatedFitContentWidth = 116;
        widthDifference = 320 - estimatedFitContentWidth;
      } else if (oldWidth === 320 && newWidth === 'fit-content') {
        // From 320px to fit-content - move right by the difference
        const estimatedFitContentWidth = 116;
        widthDifference = estimatedFitContentWidth - 320;
      }

      // Adjust x position to keep right edge in the same place
      return {
        x: currentPosition.x - widthDifference,
        y: currentPosition.y,
      };
    },
    [],
  );

  // Effect to handle width changes and maintain right edge position
  useEffect(() => {
    const newWidth = workflowVariables.length > 0 ? 320 : 'fit-content';
    const oldWidth = previousWidth;

    // Update the node style
    if (workflowVariables.length > 0) {
      setNodeStyle(id, NODE_SIDE_CONFIG);
    } else {
      setNodeStyle(id, { width: 'fit-content', height: 'auto' });
    }

    // Adjust position if width has changed to keep right edge in the same place
    if (oldWidth !== newWidth) {
      const currentNode = getNode(id);
      if (currentNode?.position) {
        const adjustedPosition = adjustPositionForWidthChange(
          oldWidth,
          newWidth,
          currentNode.position,
        );

        // Only update position if it has actually changed
        if (adjustedPosition.x !== currentNode.position.x) {
          setNodePosition(id, adjustedPosition);
        }
      }

      // Update the previous width for next comparison
      setPreviousWidth(newWidth);
    }
  }, [
    id,
    setNodeStyle,
    setNodePosition,
    workflowVariables.length,
    previousWidth,
    adjustPositionForWidthChange,
    getNode,
  ]);

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
        className={selected || isSourceConnected ? 'visible' : 'invisible'}
      />

      <div
        style={
          workflowVariables.length > 0 ? NODE_SIDE_CONFIG : { width: 'fit-content', height: 'auto' }
        }
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
                  label={variable.name}
                  isRequired={variable.required}
                  variableType={variable.variableType}
                  isSingle={variable.isSingle}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col p-3">
            <div>Select to edit in editor</div>
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

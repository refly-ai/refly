import { memo, useEffect, useState, useCallback, useMemo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { NodeIcon } from './shared/node-icon';
import { Button, Divider } from 'antd';
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
import SVGX from '../../../assets/x.svg';
import {
  nodeActionEmitter,
  createNodeEventName,
  cleanupNodeEvents,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genSkillID } from '@refly/utils/id';
import { useGetNodeConnectFromDragCreateInfo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-connect';
import { NodeDragCreateInfo } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { CanvasNode } from '@refly/openapi-schema';

const NODE_SIDE_CONFIG = { width: 320, height: 'auto' };
export const VARIABLE_TYPE_ICON_MAP = {
  string: BiText,
  option: List,
  resource: Attachment,
};

// Input parameter row component
const InputParameterRow = memo(
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
          <img src={SVGX} alt="x" className="w-[10px] h-[10px] flex-shrink-0" />
          <Divider type="vertical" className="bg-refly-Card-Border mx-2 my-0 flex-shrink-0" />
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
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const { edges } = useCanvasData();
  const { setNodeStyle } = useNodeData();
  useSelectedNodeZIndex(id, selected);
  const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);
  const { workflow, readonly } = useCanvasContext();
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
          type: 'skill',
          data: {
            title: 'Skill',
            entityId: genSkillID(),
            metadata: {
              contextItems: [],
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
        className={`h-full flex flex-col relative p-4 box-border z-1
          ${getNodeCommonStyles({ selected, isHovered })}
        `}
      >
        {/* Header section */}
        <div className="flex items-center gap-2 mb-4">
          <NodeIcon type="start" filled={true} />
          <span className="text-sm font-semibold leading-6 text-refly-text-0">
            {t('canvas.nodeTypes.start')}
          </span>
        </div>

        {/* Input parameters section */}
        {workflowVariables.length > 0 ? (
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
        ) : (
          <div className="px-3 py-6 gap-0.5 flex items-center justify-center bg-refly-bg-control-z0 rounded-lg">
            <div className="text-xs text-refly-text-1 leading-4">
              {t('canvas.workflow.variables.empty') || 'No variables defined'}
            </div>
            {!readonly && (
              <Button
                type="text"
                size="small"
                className="text-xs leading-4 font-semibold !text-refly-primary-default p-0.5 !h-5 box-border hover:bg-refly-tertiary-hover"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowCreateVariablesModal(true);
                }}
              >
                {t('canvas.workflow.variables.addVariable') || 'Add'}
              </Button>
            )}
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

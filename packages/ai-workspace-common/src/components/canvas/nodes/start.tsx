import { memo, useEffect, useState, useCallback, useMemo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { StartNodeHeader } from './shared/start-node-header';
import cn from 'classnames';
import { BiText } from 'react-icons/bi';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { getNodeCommonStyles } from './shared/styles';
import { CustomHandle } from './shared/custom-handle';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
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
import { CanvasNode, VariableValue } from '@refly/openapi-schema';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { useCanvasStoreShallow } from '@refly/stores';
import { RESOURCE_TYPE_ICON_MAP } from '../node-preview/start';

const NODE_SIDE_CONFIG = { width: 250, height: 'auto' };

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
    options,
    value,
    isRequired = false,
  }: {
    variableType: 'string' | 'option' | 'resource';
    label: string;
    options?: string[];
    value?: VariableValue[];
    isRequired?: boolean;
  }) => {
    const displayValue = useMemo(() => {
      if (variableType === 'option') {
        return options?.join(', ') ?? '';
      }
      if (variableType === 'resource') {
        return value?.[0]?.resource?.name ?? '';
      }
      return value?.[0]?.text ?? '';
    }, [variableType, options, value]);

    const VariableIcon = useMemo(() => {
      if (variableType === 'option') {
        return <List size={14} color="var(--refly-text-3)" className="flex-shrink-0" />;
      }
      if (variableType === 'resource') {
        const resourceType = value?.[0]?.resource?.fileType;
        const Icon =
          RESOURCE_TYPE_ICON_MAP[resourceType as keyof typeof RESOURCE_TYPE_ICON_MAP] ?? Attachment;
        return <Icon size={14} color="var(--refly-text-3)" className="flex-shrink-0" />;
      }
      return <BiText size={14} color="var(--refly-text-3)" className="flex-shrink-0" />;
    }, [variableType, value]);

    return (
      <div className="flex gap-2 items-center justify-between py-1.5 px-3 bg-refly-bg-control-z0 rounded-lg">
        <div className="flex items-center flex-1 min-w-0">
          {isRequired && <div className="text-refly-text-3 flex-shrink-0 mr-0.5">*</div>}
          <div className="flex items-center flex-1 min-w-0 overflow-hidden">
            <div className="text-xs text-refly-func-warning-hover truncate min-w-0 flex-1 shrink basis-[80px] max-w-fit">
              {label}
            </div>
            {displayValue && (
              <div className="text-xs text-refly-text-3 truncate ml-1 min-w-0 flex-grow-0 shrink-[100] basis-auto">
                {displayValue}
              </div>
            )}
          </div>
        </div>

        {VariableIcon}
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

  console.log('workflowVariables', workflowVariables);

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
                  label={variable.name}
                  isRequired={variable.required}
                  variableType={variable.variableType}
                  options={variable.options ?? []}
                  value={variable.value ?? []}
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

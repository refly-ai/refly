import { ArrowDown, Cancelled } from 'refly-icons';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import {
  cleanupNodeEvents,
  createNodeEventName,
  nodeActionEmitter,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { useDuplicateNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-duplicate-node';
import { useSkillResponseActions } from '@refly-packages/ai-workspace-common/hooks/canvas/use-skill-response-actions';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { CanvasNode, purgeToolsets } from '@refly/canvas-common';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useActionResultStore, useActionResultStoreShallow } from '@refly/stores';
import { genNodeEntityId } from '@refly/utils/id';
import { Position, useReactFlow } from '@xyflow/react';
import { message, Typography } from 'antd';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomHandle } from './shared/custom-handle';
import { getNodeCommonStyles } from './shared/styles';
import { SkillResponseNodeProps } from './shared/types';

import { NodeDragCreateInfo } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import {
  useNodeData,
  useNodeExecutionFocus,
} from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
import { useGetNodeConnectFromDragCreateInfo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-connect';
import { usePilotRecovery } from '@refly-packages/ai-workspace-common/hooks/pilot/use-pilot-recovery';
import {
  useGetCreditBalance,
  useGetCreditUsageByResultId,
  useGetPilotSessionDetail,
} from '@refly-packages/ai-workspace-common/queries/queries';
import { processContentPreview } from '@refly-packages/ai-workspace-common/utils/content';
import {
  usePilotStoreShallow,
  useCanvasNodesStoreShallow,
  useCanvasStoreShallow,
} from '@refly/stores';
import cn from 'classnames';

import { SkillResponseContentPreview } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/skill-response-content-preview';
import { SkillResponseNodeHeader } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/skill-response-node-header';
import { logEvent } from '@refly/telemetry-web';
import { SkillResponseActions } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/skill-response-actions';
import { Subscription } from 'refly-icons';
import { IoCheckmarkCircle } from 'react-icons/io5';
import './shared/executing-glow-effect.scss';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { useConnection } from '@xyflow/react';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { useQueryProcessor } from '@refly-packages/ai-workspace-common/hooks/use-query-processor';
import { useSkillError } from '@refly-packages/ai-workspace-common/hooks/use-skill-error';
import { classifyExecutionError } from '@refly-packages/ai-workspace-common/utils/error-classification';
import { useUserMembership } from '@refly-packages/ai-workspace-common/hooks/use-user-membership';

const { Paragraph } = Typography;

const NODE_WIDTH = 320;
const NODE_SIDE_CONFIG = { width: NODE_WIDTH, height: 'auto', maxHeight: 300 };

const NodeStatusBar = memo(
  ({
    resultId,
    status,
    errorType,
    executionTime,
    error,
    version,
  }: {
    resultId: string;
    status: string;
    errorType?: string;
    executionTime?: number;
    error?: string;
    version?: number;
  }) => {
    // Query credit usage when skill is completed
    const { data: creditUsage } = useGetCreditUsageByResultId(
      {
        query: {
          resultId: resultId ?? '',
          version: version?.toString(),
        },
      },
      undefined,
      {
        enabled: (status === 'finish' || status === 'failed') && !!resultId,
      },
    );
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const effectiveErrorType = errorType || 'systemError';
    const isUserAbort = effectiveErrorType === 'userAbort';

    const { data: balanceData, isSuccess: isBalanceSuccess } = useGetCreditBalance();
    const creditBalance = balanceData?.data?.creditBalance ?? 0;
    const { displayName } = useUserMembership();

    const { errCode } = useSkillError(error ?? '');
    const isCreditInsufficient = errCode === 'E2002' && creditBalance <= 0 && isBalanceSuccess;

    const failureType = isUserAbort
      ? 'userAbort'
      : isCreditInsufficient
        ? 'creditInsufficient'
        : classifyExecutionError(error, errCode);

    const errorMessage = useMemo(() => {
      if (failureType === 'creditInsufficient') {
        return t('canvas.skillResponse.creditInsufficient.description', {
          membershipLevel: displayName,
        });
      }

      const typeMap = {
        userAbort: 'userAbort',
        modelCall: 'modelCallFailure',
        toolCall: 'toolCallFailure',
        multimodal: 'multimodalFailure',
      };
      return t(
        `canvas.skillResponse.${typeMap[failureType as keyof typeof typeMap] ?? 'multimodalFailure'}.description`,
        {
          defaultValue: error,
        },
      );
    }, [failureType, error, t, displayName]);

    const getStatusIcon = () => {
      switch (status) {
        case 'finish':
          return <IoCheckmarkCircle className="w-3 h-3 text-green-500" />;
        case 'failed':
          return <Cancelled color="red" className="w-3 h-3" />;
        case 'executing':
        case 'waiting':
          return <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />;
        default:
          return null;
      }
    };

    const statusText = useMemo<string>(() => {
      return t(`canvas.skillResponse.status.${status}`);
    }, [status, t]);

    if (status === 'waiting' || status === 'executing') {
      return null;
    }

    const hasErrors = status === 'failed' && error;

    return (
      <div className="flex flex-col mt-2 w-full">
        <div
          className={`px-2 py-1 border-[0.5px] border-solid border-refly-Card-Border rounded-2xl bg-refly-bg-body-z0 ${hasErrors ? 'cursor-pointer' : ''}`}
          onClick={() => hasErrors && setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              {getStatusIcon()}
              <span className="text-xs text-refly-text-1 leading-4">{statusText}</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500 flex-shrink-0">
              {creditUsage?.data?.total !== undefined && (
                <div className="flex items-center gap-1">
                  <Subscription className="w-3 h-3" />
                  <span>{creditUsage?.data?.total}</span>
                </div>
              )}

              {executionTime !== undefined && (
                <div className="flex items-center gap-1">
                  <span>{executionTime}s</span>
                </div>
              )}

              {hasErrors && (
                <ArrowDown
                  size={12}
                  className={cn('transition-transform', isExpanded ? 'rotate-180' : '')}
                />
              )}
            </div>
          </div>
          {hasErrors && isExpanded && (
            <div className="min-w-0 mt-[10px] mb-1">
              <Paragraph
                className="!m-0 !p-0 text-refly-func-danger-default text-xs leading-4"
                ellipsis={{
                  rows: 8,
                  tooltip: <div className="max-h-[300px] overflow-y-auto">{errorMessage}</div>,
                }}
              >
                {errorMessage}
              </Paragraph>
            </div>
          )}
        </div>
      </div>
    );
  },
);

NodeStatusBar.displayName = 'NodeStatusBar';

export const SkillResponseNode = memo(
  ({ data, id, isPreview = false, hideHandles = false, onNodeClick }: SkillResponseNodeProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const { readonly, canvasId } = useCanvasContext();

    const { nodePreviewId } = useCanvasStoreShallow((state) => ({
      nodePreviewId: state.config[canvasId]?.nodePreviewId,
    }));
    const selected = useMemo(() => {
      return nodePreviewId === id;
    }, [nodePreviewId, id]);

    const { highlightedNodeId, highlightedNodeIds } = useCanvasNodesStoreShallow((state) => ({
      highlightedNodeId: state.highlightedNodeId,
      highlightedNodeIds: state.highlightedNodeIds,
    }));

    // Check if node should be highlighted (either single highlight or multiple highlights)
    // Single highlight (hover) and multiple highlights (validation) can coexist
    const shouldHighlight = highlightedNodeId === id || highlightedNodeIds?.has(id) === true;

    const connection = useConnection();
    const isConnectingTarget = useMemo(
      () =>
        connection?.inProgress &&
        connection?.fromNode?.id !== id &&
        (connection?.toNode?.id === id || isHovered),
      [connection, id, isHovered],
    );

    const { setNodeData, setNodeStyle } = useNodeData();
    const { getEdges, setEdges } = useReactFlow();

    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);

    // Handle node hover events
    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      onHoverStart(selected);
    }, [onHoverStart, selected]);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
      onHoverEnd(selected);
    }, [onHoverEnd, selected]);

    // Get current pilot session info
    const activeSessionId = usePilotStoreShallow(
      (state) => state.activeSessionIdByCanvas[canvasId || ''],
    );

    // Get pilot session data to check if this node corresponds to a pilot step
    const { data: sessionData } = useGetPilotSessionDetail(
      {
        query: { sessionId: activeSessionId },
      },
      undefined,
      {
        enabled: !!activeSessionId,
      },
    );

    const isExecuting =
      data.metadata?.status === 'executing' || data.metadata?.status === 'waiting';

    // Auto-focus on node when executing
    useNodeExecutionFocus({
      isExecuting,
      canvasId: canvasId || '',
    });

    const nodeStyle = useMemo(
      () => (isPreview ? { width: NODE_WIDTH, height: 214 } : NODE_SIDE_CONFIG),
      [isPreview],
    );

    const { t } = useTranslation();

    const { title, metadata, entityId } = data ?? {};

    // Find current node's corresponding pilot step
    const currentPilotStep = useMemo(() => {
      if (!sessionData?.data?.steps || !entityId) return null;

      return sessionData.data.steps.find((step) => step.entityId === entityId);
    }, [sessionData, entityId]);

    const { getConnectionInfo } = useGetNodeConnectFromDragCreateInfo();
    const { data: variables } = useVariablesManagement(canvasId);
    const { processQuery } = useQueryProcessor();

    const { status, errorType, selectedSkill, actionMeta, version, shareId } = metadata ?? {};
    const currentSkill = actionMeta || selectedSkill;

    const { startPolling, resetFailedState } = useActionPolling();
    const { result, isStreaming, removeStreamResult, removeActionResult } =
      useActionResultStoreShallow((state) => ({
        result: state.resultMap[entityId],
        isStreaming: !!state.streamResults[entityId],
        removeStreamResult: state.removeStreamResult,
        removeActionResult: state.removeActionResult,
      }));
    // Get skill response actions
    const { workflowIsRunning, handleRerunSingle, handleRerunFromHere, handleStop } =
      useSkillResponseActions({
        nodeId: id,
        entityId: data.entityId,
        canvasId,
        query: data?.metadata?.query,
      });

    // Sync node status with action result status
    useEffect(() => {
      if (!result || !data) return;

      const nodePreview = data.contentPreview;
      const resultPreview = processContentPreview(result.steps?.map((s) => s?.content || ''));

      const needsStatusUpdate = result.status !== data.metadata?.status;
      const needsPreviewUpdate = nodePreview !== resultPreview;
      const needsVersionUpdate =
        result.version !== undefined && result.version !== data.metadata?.version;

      if (needsStatusUpdate || needsPreviewUpdate || needsVersionUpdate) {
        const updates: any = { ...data };

        // Update metadata if needed
        if (needsStatusUpdate || needsVersionUpdate) {
          updates.metadata = {
            ...data.metadata,
            ...(needsStatusUpdate && { status: result.status }),
            ...(needsVersionUpdate && { version: result.version }),
          };
        }

        // Update content preview if needed
        if (needsPreviewUpdate) {
          updates.contentPreview = resultPreview;
        }

        setNodeData(id, updates);
      }
    }, [result, data, id, setNodeData]);

    useEffect(() => {
      if (data?.editedTitle) {
        setNodeData(id, {
          title: data?.editedTitle,
          editedTitle: null,
        });
      }
    }, [id, data?.editedTitle]);

    // Use pilot recovery hook for pilot steps
    const { recoverSteps } = usePilotRecovery({
      canvasId: canvasId || '',
      sessionId: activeSessionId || '',
    });

    useEffect(() => {
      if (!isStreaming) {
        if (['executing', 'waiting'].includes(status) && !shareId) {
          // Reset failed state and start polling for new execution
          resetFailedState(entityId);
          removeActionResult(entityId);
          startPolling(entityId, version);
        }
      } else {
        // Only remove stream result if the status has been 'failed' or 'finish'
        // for a reasonable time to avoid race conditions during rerun
        if (['failed', 'finish'].includes(status)) {
          // Add a small delay to handle race conditions during rerun
          const timeoutId = setTimeout(() => {
            // Double check the status before removing
            const currentStream = useActionResultStore.getState().streamResults[entityId];
            if (currentStream && ['failed', 'finish'].includes(status)) {
              removeStreamResult(entityId);
            }
          }, 100);

          return () => clearTimeout(timeoutId);
        }
      }
    }, [
      isStreaming,
      status,
      startPolling,
      resetFailedState,
      entityId,
      shareId,
      version,
      removeStreamResult,
    ]);

    // Listen to pilot step status changes and sync with node status
    useEffect(() => {
      if (currentPilotStep?.status && currentPilotStep.status !== data?.metadata?.status) {
        console.log(
          `[Pilot Step Sync] Updating node ${id} status from ${data?.metadata?.status} to ${currentPilotStep.status}`,
        );

        setNodeData(id, {
          ...data,
          metadata: {
            ...data?.metadata,
            status: currentPilotStep.status,
          },
        });
      }
    }, [currentPilotStep?.status, data, id, setNodeData]);

    const skill = {
      name: currentSkill?.name || 'commonQnA',
      icon: currentSkill?.icon,
    };

    // Check if node has any connections
    const edges = getEdges();
    const isTargetConnected = edges?.some((edge) => edge.target === id);
    const isSourceConnected = edges?.some((edge) => edge.source === id);

    const { invokeAction } = useInvokeAction({ source: 'skill-response-node' });

    // Pilot recovery mode
    const handlePilotRecovery = useCallback(async () => {
      if (!currentPilotStep?.stepId || !activeSessionId) return;

      message.info(
        t('canvas.skillResponse.startPilotRecovery', {
          defaultValue: 'Starting pilot recovery...',
        }),
      );

      try {
        // 使用 usePilotRecovery hook
        await recoverSteps([currentPilotStep]);

        // 前端状态更新
        setNodeData(id, {
          ...data,
          contentPreview: '',
          metadata: {
            ...data?.metadata,
            status: 'waiting',
            version: (data?.metadata?.version || 0) + 1,
          },
        });

        message.success(
          t('canvas.skillResponse.pilotRecoveryStarted', {
            defaultValue: 'Pilot recovery started successfully',
          }),
        );
      } catch (error) {
        console.error('Pilot recovery failed:', error);
        message.error(
          t('canvas.skillResponse.pilotRecoveryFailed', {
            defaultValue: 'Pilot recovery failed',
          }),
        );
      }
    }, [currentPilotStep, activeSessionId, recoverSteps, data, id, setNodeData, t]);

    // Direct rerun mode (original logic)
    const handleDirectRerun = useCallback(() => {
      message.info(t('canvas.skillResponse.startRerun'));

      setNodeStyle(id, NODE_SIDE_CONFIG);

      // Reset failed state if the action previously failed
      if (data?.metadata?.status === 'failed') {
        resetFailedState(entityId);
      }

      const nextVersion = (data?.metadata?.version || 0) + 1;

      setNodeData(id, {
        contentPreview: '',
        metadata: {
          status: 'waiting',
          version: nextVersion,
        },
      });

      const query = data?.metadata?.query ?? '';
      const { llmInputQuery } = processQuery(query, {
        replaceVars: true,
        variables,
      });

      invokeAction(
        {
          nodeId: id,
          title: title ?? query,
          resultId: entityId,
          query: llmInputQuery,
          contextItems: data?.metadata?.contextItems,
          selectedToolsets: purgeToolsets(data?.metadata?.selectedToolsets),
          version: nextVersion,
          modelInfo: data?.metadata?.modelInfo,
          workflowVariables: variables,
        },
        {
          entityType: 'canvas',
          entityId: canvasId,
        },
      );
    }, [
      data?.metadata,
      entityId,
      canvasId,
      title,
      id,
      invokeAction,
      setNodeData,
      resetFailedState,
      setNodeStyle,
      skill,
      variables,
      t,
    ]);

    const handleRerun = useCallback(() => {
      if (readonly) {
        return;
      }

      if (['executing', 'waiting'].includes(data?.metadata?.status)) {
        message.info(t('canvas.skillResponse.executing'));
        return;
      }

      logEvent('run_agent_node', Date.now(), {
        canvasId,
        nodeId: id,
      });

      // 判断是否为 pilot step
      if (currentPilotStep?.stepId && activeSessionId) {
        // 使用 pilot recovery 模式
        handlePilotRecovery();
      } else {
        // 使用原有的直接重试模式
        handleDirectRerun();
      }
    }, [
      readonly,
      data?.metadata?.status,
      t,
      currentPilotStep,
      activeSessionId,
      handlePilotRecovery,
      handleDirectRerun,
      canvasId,
      id,
    ]);

    const { deleteNode } = useDeleteNode();
    const { duplicateNode } = useDuplicateNode();

    const handleDelete = useCallback(() => {
      logEvent('delete_agent_node', Date.now(), {
        canvasId,
        nodeId: id,
      });

      deleteNode({
        id,
        type: 'skillResponse',
        data,
        position: { x: 0, y: 0 },
      } as CanvasNode);
    }, [id, data, deleteNode, canvasId]);

    const handleDuplicate = useCallback(() => {
      duplicateNode(
        {
          id,
          type: 'skillResponse',
          data,
          position: { x: 0, y: 0 },
        } as CanvasNode,
        canvasId,
      );
    }, [id, data, canvasId, duplicateNode]);

    const { addNode } = useAddNode();

    const handleAskAI = useCallback(
      (event?: {
        dragCreateInfo?: NodeDragCreateInfo;
      }) => {
        const { metadata } = data;
        const { selectedSkill, actionMeta, modelInfo } = metadata;

        const currentSkill = actionMeta || selectedSkill;

        // Create new context items array that includes both the response and its context
        const mergedContextItems = [
          {
            type: 'skillResponse' as CanvasNodeType,
            title: data.title,
            entityId: data.entityId,
            metadata: {
              withHistory: true,
            },
          },
        ];

        // Create node connect filters - include both the response and its context items
        const connectFilters = [
          { type: 'skillResponse' as CanvasNodeType, entityId: data.entityId },
        ];

        const { position, connectTo } = getConnectionInfo(
          { entityId: data.entityId, type: 'skillResponse' },
          event?.dragCreateInfo,
        );

        logEvent('create_agent_node', Date.now(), {
          canvasId,
          source: 'other_agent_node',
        });

        // Add a small delay to avoid race conditions with context items
        setTimeout(() => {
          addNode(
            {
              type: 'skillResponse',
              data: {
                title: '',
                entityId: genNodeEntityId('skillResponse') as string,
                metadata: {
                  ...metadata,
                  query: '',
                  contextItems: mergedContextItems,
                  selectedSkill: currentSkill,
                  modelInfo,
                  status: 'init',
                },
              },
              position,
            },
            [...connectTo, ...connectFilters],
            true,
            true,
          );
        }, 10);
      },
      [data, addNode, getConnectionInfo, canvasId],
    );

    useEffect(() => {
      setNodeStyle(id, NODE_SIDE_CONFIG);
    }, [id, setNodeStyle]);

    // Update event handling
    useEffect(() => {
      // Create node-specific event handlers
      const handleNodeRerun = () => handleRerun();
      const handleNodeDelete = () => handleDelete();
      const handleNodeDuplicate = () => handleDuplicate();
      const handleNodeAskAI = (event?: {
        dragCreateInfo?: NodeDragCreateInfo;
      }) => handleAskAI(event);

      // Register events with node ID
      nodeActionEmitter.on(createNodeEventName(id, 'askAI'), handleNodeAskAI);
      nodeActionEmitter.on(createNodeEventName(id, 'rerun'), handleNodeRerun);
      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);
      nodeActionEmitter.on(createNodeEventName(id, 'duplicate'), handleNodeDuplicate);

      return () => {
        // Cleanup events when component unmounts
        nodeActionEmitter.off(createNodeEventName(id, 'askAI'), handleNodeAskAI);
        nodeActionEmitter.off(createNodeEventName(id, 'rerun'), handleNodeRerun);
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);
        nodeActionEmitter.off(createNodeEventName(id, 'duplicate'), handleNodeDuplicate);

        // Clean up all node events
        cleanupNodeEvents(id);
      };
    }, [id, handleRerun, handleDelete, handleDuplicate, handleAskAI]);

    useEffect(() => {
      setEdges((edges) =>
        edges.map((edge) => {
          if (edge.source === id || edge.target === id) {
            return { ...edge, data: { ...edge.data, executionStatus: status } };
          }
          return edge;
        }),
      );
    }, [id, status, setEdges]);

    return (
      <>
        <div
          className={cn(
            'rounded-2xl relative',
            // Apply executing/waiting glow effect on outer container
            status === 'executing' || status === 'waiting' ? 'executing-glow-effect' : '',
            isConnectingTarget ? 'connecting-target-glow-effect' : '',
          )}
          data-cy="skill-response-node"
          onClick={onNodeClick}
          onMouseEnter={!isPreview ? handleMouseEnter : undefined}
          onMouseLeave={!isPreview ? handleMouseLeave : undefined}
        >
          {!isPreview && !hideHandles && (
            <>
              <CustomHandle
                id={`${id}-target`}
                nodeId={id}
                type="target"
                position={Position.Left}
                isConnected={isTargetConnected}
                isNodeHovered={isHovered}
                nodeType="skillResponse"
              />
              <CustomHandle
                id={`${id}-source`}
                nodeId={id}
                type="source"
                position={Position.Right}
                isConnected={isSourceConnected}
                isNodeHovered={isHovered || selected}
                nodeType="skillResponse"
              />
            </>
          )}

          <div
            style={nodeStyle}
            className={cn(
              'h-full flex flex-col relative z-1 p-0 box-border',
              getNodeCommonStyles({ selected, isHovered, shouldHighlight }),
              'flex max-h-60 flex-col items-start self-stretch rounded-2xl border-solid bg-refly-bg-content-z2',
              // Apply error styles only when there's an error
              status === 'failed'
                ? '!border-refly-func-danger-default'
                : 'border-refly-Card-Border',
            )}
          >
            {shouldHighlight && (
              <div className="absolute inset-0 bg-refly-node-run opacity-[0.14]" />
            )}
            <SkillResponseNodeHeader
              nodeId={id}
              entityId={data.entityId}
              title={data.title ?? t('canvas.nodeTypes.agent')}
              source="node"
              canEdit={!readonly}
              actions={
                isHovered || selected ? (
                  <SkillResponseActions
                    readonly={readonly}
                    nodeIsExecuting={isExecuting}
                    workflowIsRunning={workflowIsRunning}
                    onRerun={handleRerunSingle}
                    onRerunFromHere={handleRerunFromHere}
                    onStop={handleStop}
                    status={status}
                  />
                ) : null
              }
            />

            <div className={'relative flex-grow overflow-y-auto w-full'}>
              {/* Always show content preview, use prompt/query as fallback when content is empty */}
              <SkillResponseContentPreview className="p-3" nodeId={id} metadata={metadata} />
            </div>
          </div>
        </div>

        {!isPreview && status !== 'init' && (
          <NodeStatusBar
            resultId={entityId}
            status={status}
            errorType={errorType}
            executionTime={metadata?.executionTime}
            error={result?.errors?.[0] ?? ''}
            version={version}
          />
        )}
      </>
    );
  },
  (prevProps, nextProps) => {
    // Compare style and sizeMode
    const prevStyle = prevProps.data?.metadata?.style;
    const nextStyle = nextProps.data?.metadata?.style;
    const styleEqual = JSON.stringify(prevStyle) === JSON.stringify(nextStyle);

    return (
      prevProps.id === nextProps.id &&
      prevProps.selected === nextProps.selected &&
      prevProps.isPreview === nextProps.isPreview &&
      prevProps.hideActions === nextProps.hideActions &&
      prevProps.hideHandles === nextProps.hideHandles &&
      prevProps.data?.title === nextProps.data?.title &&
      prevProps.data?.contentPreview === nextProps.data?.contentPreview &&
      prevProps.data?.createdAt === nextProps.data?.createdAt &&
      prevProps.onNodeClick === nextProps.onNodeClick &&
      JSON.stringify(prevProps.data?.metadata) === JSON.stringify(nextProps.data?.metadata) &&
      styleEqual
    );
  },
);

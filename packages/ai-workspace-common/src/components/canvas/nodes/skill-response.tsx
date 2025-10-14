import { Position, useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { Divider, Input, message } from 'antd';
import type { InputRef } from 'antd';
import { CanvasNode, purgeToolsets } from '@refly/canvas-common';
import { useState, useCallback, useRef, useEffect, memo, useMemo } from 'react';
import { CustomHandle } from './shared/custom-handle';
import { getNodeCommonStyles } from './shared/styles';
import { SkillResponseNodeProps } from './shared/types';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { useInsertToDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-insert-to-document';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import {
  IconError,
  IconLoading,
  IconToken,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { useActionResultStore, useActionResultStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { SelectedSkillHeader } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/selected-skill-header';
import { nodeActionEmitter } from '@refly-packages/ai-workspace-common/events/nodeActions';
import {
  createNodeEventName,
  cleanupNodeEvents,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genSkillID } from '@refly/utils/id';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
import cn from 'classnames';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import { truncateContent } from '@refly-packages/ai-workspace-common/utils/content';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useSkillError } from '@refly-packages/ai-workspace-common/hooks/use-skill-error';
import { ModelIcon } from '@lobehub/icons';
import { useSelectedNodeZIndex } from '@refly-packages/ai-workspace-common/hooks/canvas/use-selected-node-zIndex';
import { NodeActionButtons } from './shared/node-action-buttons';
import { useGetNodeConnectFromDragCreateInfo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-connect';
import { NodeDragCreateInfo } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import {
  useNodeExecutionStatus,
  useNodeExecutionFocus,
} from '@refly-packages/ai-workspace-common/hooks/canvas';
import { StepStatusIndicator } from '../../step/StepStatusIndicator';
import { useStepNodeStatus } from '../../../hooks/useStepNodeStatus';
import { useCopilotStore } from '@refly/stores';
import { NodeExecutionStatus } from './shared/node-execution-status';
import { NodeExecutionOverlay } from './shared/node-execution-overlay';
import { useGetPilotSessionDetail } from '@refly-packages/ai-workspace-common/queries/queries';
import { usePilotRecovery } from '@refly-packages/ai-workspace-common/hooks/pilot/use-pilot-recovery';
import { usePilotStoreShallow } from '@refly/stores';

import { MultimodalContentPreview } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/multimodal-content-preview';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { logEvent } from '@refly/telemetry-web';

const NODE_WIDTH = 320;
const NODE_SIDE_CONFIG = { width: NODE_WIDTH, height: 'auto', maxHeight: 214 };

export const NodeHeader = memo(
  ({
    query,
    skillName,
    skill,
    disabled,
    showIcon,
    updateTitle,
    source,
  }: {
    query: string;
    skillName?: string;
    skill?: any;
    disabled: boolean;
    showIcon?: boolean;
    updateTitle: (title: string) => void;
    className?: string;
    source?: string;
  }) => {
    const { t } = useTranslation();
    const [editTitle, setEditTitle] = useState(query);
    const inputRef = useRef<InputRef>(null);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
      setEditTitle(query);
    }, [query]);

    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
      }
    }, [isEditing]);

    const handleBlur = () => {
      setIsEditing(false);
    };

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditTitle(e.target.value);
        updateTitle(e.target.value);
      },
      [setEditTitle, updateTitle],
    );

    return (
      <>
        <div
          data-cy="skill-response-node-header"
          className={`flex-shrink-0 ${source === 'skillResponsePreview' ? 'mb-0' : 'mb-3'}`}
        >
          <div className="flex items-center gap-2">
            {showIcon && <NodeIcon type="skillResponse" />}
            {isEditing ? (
              <Input
                ref={inputRef}
                className={`${
                  source === 'skillResponsePreview' ? 'text-lg' : ''
                } !border-transparent rounded-md font-bold focus:!bg-refly-tertiary-hover px-0.5 py-0 !bg-refly-tertiary-hover !text-refly-text-0`}
                value={editTitle}
                data-cy="skill-response-node-header-input"
                onBlur={handleBlur}
                onChange={handleChange}
              />
            ) : (
              <div
                className={`flex-1 rounded-md h-6 px-0.5 box-border font-bold leading-6 truncate block hover:bg-refly-tertiary-hover ${
                  source === 'skillResponsePreview' ? 'text-lg' : 'text-sm'
                }`}
                title={editTitle}
                onClick={() => {
                  !disabled && setIsEditing(true);
                }}
              >
                {editTitle || t('common.untitled')}
              </div>
            )}
          </div>
        </div>
        {skillName && skillName !== 'commonQnA' && (
          <div className="flex-shrink-0 mb-2">
            <SelectedSkillHeader readonly skill={skill} className="rounded-md" />
          </div>
        )}
      </>
    );
  },
);

const NodeFooter = memo(
  ({
    model,
    modelInfo,
    tokenUsage,
    createdAt,
    language,
  }: {
    model: string;
    modelInfo: any;
    tokenUsage: any;
    createdAt: string;
    language: string;
  }) => {
    return (
      <div className="flex-shrink-0 mt-2 flex flex-wrap justify-between items-center text-[10px] text-gray-400 relative z-20 gap-1 dark:text-gray-500 w-full">
        <div className="flex flex-wrap items-center gap-1 max-w-[70%]">
          {model && (
            <div className="flex items-center gap-1 overflow-hidden">
              <ModelIcon model={modelInfo?.name} size={16} type={'color'} />
              <span className="truncate">{model}</span>
            </div>
          )}
          {model && tokenUsage ? <Divider type="vertical" className="mx-1" /> : null}
          {tokenUsage?.reduce ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <IconToken className="w-3 h-3" />
              {tokenUsage.reduce((acc, t) => acc + t.inputTokens + t.outputTokens, 0)}
            </div>
          ) : (
            <div className="flex items-center gap-1 flex-shrink-0">
              <IconToken className="w-3 h-3" />
              {0}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          {time(createdAt, language as LOCALE)
            ?.utc()
            ?.fromNow()}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.model === nextProps.model &&
      prevProps.createdAt === nextProps.createdAt &&
      prevProps.language === nextProps.language &&
      JSON.stringify(prevProps.modelInfo) === JSON.stringify(nextProps.modelInfo) &&
      JSON.stringify(prevProps.tokenUsage) === JSON.stringify(nextProps.tokenUsage)
    );
  },
);

NodeFooter.displayName = 'NodeFooter';

export const SkillResponseNode = memo(
  ({
    data,
    selected,
    id,
    isPreview = false,
    hideHandles = false,
    onNodeClick,
  }: SkillResponseNodeProps) => {
    const [isHovered, setIsHovered] = useState(false);
    useSelectedNodeZIndex(id, selected);

    const { setNodeData, setNodeStyle } = useNodeData();
    const { getEdges } = useReactFlow();
    const updateNodeTitle = useUpdateNodeTitle();
    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);
    const { readonly, canvasId } = useCanvasContext();

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

    // Get node execution status
    const { status: executionStatus, isExecuting } = useNodeExecutionStatus({
      canvasId: canvasId || '',
      nodeId: id,
    });

    // Auto-focus on node when executing
    useNodeExecutionFocus({
      isExecuting,
      canvasId: canvasId || '',
    });

    // Get workflow mode and step status for Daily AI News workflow
    const { mode: copilotMode } = useCopilotStore();
    const isWorkflowMode = copilotMode === 'workflow';
    const { status: stepStatus } = useStepNodeStatus(id);

    const nodeStyle = useMemo(
      () => (isPreview ? { width: NODE_WIDTH, height: 214 } : NODE_SIDE_CONFIG),
      [isPreview],
    );

    const { t, i18n } = useTranslation();
    const language = i18n.languages?.[0];

    const {
      title,
      editedTitle,
      contentPreview: content,
      metadata,
      createdAt,
      entityId,
    } = data ?? {};
    const { errMsg } = useSkillError(metadata?.errors?.[0]);

    // Find current node's corresponding pilot step
    const currentPilotStep = useMemo(() => {
      if (!sessionData?.data?.steps || !entityId) return null;

      return sessionData.data.steps.find((step) => step.entityId === entityId);
    }, [sessionData, entityId]);

    const { getConnectionInfo } = useGetNodeConnectFromDragCreateInfo();

    const {
      status,
      currentLog: log,
      modelInfo,
      structuredData,
      selectedSkill,
      actionMeta,
      tokenUsage,
      version,
      shareId,
    } = metadata ?? {};
    const currentSkill = actionMeta || selectedSkill;

    const { startPolling, resetFailedState } = useActionPolling();
    const { isStreaming, removeStreamResult } = useActionResultStoreShallow((state) => ({
      isStreaming: !!state.streamResults[entityId],
      removeStreamResult: state.removeStreamResult,
    }));

    // Use pilot recovery hook for pilot steps
    const { recoverSteps } = usePilotRecovery({
      canvasId: canvasId || '',
      sessionId: activeSessionId || '',
    });

    useEffect(() => {
      if (!isStreaming) {
        if (['executing', 'waiting'].includes(status) && !shareId) {
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
    }, [isStreaming, status, startPolling, entityId, shareId, version, removeStreamResult]);

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

    const sources = Array.isArray(structuredData?.sources) ? structuredData?.sources : [];

    const logTitle = log
      ? t(`${log.key}.title`, {
          ...log.titleArgs,
          ns: 'skillLog',
          defaultValue: log.key,
        })
      : '';
    const logDescription = log
      ? t(`${log.key}.description`, {
          ...log.descriptionArgs,
          ns: 'skillLog',
          defaultValue: '',
        })
      : '';

    const skill = {
      name: currentSkill?.name || 'commonQnA',
      icon: currentSkill?.icon,
    };
    const skillName = currentSkill?.name || 'commonQnA';
    const model = modelInfo?.label;

    // Get query and response content from result
    const query = editedTitle || title;

    // Check if node has any connections
    const edges = getEdges();
    const isTargetConnected = edges?.some((edge) => edge.target === id);
    const isSourceConnected = edges?.some((edge) => edge.source === id);

    // Handle node hover events
    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      onHoverStart();
    }, [onHoverStart]);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
      onHoverEnd();
    }, [onHoverEnd]);

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

      setNodeData(id, {
        ...data,
        contentPreview: '',
        metadata: {
          ...data?.metadata,
          status: 'waiting',
        },
      });

      invokeAction(
        {
          resultId: entityId,
          query: title,
          selectedSkill: skill,
          contextItems: data?.metadata?.contextItems,
          selectedToolsets: purgeToolsets(data?.metadata?.selectedToolsets),
        },
        {
          entityType: 'canvas',
          entityId: canvasId,
        },
      );
    }, [
      data,
      entityId,
      canvasId,
      id,
      title,
      invokeAction,
      setNodeData,
      resetFailedState,
      setNodeStyle,
      skill,
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

      logEvent('rerun_ask_ai', null, {
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

    const insertToDoc = useInsertToDocument(entityId);
    const handleInsertToDoc = useCallback(
      async (content: string) => {
        await insertToDoc('insertBelow', content);
      },
      [insertToDoc],
    );

    const { deleteNode } = useDeleteNode();

    const handleDelete = useCallback(() => {
      logEvent('delete_node_ask_ai', null, {
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

    const { debouncedCreateDocument } = useCreateDocument();

    const handleCreateDocument = useCallback(
      async (event?: {
        dragCreateInfo?: NodeDragCreateInfo;
      }) => {
        try {
          // Fetch complete action result from server to get full content
          const { data, error } = await getClient().getActionResult({
            query: { resultId: entityId },
          });

          if (error || !data?.success) {
            message.error(t('canvas.skillResponse.fetchContentFailed'));
            return;
          }

          // Extract full content from all steps and remove tool_use tags
          const fullContent = data.data.steps
            ?.map((step) => step?.content || '')
            .filter(Boolean)
            .join('\n\n')
            .replace(/<tool_use>[\s\S]*?<\/tool_use>/g, '')
            .trim();

          const { position, connectTo } = getConnectionInfo(
            { entityId, type: 'skillResponse' },
            event?.dragCreateInfo,
          );

          // Create document with full content
          await debouncedCreateDocument(title ?? '', fullContent || content, {
            sourceNodeId: connectTo.find((c) => c.handleType === 'source')?.entityId,
            targetNodeId: connectTo.find((c) => c.handleType === 'target')?.entityId,
            position,
            addToCanvas: true,
            sourceType: 'skillResponse',
          });
        } catch (err) {
          console.error('Failed to create document:', err);
          message.error(t('canvas.skillResponse.createDocumentFailed'));
        } finally {
          nodeActionEmitter.emit(createNodeEventName(id, 'createDocument.completed'));
        }
      },
      [debouncedCreateDocument, entityId, title, content, t, id, getConnectionInfo],
    );

    const { addToContext } = useAddToContext();

    const handleAddToContext = useCallback(() => {
      logEvent('add_to_context_ask_ai', null, {
        canvasId,
        entityId,
        nodeId: id,
      });

      addToContext({
        type: 'skillResponse',
        title: title,
        entityId: entityId,
        metadata: data?.metadata,
      });
    }, [data, entityId, title, addToContext, canvasId, id]);

    const { addNode } = useAddNode();

    const handleAskAI = useCallback(
      (event?: {
        dragCreateInfo?: NodeDragCreateInfo;
      }) => {
        const { metadata } = data;
        const {
          selectedSkill,
          actionMeta,
          modelInfo,
          contextItems: responseContextItems = [],
          tplConfig,
        } = metadata;

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
          // Include the original context items from the response
          ...responseContextItems.map((item) => ({
            ...item,
            metadata: {
              ...item.metadata,
              withHistory: undefined,
            },
          })),
        ];

        // Create node connect filters - include both the response and its context items
        const connectFilters = [
          { type: 'skillResponse' as CanvasNodeType, entityId: data.entityId },
          ...responseContextItems
            .filter((item) => item.type !== 'skillResponse')
            .map((item) => ({
              type: item.type as CanvasNodeType,
              entityId: item.entityId,
            })),
        ];

        const { position, connectTo } = getConnectionInfo(
          { entityId: data.entityId, type: 'skillResponse' },
          event?.dragCreateInfo,
        );

        logEvent('append_ask_ai', null, {
          canvasId,
        });

        // Add a small delay to avoid race conditions with context items
        setTimeout(() => {
          addNode(
            {
              type: 'skill',
              data: {
                title: 'Skill',
                entityId: genSkillID(),
                metadata: {
                  ...metadata,
                  query: '',
                  contextItems: mergedContextItems,
                  selectedSkill: currentSkill,
                  modelInfo,
                  tplConfig,
                },
              },
              position,
            },
            [...connectTo, ...connectFilters],
            false,
            true,
          );
        }, 10);
      },
      [data, addNode, getConnectionInfo, canvasId],
    );

    const handleCloneAskAI = useCallback(async () => {
      const { contextItems, modelInfo, selectedSkill, tplConfig, structuredData } =
        data?.metadata || {};
      const currentSkill = actionMeta || selectedSkill;

      // Create new skill node with context, similar to group node implementation
      const connectTo = contextItems?.map((item) => ({
        type: item.type as CanvasNodeType,
        entityId: item.entityId,
      }));

      logEvent('clone_ask_ai', null, {
        canvasId,
        sourceEntityId: data.entityId,
        sourceNodeId: id,
      });

      // Create new skill node
      addNode(
        {
          type: 'skill',
          data: {
            title: t('canvas.nodeActions.cloneAskAI'),
            entityId: genSkillID(),
            metadata: {
              contextItems,
              query: structuredData?.query || title,
              modelInfo,
              selectedSkill: currentSkill,
              tplConfig,
            },
          },
        },
        connectTo,
        false,
        true,
      );

      nodeActionEmitter.emit(createNodeEventName(id, 'cloneAskAI.completed'));
    }, [id, data?.entityId, addNode, t, canvasId]);

    const onTitleChange = (newTitle: string) => {
      if (newTitle === query) {
        return;
      }
      updateNodeTitle(newTitle, data.entityId, id, 'skillResponse');
    };

    useEffect(() => {
      setNodeStyle(id, NODE_SIDE_CONFIG);
    }, [id, setNodeStyle]);

    // Update event handling
    useEffect(() => {
      // Create node-specific event handlers
      const handleNodeRerun = () => handleRerun();
      const handleNodeAddToContext = () => handleAddToContext();
      const handleNodeInsertToDoc = (event: { content: string }) =>
        handleInsertToDoc(event.content);
      const handleNodeCreateDocument = (event?: {
        dragCreateInfo?: NodeDragCreateInfo;
      }) => handleCreateDocument(event);
      const handleNodeDelete = () => handleDelete();
      const handleNodeAskAI = (event?: {
        dragCreateInfo?: NodeDragCreateInfo;
      }) => handleAskAI(event);
      const handleNodeCloneAskAI = () => handleCloneAskAI();

      // Register events with node ID
      nodeActionEmitter.on(createNodeEventName(id, 'askAI'), handleNodeAskAI);
      nodeActionEmitter.on(createNodeEventName(id, 'cloneAskAI'), handleNodeCloneAskAI);
      nodeActionEmitter.on(createNodeEventName(id, 'rerun'), handleNodeRerun);
      nodeActionEmitter.on(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
      nodeActionEmitter.on(createNodeEventName(id, 'insertToDoc'), handleNodeInsertToDoc);
      nodeActionEmitter.on(createNodeEventName(id, 'createDocument'), handleNodeCreateDocument);
      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);

      return () => {
        // Cleanup events when component unmounts
        nodeActionEmitter.off(createNodeEventName(id, 'askAI'), handleNodeAskAI);
        nodeActionEmitter.off(createNodeEventName(id, 'cloneAskAI'), handleNodeCloneAskAI);
        nodeActionEmitter.off(createNodeEventName(id, 'rerun'), handleNodeRerun);
        nodeActionEmitter.off(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
        nodeActionEmitter.off(createNodeEventName(id, 'insertToDoc'), handleNodeInsertToDoc);
        nodeActionEmitter.off(createNodeEventName(id, 'createDocument'), handleNodeCreateDocument);
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);

        // Clean up all node events
        cleanupNodeEvents(id);
      };
    }, [
      id,
      handleRerun,
      handleAddToContext,
      handleInsertToDoc,
      handleCreateDocument,
      handleDelete,
      handleAskAI,
      handleCloneAskAI,
    ]);

    return (
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="rounded-2xl relative"
        data-cy="skill-response-node"
        onClick={onNodeClick}
      >
        {!isPreview && !readonly && (
          <NodeActionButtons
            nodeId={id}
            nodeType="skillResponse"
            isNodeHovered={isHovered}
            isSelected={selected}
          />
        )}

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
              isNodeHovered={isHovered}
              nodeType="skillResponse"
            />
          </>
        )}

        <NodeExecutionOverlay status={executionStatus} />

        {/* Workflow Step Status Indicator - Top Right Corner */}
        {isWorkflowMode && !isPreview && (
          <div className="absolute top-2 right-2 z-10">
            <StepStatusIndicator status={stepStatus} size="small" />
          </div>
        )}

        <div
          style={nodeStyle}
          className={cn(
            'h-full flex flex-col relative z-1 p-4 box-border',
            getNodeCommonStyles({ selected, isHovered }),
            'flex max-h-60 flex-col items-start gap-2 self-stretch px-4 py-3 rounded-2xl border-solid',
            // Apply error styles only when there's an error
            status === 'failed'
              ? 'border border-[color:var(--func-danger---refly-func-danger-default,#F93920)] [background:var(--bg---refly-bg-content-z2,#FFF)] shadow-[0_2px_20px_4px_rgba(0,0,0,0.04)]'
              : 'border border-gray-200 [background:var(--bg---refly-bg-content-z2,#FFF)]',
            // Add workflow mode styling
            isWorkflowMode && 'border-2',
            isWorkflowMode && stepStatus === 'running' && 'border-green-500 shadow-lg',
            isWorkflowMode && stepStatus === 'completed' && 'border-green-400',
            isWorkflowMode && stepStatus === 'pending' && 'border-gray-300',
          )}
          data-step-status={stepStatus}
          data-node-id={id}
        >
          {/* Node execution status badge */}
          <NodeExecutionStatus status={executionStatus} />

          <NodeHeader
            showIcon
            disabled={readonly}
            query={query}
            skillName={skillName}
            skill={skill}
            updateTitle={onTitleChange}
          />

          <div className={'relative flex-grow overflow-y-auto pr-2 -mr-2 w-full'}>
            <div className="flex flex-col gap-3">
              {status === 'failed' && (
                <div
                  className={cn(
                    'flex items-center justify-center gap-1 mt-1 hover:bg-gray-50 rounded-md p-2 dark:hover:bg-gray-900',
                    readonly ? 'cursor-not-allowed' : 'cursor-pointer',
                  )}
                  onClick={() => handleRerun()}
                >
                  <IconError className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-red-500 w-full truncate">
                    {errMsg || t('canvas.skillResponse.executionFailed')}
                  </span>
                </div>
              )}

              {(status === 'waiting' || status === 'executing') && (
                <div className="flex items-center gap-2 bg-gray-100 rounded-md p-2 dark:bg-gray-800">
                  <IconLoading className="h-3 w-3 animate-spin text-green-500" />
                  <span className="text-xs text-gray-500 w-full truncate">
                    {log ? (
                      <>
                        <span className="text-green-500 font-medium">{`${logTitle} `}</span>
                        <span className="text-gray-500">{logDescription}</span>
                      </>
                    ) : (
                      t('canvas.skillResponse.aiThinking')
                    )}
                  </span>
                </div>
              )}

              {status !== 'failed' && content && (
                <MultimodalContentPreview
                  resultId={entityId}
                  content={truncateContent(content)}
                  sources={sources}
                  metadata={metadata as any}
                />
              )}
            </div>
          </div>

          <NodeFooter
            model={model}
            modelInfo={modelInfo}
            tokenUsage={tokenUsage}
            createdAt={createdAt}
            language={language}
          />
        </div>
      </div>
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
      JSON.stringify(prevProps.data?.metadata) === JSON.stringify(nextProps.data?.metadata) &&
      styleEqual
    );
  },
);

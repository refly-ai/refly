import { IconError } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import {
  cleanupNodeEvents,
  createNodeEventName,
  nodeActionEmitter,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { useInsertToDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-insert-to-document';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
// import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { CanvasNode, purgeToolsets } from '@refly/canvas-common';
import { LOCALE } from '@refly/common-types';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useActionResultStore, useActionResultStoreShallow } from '@refly/stores';
import { genSkillID } from '@refly/utils/id';
import { Position, useReactFlow } from '@xyflow/react';
import { Button, message } from 'antd';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomHandle } from './shared/custom-handle';
import { getNodeCommonStyles } from './shared/styles';
import { SkillResponseNodeProps } from './shared/types';

import { ModelIcon } from '@lobehub/icons';
import {
  NodeDragCreateInfo,
  nodeOperationsEmitter,
} from '@refly-packages/ai-workspace-common/events/nodeOperations';
import {
  useNodeData,
  useNodeExecutionFocus,
  useNodeExecutionStatus,
} from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
import { useGetNodeConnectFromDragCreateInfo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-connect';
import { useSelectedNodeZIndex } from '@refly-packages/ai-workspace-common/hooks/canvas/use-selected-node-zIndex';
import { usePilotRecovery } from '@refly-packages/ai-workspace-common/hooks/pilot/use-pilot-recovery';
import { useSkillError } from '@refly-packages/ai-workspace-common/hooks/use-skill-error';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import { useGetPilotSessionDetail } from '@refly-packages/ai-workspace-common/queries/queries';
import {
  processContentPreview,
  truncateContent,
} from '@refly-packages/ai-workspace-common/utils/content';
import { usePilotStoreShallow } from '@refly/stores';
import cn from 'classnames';
import { NodeActionButtons } from './shared/node-action-buttons';
import { NodeExecutionStatus } from './shared/node-execution-status';

import { SkillResponseContentPreview } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/skill-response-content-preview';
import { NodeHeader } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-header';
import { logEvent } from '@refly/telemetry-web';
import { removeToolUseTags } from '@refly-packages/ai-workspace-common/utils';
import { More, Play } from 'refly-icons';
import './shared/executing-glow-effect.scss';

const NODE_WIDTH = 320;
const NODE_SIDE_CONFIG = { width: NODE_WIDTH, height: 'auto', maxHeight: 214 };

const NodeFooter = memo(
  ({
    model,
    modelInfo,
    createdAt,
    language,
  }: {
    model: string;
    modelInfo: any;
    createdAt: string;
    language: string;
    resultId?: string;
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
      JSON.stringify(prevProps.modelInfo) === JSON.stringify(nextProps.modelInfo)
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
    const [isHovered, _setIsHovered] = useState(false);
    useSelectedNodeZIndex(id, selected);

    const { setNodeData, setNodeStyle } = useNodeData();
    const { getEdges } = useReactFlow();
    const updateNodeTitle = useUpdateNodeTitle();
    // const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);
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

    const nodeStyle = useMemo(
      () => (isPreview ? { width: NODE_WIDTH, height: 214 } : NODE_SIDE_CONFIG),
      [isPreview],
    );

    const { t } = useTranslation();

    const { title, editedTitle, contentPreview: content, metadata, entityId } = data ?? {};
    const { errMsg } = useSkillError(metadata?.errors?.[0]);

    // Find current node's corresponding pilot step
    const currentPilotStep = useMemo(() => {
      if (!sessionData?.data?.steps || !entityId) return null;

      return sessionData.data.steps.find((step) => step.entityId === entityId);
    }, [sessionData, entityId]);

    const { getConnectionInfo } = useGetNodeConnectFromDragCreateInfo();

    const { status, structuredData, selectedSkill, actionMeta, version, shareId } = metadata ?? {};
    const currentSkill = actionMeta || selectedSkill;

    const { startPolling, resetFailedState } = useActionPolling();
    const { result, isStreaming, removeStreamResult } = useActionResultStoreShallow((state) => ({
      result: state.resultMap[entityId],
      isStreaming: !!state.streamResults[entityId],
      removeStreamResult: state.removeStreamResult,
    }));

    // Sync node status with action result status
    useEffect(() => {
      if (!result || !data) return;

      const nodePreview = data.contentPreview;
      const resultPreview = processContentPreview(result.steps?.map((s) => s?.content || ''));

      const needsStatusUpdate = result.status !== data.metadata?.status;
      const needsPreviewUpdate = nodePreview !== resultPreview;

      if (needsStatusUpdate || needsPreviewUpdate) {
        setNodeData(id, {
          ...data,
          ...(needsStatusUpdate && {
            metadata: { ...data.metadata, status: result.status },
          }),
          ...(needsPreviewUpdate && {
            contentPreview: resultPreview,
          }),
        });
      }
    }, [result, data, id, setNodeData]);

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

    // const logTitle = log
    //   ? t(`${log.key}.title`, {
    //     ...log.titleArgs,
    //     ns: 'skillLog',
    //     defaultValue: log.key,
    //   })
    //   : '';
    // const logDescription = log
    //   ? t(`${log.key}.description`, {
    //     ...log.descriptionArgs,
    //     ns: 'skillLog',
    //     defaultValue: '',
    //   })
    //   : '';

    const skill = {
      name: currentSkill?.name || 'commonQnA',
      icon: currentSkill?.icon,
    };

    // Get query and response content from result
    const query = editedTitle || title;

    // Check if node has any connections
    const edges = getEdges();
    const isTargetConnected = edges?.some((edge) => edge.target === id);
    const isSourceConnected = edges?.some((edge) => edge.source === id);

    // Handle node hover events
    // const handleMouseEnter = useCallback(() => {
    //   setIsHovered(true);
    //   onHoverStart();
    // }, [onHoverStart]);

    // const handleMouseLeave = useCallback(() => {
    //   setIsHovered(false);
    //   onHoverEnd();
    // }, [onHoverEnd]);

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
        ...data,
        contentPreview: '',
        metadata: {
          ...data?.metadata,
          status: 'waiting',
          version: nextVersion,
        },
      });

      invokeAction(
        {
          resultId: entityId,
          query: title,
          selectedSkill: skill,
          contextItems: data?.metadata?.contextItems,
          selectedToolsets: purgeToolsets(data?.metadata?.selectedToolsets),
          version: nextVersion,
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
          const fullContent = removeToolUseTags(
            (data.data?.steps || [])
              ?.map((step) => step?.content || '')
              .filter(Boolean)
              .join('\n\n')
              .trim(),
          )?.trim();

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
          // contextItems: responseContextItems = [],
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
          // // Include the original context items from the response
          // ...responseContextItems.map((item) => ({
          //   ...item,
          //   metadata: {
          //     ...item.metadata,
          //     withHistory: undefined,
          //   },
          // })),
        ];

        // Create node connect filters - include both the response and its context items
        const connectFilters = [
          { type: 'skillResponse' as CanvasNodeType, entityId: data.entityId },
          // ...responseContextItems
          //   .filter((item) => item.type !== 'skillResponse')
          //   .map((item) => ({
          //     type: item.type as CanvasNodeType,
          //     entityId: item.entityId,
          //   })),
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
        // onMouseEnter={handleMouseEnter}
        // onMouseLeave={handleMouseLeave}
        className={cn(
          'rounded-2xl relative',
          // Apply executing/waiting glow effect on outer container
          status === 'executing' || status === 'waiting' ? 'executing-glow-effect' : '',
        )}
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

        <div
          style={nodeStyle}
          className={cn(
            'h-full flex flex-col relative z-1 p-0 box-border',
            getNodeCommonStyles({ selected, isHovered }),
            'flex max-h-60 flex-col items-start self-stretch rounded-2xl border-solid',
            // Apply error styles only when there's an error
            status === 'failed'
              ? 'border border-refly-func-danger-default bg-refly-bg-content-z2'
              : 'border border-gray-200 bg-refly-bg-content-z2',
          )}
        >
          {/* Node execution status badge */}
          <NodeExecutionStatus status={executionStatus} />

          <NodeHeader
            nodeType="skillResponse"
            title={query}
            canEdit={true}
            disabled={readonly}
            updateTitle={onTitleChange}
            actions={
              <>
                <Button
                  type="text"
                  size="small"
                  icon={<Play size={12} />}
                  onClick={() => nodeActionEmitter.emit(createNodeEventName(id, 'rerun'))}
                  className="h-6 p-0 flex items-center justify-center hover:!bg-refly-tertiary-hover"
                />
                <Button
                  type="text"
                  size="small"
                  icon={<More size={12} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    nodeOperationsEmitter.emit('openNodeContextMenu', {
                      nodeId: id,
                      nodeType: 'skillResponse',
                      x: e.clientX,
                      y: e.clientY,
                      originalEvent: e,
                    } as any);
                  }}
                  className="h-6 p-0 flex items-center justify-center hover:!bg-refly-tertiary-hover"
                />
              </>
            }
          />

          <div className={'relative flex-grow overflow-y-auto w-full'}>
            <div className="flex flex-col p-3">
              {status === 'failed' && (
                <div
                  className={cn(
                    'flex items-center justify-center gap-1 hover:bg-gray-50 rounded-md p-2 dark:hover:bg-gray-900',
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

              {/* {(status === 'waiting' || status === 'executing') && (
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
              )} */}

              {/* Always show content preview, use prompt/query as fallback when content is empty */}
              <SkillResponseContentPreview
                nodeId={id}
                content={truncateContent(content || (structuredData?.query as any) || query || '')}
                metadata={metadata as any}
              />
            </div>
          </div>

          {/* <NodeFooter
            model={model}
            modelInfo={modelInfo}
            createdAt={createdAt}
            language={language}
            resultId={entityId}
          /> */}
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

import { Position, useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import Moveable from 'react-moveable';
import classNames from 'classnames';
import { Divider, Input, message, Typography } from 'antd';
import type { InputRef } from 'antd';
import { CanvasNode, SkillResponseNodeProps } from './shared/types';
import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import { CustomHandle } from './shared/custom-handle';
import { LuChevronRight } from 'react-icons/lu';
import { getNodeCommonStyles } from './index';
import { ActionButtons } from './shared/action-buttons';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { useInsertToDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-insert-to-document';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import {
  IconError,
  IconLoading,
  IconResponse,
  IconSearch,
  IconToken,
  preloadModelIcons,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { getArtifactIcon } from '@refly-packages/ai-workspace-common/components/common/result-display';
import { useKnowledgeBaseStoreShallow } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { SelectedSkillHeader } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/selected-skill-header';
import { ModelProviderIcons } from '@refly-packages/ai-workspace-common/components/common/icon';
import { nodeActionEmitter } from '@refly-packages/ai-workspace-common/events/nodeActions';
import {
  createNodeEventName,
  cleanupNodeEvents,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { usePatchNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-patch-node-data';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { genSkillID } from '@refly-packages/utils/id';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { convertResultContextToItems } from '@refly-packages/ai-workspace-common/utils/map-context-items';
import { NodeResizer as NodeResizerComponent } from './shared/node-resizer';
import {
  useNodeSize,
  MAX_HEIGHT_CLASS,
} from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-size';
import { ContentPreview } from './shared/content-preview';
import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
import { useEditorPerformance } from '@refly-packages/ai-workspace-common/context/editor-performance';
import cn from 'classnames';
import { ReasoningContentPreview } from './shared/reasoning-content-preview';
import { useUpdateSkillResponseTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-skill-response-title';
import { truncateContent } from '@refly-packages/ai-workspace-common/utils/content';

const POLLING_WAIT_TIME = 15000;

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
            {showIcon && (
              <div className="w-6 h-6 rounded bg-[#F79009] shadow-lg flex items-center justify-center flex-shrink-0">
                <IconResponse className="w-4 h-4 text-white" />
              </div>
            )}
            {isEditing ? (
              <Input
                ref={inputRef}
                className={`${
                  source === 'skillResponsePreview' ? 'text-lg' : ''
                } !border-transparent font-bold focus:!bg-transparent px-0.5 py-0 !bg-transparent !text-gray-700`}
                value={editTitle}
                data-cy="skill-response-node-header-input"
                onBlur={handleBlur}
                onChange={handleChange}
              />
            ) : (
              <Typography.Text
                className={`font-bold leading-normal truncate block ${
                  source === 'skillResponsePreview' ? 'text-lg' : 'text-sm'
                }`}
                title={editTitle}
                onClick={() => {
                  !disabled && setIsEditing(true);
                }}
              >
                {editTitle || t('common.untitled')}
              </Typography.Text>
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

const ModelIcon = memo(({ provider }: { provider: string }) => {
  return <img className="w-3 h-3" src={ModelProviderIcons[provider]} alt={provider} />;
});

ModelIcon.displayName = 'ModelIcon';

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
      <div className="flex-shrink-0 mt-2 flex flex-wrap justify-between items-center text-[10px] text-gray-400 relative z-20 gap-1">
        <div className="flex flex-wrap items-center gap-1 max-w-[70%]">
          {model && (
            <div className="flex items-center gap-1 overflow-hidden">
              <ModelIcon provider={modelInfo?.provider} />
              <span className="truncate">{model}</span>
            </div>
          )}
          {model && tokenUsage ? <Divider type="vertical" className="mx-1" /> : null}
          {tokenUsage && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <IconToken className="w-3 h-3" />
              {tokenUsage.reduce((acc, t) => acc + t.inputTokens + t.outputTokens, 0)}
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
    hideActions = false,
    isPreview = false,
    hideHandles = false,
    onNodeClick,
  }: SkillResponseNodeProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const { draggingNodeId } = useEditorPerformance();
    const isDragging = draggingNodeId === id;

    const { edges, operatingNodeId } = useCanvasStoreShallow((state) => ({
      edges: state.data[state.currentCanvasId]?.edges ?? [],
      operatingNodeId: state.operatingNodeId,
    }));
    const updateSkillResponseTitle = useUpdateSkillResponseTitle();
    const patchNodeData = usePatchNodeData();
    const { getNode } = useReactFlow();
    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);

    const targetRef = useRef<HTMLDivElement>(null);
    const { t, i18n } = useTranslation();
    const language = i18n.languages?.[0];

    const { canvasId, readonly } = useCanvasContext();

    const { title, contentPreview: content, metadata, createdAt, entityId } = data ?? {};

    const isOperating = operatingNodeId === id;
    const sizeMode = data?.metadata?.sizeMode || 'adaptive';
    const node = useMemo(() => getNode(id), [id, getNode]);

    const { containerStyle, handleResize, updateSize } = useNodeSize({
      id,
      node,
      sizeMode,
      readonly,
      isOperating,
      minWidth: 100,
      maxWidth: 800,
      minHeight: 80,
      defaultWidth: 288,
      defaultHeight: 'auto',
    });
    const moveableRef = useRef<Moveable>(null);

    const {
      status,
      artifacts,
      currentLog: log,
      modelInfo,
      structuredData,
      actionMeta,
      tokenUsage,
      version,
    } = metadata ?? {};

    const { startPolling } = useActionPolling();

    useEffect(() => {
      if (
        createdAt &&
        Date.now() - new Date(createdAt).getTime() >= POLLING_WAIT_TIME &&
        status === 'executing'
      ) {
        startPolling(entityId, version);
      }
    }, [createdAt, status, startPolling, entityId, version]);

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
      name: actionMeta?.name || 'CommonQnA',
      icon: actionMeta?.icon,
    };
    const skillName = actionMeta?.name;
    const model = modelInfo?.label;

    // Get query and response content from result
    const query = title;

    // Check if node has any connections
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

    const { invokeAction } = useInvokeAction();

    const handleRerun = useCallback(() => {
      if (readonly) {
        return;
      }

      if (['executing', 'waiting'].includes(data?.metadata?.status)) {
        message.info(t('canvas.skillResponse.executing'));
        return;
      }

      message.info(t('canvas.skillResponse.startRerun'));

      updateSize({ width: 288, height: 'auto' });

      patchNodeData(id, {
        ...data,
        contentPreview: '',
        metadata: {
          status: 'waiting',
        },
      });

      invokeAction(
        {
          resultId: entityId,
          query: title,
          selectedSkill: skill,
          contextItems: data?.metadata?.contextItems,
        },
        {
          entityType: 'canvas',
          entityId: canvasId,
        },
      );
    }, [data, entityId, canvasId, id, title, t, updateSize, invokeAction, patchNodeData, readonly]);

    const insertToDoc = useInsertToDocument(entityId);
    const handleInsertToDoc = useCallback(async () => {
      await insertToDoc('insertBelow', content);
    }, [insertToDoc, content]);

    const { deleteNode } = useDeleteNode();

    const handleDelete = useCallback(() => {
      deleteNode({
        id,
        type: 'skillResponse',
        data,
        position: { x: 0, y: 0 },
      } as CanvasNode);
    }, [id, data, deleteNode]);

    const { debouncedCreateDocument } = useCreateDocument();

    const handleCreateDocument = useCallback(async () => {
      try {
        // Fetch complete action result from server to get full content
        const { data, error } = await getClient().getActionResult({
          query: { resultId: entityId },
        });

        if (error || !data?.success) {
          message.error(t('canvas.skillResponse.fetchContentFailed'));
          return;
        }

        // Extract full content from all steps
        const fullContent = data.data.steps
          ?.map((step) => step?.content || '')
          .filter(Boolean)
          .join('\n\n');

        // Create document with full content
        await debouncedCreateDocument(title ?? '', fullContent || content, {
          sourceNodeId: entityId,
          addToCanvas: true,
          sourceType: 'skillResponse',
        });
      } catch (err) {
        console.error('Failed to create document:', err);
        message.error(t('canvas.skillResponse.createDocumentFailed'));
      }
    }, [debouncedCreateDocument, entityId, title, content, t]);

    const { addToContext } = useAddToContext();

    const handleAddToContext = useCallback(() => {
      addToContext({
        type: 'skillResponse',
        title: title,
        entityId: entityId,
        metadata: data?.metadata,
      });
    }, [data, entityId, title, addToContext]);

    const knowledgeBaseStore = useKnowledgeBaseStoreShallow((state) => ({
      updateSourceListDrawer: state.updateSourceListDrawer,
    }));

    const handleClickSources = useCallback(() => {
      knowledgeBaseStore.updateSourceListDrawer({
        visible: true,
        sources: sources,
        query: query,
      });
    }, [sources, query, knowledgeBaseStore]);

    const resizeMoveable = useCallback((width: number, height: number) => {
      moveableRef.current?.request('resizable', { width, height });
    }, []);

    const { addNode } = useAddNode();

    const handleAskAI = useCallback(() => {
      const { metadata } = data;
      const { actionMeta, modelInfo } = metadata;
      addNode(
        {
          type: 'skill',
          data: {
            title: 'Skill',
            entityId: genSkillID(),
            metadata: {
              contextItems: [
                {
                  type: 'skillResponse',
                  title: data.title,
                  entityId: data.entityId,
                  metadata: {
                    ...data.metadata,
                    withHistory: true,
                  },
                },
              ],
              selectedSkill: actionMeta,
              modelInfo,
            },
          },
        },
        [{ type: 'skillResponse', entityId: data.entityId }],
        false,
        true,
      );
    }, [data, addNode]); // Add new handler for compare run

    const handleCloneAskAI = useCallback(async () => {
      // Fetch action result to get context
      const { data: resultData } = await getClient().getActionResult({
        query: { resultId: data?.entityId },
      });

      if (!resultData?.success || !resultData.data) {
        return;
      }

      const { context, history, title, modelInfo, actionMeta, tplConfig } = resultData.data;
      const contextItems = context ? convertResultContextToItems(context, history) : [];

      // Create new skill node with context, similar to group node implementation
      const connectTo = contextItems.map((item) => ({
        type: item.type as CanvasNodeType,
        entityId: item.entityId,
      }));

      // Create new skill node
      addNode(
        {
          type: 'skill',
          data: {
            title: t('canvas.nodeActions.cloneAskAI'),
            entityId: genSkillID(),
            metadata: {
              contextItems,
              query: title,
              modelInfo,
              selectedSkill: actionMeta,
              tplConfig,
            },
          },
        },
        connectTo,
      );

      nodeActionEmitter.emit(createNodeEventName(id, 'cloneAskAI.completed'));
    }, [id, data?.entityId, addNode, t]);

    const onTitleChange = (newTitle: string) => {
      if (newTitle === query) {
        return;
      }
      updateSkillResponseTitle(newTitle, data.entityId, id);
    };

    // Update size when content changes
    useEffect(() => {
      if (!targetRef.current) return;

      const { offsetWidth, offsetHeight } = targetRef.current;
      resizeMoveable(offsetWidth, offsetHeight);
    }, [resizeMoveable, targetRef.current?.offsetHeight]);

    // Update event handling
    useEffect(() => {
      // Create node-specific event handlers
      const handleNodeRerun = () => handleRerun();
      const handleNodeAddToContext = () => handleAddToContext();
      const handleNodeInsertToDoc = () => handleInsertToDoc();
      const handleNodeCreateDocument = () => handleCreateDocument();
      const handleNodeDelete = () => handleDelete();
      const handleNodeAskAI = () => handleAskAI();
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

    useEffect(() => {
      preloadModelIcons();
    }, []);

    return (
      <div
        className={classNames({ nowheel: isOperating && isHovered })}
        data-cy="skill-response-node"
      >
        <div
          ref={targetRef}
          className={classNames({
            'relative nodrag nopan select-text': isOperating,
          })}
          style={isPreview ? { width: 288, height: 200 } : containerStyle}
          onClick={onNodeClick}
        >
          {!isPreview && !hideActions && !isDragging && !readonly && (
            <ActionButtons type="skillResponse" nodeId={id} isNodeHovered={selected && isHovered} />
          )}

          <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`h-full flex flex-col ${getNodeCommonStyles({ selected, isHovered })}`}
          >
            {!isPreview && !hideHandles && (
              <>
                <CustomHandle
                  id={`${id}-target`}
                  type="target"
                  position={Position.Left}
                  isConnected={isTargetConnected}
                  isNodeHovered={isHovered}
                  nodeType="response"
                />
                <CustomHandle
                  id={`${id}-source`}
                  type="source"
                  position={Position.Right}
                  isConnected={isSourceConnected}
                  isNodeHovered={isHovered}
                  nodeType="response"
                />
              </>
            )}

            <div className={cn('flex flex-col h-full p-3 box-border', MAX_HEIGHT_CLASS)}>
              <NodeHeader
                showIcon
                disabled={readonly}
                query={query}
                skillName={skillName}
                skill={skill}
                updateTitle={onTitleChange}
              />

              <div className={'relative flex-grow overflow-y-auto pr-2 -mr-2'}>
                <div className="flex flex-col gap-3">
                  {status === 'failed' && (
                    <div
                      className={cn(
                        'flex items-center justify-center gap-1 mt-1 hover:bg-gray-50 rounded-md p-2',
                        readonly ? 'cursor-not-allowed' : 'cursor-pointer',
                      )}
                      onClick={() => handleRerun()}
                    >
                      <IconError className="h-4 w-4 text-red-500" />
                      <span className="text-xs text-red-500 max-w-48 truncate">
                        {t('canvas.skillResponse.executionFailed')}
                      </span>
                    </div>
                  )}

                  {(status === 'waiting' || status === 'executing') && (
                    <div className="flex items-center gap-2 bg-gray-100 rounded-md p-2">
                      <IconLoading className="h-3 w-3 animate-spin text-green-500" />
                      <span className="text-xs text-gray-500 max-w-48 truncate">
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

                  {status !== 'failed' && sources.length > 0 && (
                    <div
                      className="flex items-center rounded-md justify-between gap-2 border-gray-100 border-solid p-2 hover:bg-gray-50 cursor-pointer "
                      onClick={handleClickSources}
                    >
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <>
                          <IconSearch className="h-3 w-3 text-gray-500" />
                          {t('canvas.skillResponse.sourcesCnt', { count: sources.length })}
                        </>
                      </span>
                      <LuChevronRight className="h-3 w-3 text-gray-500" />
                    </div>
                  )}

                  {status !== 'failed' && artifacts?.length > 0 && (
                    <div className="flex items-center gap-2">
                      {artifacts
                        ?.filter((artifact) => artifact.title)
                        .map((artifact) => (
                          <div
                            key={artifact.entityId}
                            className="border border-solid border-gray-200 rounded-md px-2 py-2 w-full flex items-center gap-1"
                          >
                            {getArtifactIcon(artifact, 'text-gray-500')}
                            <span className="text-xs text-gray-500 max-w-[200px] truncate inline-block">
                              {artifact.title}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}

                  {status !== 'failed' && metadata?.reasoningContent && (
                    <ReasoningContentPreview
                      resultId={entityId}
                      content={truncateContent(metadata.reasoningContent)}
                      sources={sources}
                      isOperating={isOperating}
                      stepStatus={status === 'executing' ? 'executing' : 'finish'}
                      sizeMode={sizeMode}
                    />
                  )}

                  {status !== 'failed' && content && (
                    <ContentPreview
                      resultId={entityId}
                      content={truncateContent(content)}
                      sizeMode={sizeMode}
                      isOperating={isOperating}
                      sources={sources}
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
        </div>

        {!isPreview && selected && sizeMode === 'adaptive' && !readonly && (
          <NodeResizerComponent
            moveableRef={moveableRef}
            targetRef={targetRef}
            isSelected={selected}
            isHovered={isHovered}
            isPreview={isPreview}
            sizeMode={sizeMode}
            onResize={handleResize}
          />
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Compare style and sizeMode
    const prevStyle = prevProps.data?.metadata?.style;
    const nextStyle = nextProps.data?.metadata?.style;
    const styleEqual = JSON.stringify(prevStyle) === JSON.stringify(nextStyle);

    const prevSizeMode = prevProps.data?.metadata?.sizeMode;
    const nextSizeMode = nextProps.data?.metadata?.sizeMode;
    const sizeModeEqual = prevSizeMode === nextSizeMode;

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
      styleEqual &&
      sizeModeEqual
    );
  },
);

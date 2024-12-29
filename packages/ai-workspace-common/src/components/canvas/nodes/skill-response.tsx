import { Position, useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import Moveable from 'react-moveable';
import classNames from 'classnames';
import { Divider, message } from 'antd';
import { CanvasNodeData, ResponseNodeMeta, CanvasNode, SkillResponseNodeProps } from './types';
import { Node } from '@xyflow/react';
import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import { CustomHandle } from './custom-handle';
import { LuChevronRight } from 'react-icons/lu';
import { useEdgeStyles } from '../constants';
import { getNodeCommonStyles } from './index';
import { ActionButtons } from './action-buttons';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { useInsertToDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-insert-to-document';
import { getRuntime } from '@refly-packages/ai-workspace-common/utils/env';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import { useAddToChatHistory } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-chat-history';
import {
  IconCanvas,
  IconError,
  IconLoading,
  IconSearch,
  IconToken,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { NodeItem, useContextPanelStoreShallow } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { getArtifactIcon } from '@refly-packages/ai-workspace-common/components/common/result-display';
import { useKnowledgeBaseStoreShallow } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useGetActionResult } from '@refly-packages/ai-workspace-common/queries';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { SelectedSkillHeader } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/selected-skill-header';
import { ModelProviderIcons } from '@refly-packages/ai-workspace-common/components/common/icon';
import { nodeActionEmitter } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { createNodeEventName, cleanupNodeEvents } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useActionResultStoreShallow } from '@refly-packages/ai-workspace-common/stores/action-result';
import { Source } from '@refly/openapi-schema';
import { useSetNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data';

type SkillResponseNode = Node<CanvasNodeData<ResponseNodeMeta>, 'skillResponse'>;

const POLLING_INTERVAL = 3000;
const POLLING_COOLDOWN_TIME = 5000;

// 抽离内容渲染组件
const NodeContent = memo(
  ({ content, sources, isOperating }: { content: string; sources: Source[]; isOperating: boolean }) => {
    return (
      <div className="skill-response-node-content">
        <Markdown
          content={String(content)}
          sources={sources}
          className={`text-xs ${
            isOperating ? 'pointer-events-auto skill-response-node-content' : 'pointer-events-none'
          }`}
        />
      </div>
    );
  },
);

// 抽离更多可复用的子组件并使用 memo
const NodeHeader = memo(({ query, skillName, skill }: { query: string; skillName: string; skill: any }) => {
  return (
    <>
      <div className="flex-shrink-0 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#F79009] shadow-[0px_2px_4px_-2px_rgba(16,24,60,0.06),0px_4px_8px_-2px_rgba(16,24,40,0.1)] flex items-center justify-center flex-shrink-0">
            <IconCanvas className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium leading-normal truncate cursor-help">{query}</span>
        </div>
      </div>
      {skillName && skillName !== 'commonQnA' && (
        <div className="flex-shrink-0 mb-2">
          <SelectedSkillHeader readonly skill={skill} className="rounded-sm" />
        </div>
      )}
    </>
  );
});

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
      <div className="flex-shrink-0 mt-2 flex justify-between items-center text-[10px] text-gray-400 relative z-20">
        <div className="flex items-center gap-1">
          {model && (
            <div className="flex items-center gap-1">
              <img className="w-3 h-3" src={ModelProviderIcons[modelInfo?.provider]} alt={modelInfo?.provider} />
              <span>{model}</span>
            </div>
          )}
          {model && tokenUsage ? <Divider type="vertical" className="mx-1" /> : null}
          {tokenUsage && (
            <div className="flex items-center gap-1">
              <IconToken className="w-3 h-3" />
              {tokenUsage.reduce((acc, t) => acc + t.inputTokens + t.outputTokens, 0)}
            </div>
          )}
        </div>
        <div>
          {time(createdAt, language as LOCALE)
            ?.utc()
            ?.fromNow()}
        </div>
      </div>
    );
  },
);

export const SkillResponseNode = memo(
  (props: SkillResponseNodeProps) => {
    const { data, selected, id, hideActions = false, isPreview = false, hideHandles = false, onNodeClick } = props;
    const [isHovered, setIsHovered] = useState(false);

    const { edges, operatingNodeId } = useCanvasStoreShallow((state) => ({
      edges: state.data[state.currentCanvasId]?.edges ?? [],
      operatingNodeId: state.operatingNodeId,
    }));

    const setNodeData = useSetNodeData();
    const { getNode } = useReactFlow();
    const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);

    const targetRef = useRef<HTMLDivElement>(null);
    const { t, i18n } = useTranslation();
    const language = i18n.languages?.[0];

    const { canvasId } = useCanvasContext();
    const { addContextItem } = useContextPanelStoreShallow((state) => ({
      addContextItem: state.addContextItem,
    }));

    const { title, contentPreview: content, metadata, createdAt, entityId } = data;
    const node = useMemo(() => getNode(props.id), [props.id, getNode]);
    const initialSize = useMemo(
      () => ({
        width: node?.measured?.width ?? 288,
        height: node?.measured?.height ?? ('auto' as const),
      }),
      [node?.measured?.width, node?.measured?.height],
    );

    const [size, setSize] = useState<{ width: number | 'auto'; height: number | 'auto' }>(initialSize);
    const moveableRef = useRef<Moveable>(null);

    const { status, artifacts, currentLog: log, modelInfo, structuredData, actionMeta, tokenUsage } = metadata ?? {};
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

    const [shouldPoll, setShouldPoll] = useState(false);

    useEffect(() => {
      const timer = setTimeout(() => {
        setShouldPoll(true);
      }, POLLING_COOLDOWN_TIME);

      return () => {
        clearTimeout(timer);
        setShouldPoll(false);
      };
    }, [data]);

    const statusShouldPoll = !status || status === 'executing' || status === 'waiting';

    const updateActionResult = useActionResultStoreShallow((state) => state.updateActionResult);

    const { data: result, error } = useGetActionResult({ query: { resultId: entityId } }, null, {
      enabled: Boolean(entityId) && statusShouldPoll && shouldPoll,
      refetchInterval: POLLING_INTERVAL,
    });

    useEffect(() => {
      if ((result && !result.success) || error) {
        setShouldPoll(false);
      }
    }, [result, error]);

    const remoteResult = result?.data;

    const skill = {
      name: actionMeta?.name || '',
      icon: actionMeta?.icon,
    };
    const skillName = actionMeta?.name;
    const model = modelInfo?.label;

    useEffect(() => {
      const remoteStatus = remoteResult?.status;
      const nodeStatus = data?.metadata?.status;

      if (shouldPoll && remoteStatus && (remoteStatus === 'finish' || remoteStatus === 'failed')) {
        let shouldUpdate = false;
        let newNodeData = { ...data };

        if (nodeStatus !== remoteStatus) {
          shouldUpdate = true;
          newNodeData.metadata = {
            ...data.metadata,
            status: remoteStatus,
          };
        }

        const remoteContent = remoteResult?.steps
          ?.map((s) => s.content)
          .filter(Boolean)
          .join('\n');

        if (remoteStatus === 'finish' && data?.contentPreview !== remoteContent) {
          shouldUpdate = true;
          newNodeData.contentPreview = remoteContent;
        }

        if (shouldUpdate) {
          setNodeData(id, newNodeData);
          updateActionResult(entityId, remoteResult);
        }
      }
    }, [shouldPoll, remoteResult, data]);

    // Get query and response content from result
    const query = title;

    // Check if node has any connections
    const isTargetConnected = edges?.some((edge) => edge.target === id);
    const isSourceConnected = edges?.some((edge) => edge.source === id);

    const edgeStyles = useEdgeStyles();

    // Handle node hover events
    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      onHoverStart();
    }, [onHoverStart]);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
      onHoverEnd();
    }, [onHoverEnd]);

    const handleAddToChatHistory = useAddToChatHistory(node as NodeItem);

    const { invokeAction } = useInvokeAction();

    const handleRerun = useCallback(() => {
      if (['executing', 'waiting'].includes(data?.metadata?.status)) {
        message.info(t('canvas.skillResponse.executing'));
        return;
      }

      message.info(t('canvas.skillResponse.startRerun'));

      // Disable polling temporarily after rerun
      setSize({ width: 288, height: 'auto' });
      setShouldPoll(false);
      setTimeout(() => setShouldPoll(true), POLLING_COOLDOWN_TIME);

      setNodeData(id, {
        ...data,
        contentPreview: '',
        metadata: {
          status: 'waiting',
        },
      });
      invokeAction({
        resultId: entityId,
        input: { query: title },
        target: { entityType: 'canvas', entityId: canvasId },
      });
    }, [data, entityId, invokeAction, setNodeData]);

    const insertToDoc = useInsertToDocument(data.entityId);
    const handleInsertToDoc = useCallback(async () => {
      await insertToDoc('insertBelow', data?.contentPreview);
    }, [insertToDoc, data.entityId, data]);

    const runtime = getRuntime();
    const isWeb = runtime === 'web';

    const handleDelete = useDeleteNode(
      {
        id,
        type: 'skillResponse',
        data,
        position: { x: 0, y: 0 },
      } as CanvasNode,
      'skillResponse',
    );

    const { debouncedCreateDocument } = useCreateDocument();

    const handleCreateDocument = useCallback(async () => {
      await debouncedCreateDocument(data?.title ?? t('common.newDocument'), content, {
        sourceNodeId: data.entityId,
        addToCanvas: true,
      });
    }, [content, debouncedCreateDocument, data.entityId, data?.title]);

    const handleAddToContext = useCallback(() => {
      handleAddToChatHistory();
      addContextItem(node as NodeItem);
    }, [node, handleAddToChatHistory, addContextItem]);

    const knowledgeBaseStore = useKnowledgeBaseStoreShallow((state) => ({
      updateSourceListDrawer: state.updateSourceListDrawer,
    }));

    const handleClickSources = useCallback(() => {
      knowledgeBaseStore.updateSourceListDrawer({
        visible: true,
        sources: sources,
        query: query,
      });
    }, [sources, query]);

    const isOperating = operatingNodeId === id;

    const resizeMoveable = useCallback((width: number, height: number) => {
      moveableRef.current?.request('resizable', { width, height });
    }, []);

    // Update size when content changes
    useEffect(() => {
      if (!targetRef.current) return;

      const { offsetWidth, offsetHeight } = targetRef.current;
      resizeMoveable(offsetWidth, offsetHeight);
    }, [content, artifacts?.length, sources.length]);

    // Update event handling
    useEffect(() => {
      // Create node-specific event handlers
      const handleNodeRerun = () => handleRerun();
      const handleNodeAddToContext = () => handleAddToContext();
      const handleNodeInsertToDoc = () => handleInsertToDoc();
      const handleNodeCreateDocument = () => handleCreateDocument();
      const handleNodeDelete = () => handleDelete();

      // Register events with node ID
      nodeActionEmitter.on(createNodeEventName(id, 'rerun'), handleNodeRerun);
      nodeActionEmitter.on(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
      nodeActionEmitter.on(createNodeEventName(id, 'insertToDoc'), handleNodeInsertToDoc);
      nodeActionEmitter.on(createNodeEventName(id, 'createDocument'), handleNodeCreateDocument);
      nodeActionEmitter.on(createNodeEventName(id, 'delete'), handleNodeDelete);

      return () => {
        // Cleanup events when component unmounts
        nodeActionEmitter.off(createNodeEventName(id, 'rerun'), handleNodeRerun);
        nodeActionEmitter.off(createNodeEventName(id, 'addToContext'), handleNodeAddToContext);
        nodeActionEmitter.off(createNodeEventName(id, 'insertToDoc'), handleNodeInsertToDoc);
        nodeActionEmitter.off(createNodeEventName(id, 'createDocument'), handleNodeCreateDocument);
        nodeActionEmitter.off(createNodeEventName(id, 'delete'), handleNodeDelete);

        // Clean up all node events
        cleanupNodeEvents(id);
      };
    }, [id, handleRerun, handleAddToContext, handleInsertToDoc, handleCreateDocument, handleDelete]);

    // 使用 useMemo 缓存计算值
    const nodeStyle = useMemo(
      () =>
        ({
          width: typeof size.width === 'number' ? `${size.width}px` : 'auto',
          height: typeof size.height === 'number' ? `${size.height}px` : 'auto',
          userSelect: isOperating ? 'text' : 'none',
          cursor: isOperating ? 'text' : 'grab',
        }) as const,
      [size.width, size.height, isOperating],
    );

    // 使用 useCallback 优化事件处理函数
    const handleResize = useCallback(({ target, width, height, direction }) => {
      const newWidth = Math.max(100, width);
      const newHeight = Math.max(80, height);

      setSize({ width: newWidth, height: newHeight });

      // Update target style directly
      if (target) {
        target.style.width = `${newWidth}px`;
        target.style.height = `${newHeight}px`;

        // Update position if needed
        if (direction[0] === -1) {
          target.style.left = `${target.offsetLeft - (newWidth - target.offsetWidth)}px`;
        }
        if (direction[1] === -1) {
          target.style.top = `${target.offsetTop - (newHeight - target.offsetHeight)}px`;
        }
      }
    }, []);

    return (
      <div className={classNames({ nowheel: isOperating })}>
        <div
          ref={targetRef}
          className="relative"
          style={nodeStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={onNodeClick}
        >
          {!isPreview && !hideActions && <ActionButtons type="skillResponse" nodeId={id} isNodeHovered={isHovered} />}

          <div className={`relative h-full flex flex-col ${getNodeCommonStyles({ selected, isHovered })}`}>
            {!isPreview && !hideHandles && (
              <>
                <CustomHandle
                  type="target"
                  position={Position.Left}
                  isConnected={isTargetConnected}
                  isNodeHovered={isHovered}
                  nodeType="response"
                />
                <CustomHandle
                  type="source"
                  position={Position.Right}
                  isConnected={isSourceConnected}
                  isNodeHovered={isHovered}
                  nodeType="response"
                />
              </>
            )}

            <div className="absolute bottom-0 left-0 right-0 h-[15%] bg-gradient-to-t from-white to-transparent pointer-events-none z-10" />

            <div className="flex flex-col h-full">
              <NodeHeader query={query} skillName={skillName} skill={skill} />

              <div className={`flex-grow overflow-y-auto pr-2 -mr-2`}>
                <div className="flex flex-col gap-3">
                  {status === 'failed' && (
                    <div
                      className="flex items-center justify-center gap-1 mt-1 hover:bg-gray-50 rounded-sm p-2 cursor-pointer"
                      onClick={() => handleRerun()}
                    >
                      <IconError className="h-4 w-4 text-red-500" />
                      <span className="text-xs text-red-500 max-w-48 truncate">
                        {t('canvas.skillResponse.executionFailed')}
                      </span>
                    </div>
                  )}

                  {(status === 'waiting' || status === 'executing') && !content && !artifacts?.length && (
                    <div className="flex items-center gap-2 bg-gray-100 rounded-sm p-2">
                      <IconLoading className="h-3 w-3 animate-spin text-green-500" />
                      <span className="text-xs text-gray-500 max-w-48 truncate">
                        {log ? (
                          <>
                            <span className="text-green-500 font-medium">{logTitle + ' '}</span>
                            <span className="text-gray-500">{logDescription}</span>
                          </>
                        ) : (
                          t('canvas.skillResponse.aiThinking')
                        )}
                      </span>
                    </div>
                  )}

                  {sources.length > 0 && (
                    <div
                      className="flex items-center justify-between gap-2 border-gray-100 border-solid rounded-sm p-2 hover:bg-gray-50 cursor-pointer"
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

                  {artifacts?.length > 0 && (
                    <div className="flex items-center gap-2">
                      {artifacts.map((artifact) => (
                        <div
                          key={artifact.entityId}
                          className="border border-solid border-gray-200 rounded-sm px-2 py-2 w-full flex items-center gap-1"
                        >
                          {getArtifactIcon(artifact, 'text-gray-500')}
                          <span className="text-xs text-gray-500 max-w-[200px] truncate inline-block">
                            {artifact.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {content && <NodeContent content={content} sources={sources} isOperating={isOperating} />}
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

        {!isPreview && selected && (
          <Moveable
            ref={moveableRef}
            target={targetRef}
            resizable={true}
            edge={false}
            throttleResize={1}
            renderDirections={['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se']}
            onResizeStart={({ setOrigin, dragStart }) => {
              setOrigin(['%', '%']);
              if (dragStart && dragStart instanceof MouseEvent) {
                dragStart.preventDefault();
              }
            }}
            onResize={handleResize}
            hideDefaultLines={true}
            className={`!pointer-events-auto ${!isHovered ? 'moveable-control-hidden' : 'moveable-control-show'}`}
          />
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // 自定义比较函数
    return (
      prevProps.id === nextProps.id &&
      prevProps.selected === nextProps.selected &&
      prevProps.isPreview === nextProps.isPreview &&
      prevProps.hideActions === nextProps.hideActions &&
      prevProps.hideHandles === nextProps.hideHandles &&
      prevProps.data.title === nextProps.data.title &&
      prevProps.data.contentPreview === nextProps.data.contentPreview &&
      prevProps.data.createdAt === nextProps.data.createdAt &&
      JSON.stringify(prevProps.data.metadata) === JSON.stringify(nextProps.data.metadata)
    );
  },
);

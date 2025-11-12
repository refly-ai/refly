import { EditChatInput } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/edit-chat-input';
import { ChatComposerRef } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-composer';
import { SourceListModal } from '@refly-packages/ai-workspace-common/components/source-list/source-list-modal';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { useFetchActionResult } from '@refly-packages/ai-workspace-common/hooks/canvas/use-fetch-action-result';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import {
  CanvasNode,
  convertResultContextToItems,
  purgeContextItems,
  ResponseNodeMeta,
} from '@refly/canvas-common';
import { ActionResult, GenericToolset } from '@refly/openapi-schema';
import { IContextItem } from '@refly/common-types';
import { useActionResultStoreShallow, useKnowledgeBaseStoreShallow } from '@refly/stores';
import { sortSteps } from '@refly/utils/step';
import { Button, Divider, Result, Segmented, Skeleton } from 'antd';
import { ModelSelector } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions/model-selector';
import { memo, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Thinking } from 'refly-icons';
import { ActionContainer } from './action-container';
import { ActionStepCard } from './action-step';
import { FailureNotice } from './failure-notice';
import { SkillResponseNodeHeader } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/skill-response-node-header';
import { ConfigInfoDisplay } from './config-info-display';

interface SkillResponseNodePreviewProps {
  node: CanvasNode<ResponseNodeMeta>;
  resultId: string;
  purePreview?: boolean;
}

const OUTPUT_STEP_NAMES = ['answerQuestion', 'generateDocument', 'generateCodeArtifact'];
const EMPTY_TOOLSET: GenericToolset = { id: 'empty', type: 'regular', name: 'empty' };

const SkillResponseNodePreviewComponent = ({
  node,
  resultId,
  purePreview,
}: SkillResponseNodePreviewProps) => {
  const { result, isStreaming, updateActionResult } = useActionResultStoreShallow((state) => ({
    result: state.resultMap[resultId],
    isStreaming: !!state.streamResults[resultId],
    updateActionResult: state.updateActionResult,
  }));
  const knowledgeBaseStore = useKnowledgeBaseStoreShallow((state) => ({
    sourceListDrawerVisible: state.sourceListDrawer.visible,
  }));

  const { setNodeData } = useNodeData();
  const { deleteNode } = useDeleteNode();
  const { fetchActionResult, loading: fetchActionResultLoading } = useFetchActionResult();

  const { canvasId, readonly } = useCanvasContext();
  const { invokeAction } = useInvokeAction({ source: 'skill-response-node-preview' });
  const { resetFailedState } = useActionPolling();

  const { t } = useTranslation();

  const nodeSelectedToolsets = node?.data?.metadata?.selectedToolsets;
  const [selectedToolsets, setSelectedToolsets] = useState<GenericToolset[]>(
    nodeSelectedToolsets?.length > 0 ? nodeSelectedToolsets : [EMPTY_TOOLSET],
  );

  const [editContextItems, setEditContextItems] = useState<IContextItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [, setDragCounter] = useState(0);
  const { handleUploadImage } = useUploadImage();
  const chatComposerRef = useRef<ChatComposerRef>(null);

  const shareId = node.data?.metadata?.shareId;
  const { data: shareData, loading: shareDataLoading } = useFetchShareData(shareId);
  const loading = fetchActionResultLoading || shareDataLoading;

  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    setSelectedToolsets(nodeSelectedToolsets?.length > 0 ? nodeSelectedToolsets : [EMPTY_TOOLSET]);
  }, [nodeSelectedToolsets]);

  useEffect(() => {
    if (shareData && !result && shareData?.resultId === resultId) {
      updateActionResult(resultId, shareData);
    }
  }, [shareData, result, resultId, updateActionResult]);

  useEffect(() => {
    // Do not fetch action result if streaming
    if (isStreaming) {
      return;
    }
    if (!!resultId && shareData?.resultId !== resultId) {
      // Always refresh in background to keep store up-to-date
      fetchActionResult(resultId, { silent: !!result, nodeToUpdate: node });
    }
  }, [resultId, shareId, isStreaming, shareData, node?.data?.metadata?.status]);

  const scrollToBottom = useCallback(
    (event: { resultId: string; payload: ActionResult }) => {
      if (event.resultId !== resultId || event.payload?.status !== 'executing') {
        return;
      }

      const container = document.body.querySelector('.preview-container');
      if (container) {
        const { scrollHeight, clientHeight } = container;
        container.scroll({
          behavior: 'smooth',
          top: scrollHeight - clientHeight + 50,
        });
      }
    },
    [resultId],
  );

  useEffect(() => {
    actionEmitter.on('updateResult', scrollToBottom);
    return () => {
      actionEmitter.off('updateResult', scrollToBottom);
    };
  }, [scrollToBottom]);

  const { data } = node;
  const { modelInfo, runtimeConfig } = data.metadata;
  const title = result?.title ?? data?.title;
  const actionMeta = result?.actionMeta ?? data?.metadata?.actionMeta;
  const version = result?.version ?? data?.metadata?.version ?? 0;
  // const modelInfo = result?.modelInfo ?? data?.metadata?.modelInfo;
  // const runtimeConfig = result?.runtimeConfig ?? data?.metadata?.runtimeConfig;
  const structuredData = data?.metadata?.structuredData;

  const [currentQuery, setCurrentQuery] = useState<string | null>(
    (structuredData?.query as string) ?? (result?.input?.query as string) ?? title,
  );
  const [activeTab, setActiveTab] = useState('configure');

  // Handle model selection
  const setModelInfo = useCallback(
    (modelInfo: any | null) => {
      const nextVersion = (node.data?.metadata?.version || 0) + 1;
      setNodeData(node.id, {
        metadata: {
          modelInfo: { ...modelInfo },
          version: nextVersion,
        },
      });
    },
    [node.data?.metadata?.version, setNodeData, node.id],
  );

  // Update currentQuery when node data changes, ensuring it's specific to this node
  useEffect(() => {
    const nodeSpecificQuery =
      (structuredData?.query as string) ?? (result?.input?.query as string) ?? title;
    setCurrentQuery(nodeSpecificQuery);
  }, [node.id, structuredData?.query, result?.input?.query, title]);

  const { steps = [], context, history = [] } = result ?? {};
  const contextItems = useMemo(() => {
    // Prefer contextItems from node metadata
    if (data?.metadata?.contextItems) {
      return purgeContextItems(data?.metadata?.contextItems);
    }

    // Fallback to contextItems from context (could be legacy nodes)
    return convertResultContextToItems(context ?? {}, history);
  }, [data?.metadata?.contextItems, context, history]);

  // Sync editContextItems with contextItems
  useEffect(() => {
    setEditContextItems(contextItems);
  }, [contextItems]);

  // Handle file drop
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setDragCounter(0);

      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        const resource = await handleUploadImage(file, canvasId);
        if (resource) {
          const newContextItem: IContextItem = {
            type: 'resource',
            entityId: resource.resourceId,
            title: resource.title,
            metadata: {
              resourceType: resource.resourceType,
              resourceMeta: resource.data,
              storageKey: resource.storageKey,
              rawFileKey: resource.rawFileKey,
              downloadURL: resource.downloadURL,
            },
          };
          setEditContextItems((prev) => [...prev, newContextItem]);
        }
      }
    },
    [handleUploadImage, canvasId],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const next = prev + 1;
      if (next === 1) {
        setIsDragging(true);
      }
      return next;
    });
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const next = prev - 1;
      if (next === 0) {
        setIsDragging(false);
      }
      return next;
    });
  }, []);

  const handleRemoveFile = useCallback((file: IContextItem) => {
    setEditContextItems((prev) => prev.filter((item) => item.entityId !== file.entityId));
  }, []);

  const handleAddToolsAndContext = useCallback(() => {
    chatComposerRef.current?.insertAtSymbol?.();
  }, []);

  useEffect(() => {
    const skillName = actionMeta?.name || 'commonQnA';
    if (result?.status !== 'executing' && result?.status !== 'waiting') return;

    const sortedSteps = sortSteps(steps);

    if (sortedSteps.length === 0) {
      setStatusText(
        t(`${skillName}.steps.analyzeQuery.description`, {
          ns: 'skill',
        }),
      );
      return;
    }

    const lastStep = sortedSteps[sortedSteps.length - 1];
    setStatusText(
      t(`${skillName}.steps.${lastStep.name}.description`, {
        ns: 'skill',
      }),
    );
  }, [result?.status, steps, t]);

  const handleDelete = useCallback(() => {
    deleteNode({
      id: node.id,
      type: 'skillResponse',
      data: node.data,
      position: node.position || { x: 0, y: 0 },
    });
  }, [node, deleteNode]);

  const handleRetry = useCallback(() => {
    // Reset failed state before retrying
    resetFailedState(resultId);

    // Update node status immediately to show "waiting" state
    const nextVersion = (node.data?.metadata?.version || 0) + 1;
    setNodeData(node.id, {
      ...node.data,
      metadata: {
        ...node.data?.metadata,
        status: 'waiting',
        version: nextVersion,
      },
    });

    invokeAction(
      {
        resultId,
        query: title,
        selectedSkill: {
          name: actionMeta?.name || 'commonQnA',
        },
        contextItems,
        selectedToolsets: nodeSelectedToolsets,
        version: nextVersion,
      },
      {
        entityId: canvasId,
        entityType: 'canvas',
      },
    );
  }, [resultId, title, canvasId, invokeAction, resetFailedState, setNodeData, node.id, node.data]);

  const outputStep = steps.find((step) => OUTPUT_STEP_NAMES.includes(step.name));

  return purePreview ? (
    !result && !loading ? (
      <div className="h-full w-full flex items-center justify-center">
        <Result
          status="404"
          subTitle={t('canvas.skillResponse.resultNotFound')}
          extra={<Button onClick={handleDelete}>{t('canvas.nodeActions.delete')}</Button>}
        />
      </div>
    ) : (
      <ActionStepCard
        result={result}
        step={outputStep}
        status={result?.status}
        query={currentQuery ?? title ?? ''}
      />
    )
  ) : (
    <div className="h-full w-full max-w-[1024px] mx-auto flex flex-col overflow-hidden">
      <SkillResponseNodeHeader
        nodeId={node.id}
        entityId={data.entityId}
        title={data.editedTitle ?? title}
        readonly={readonly}
        source="preview"
        className="!h-14"
      />

      <div className="flex-1 flex flex-col min-h-0 px-4">
        <div className="py-3">
          <Segmented
            options={[
              { label: 'Configure', value: 'configure' },
              { label: 'Last run', value: 'lastRun' },
            ]}
            value={activeTab}
            onChange={(value) => setActiveTab(value)}
            block
            shape="round"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeTab === 'configure' && (
            <div className="h-full flex flex-col gap-4">
              <div>
                <div
                  className="text-xs font-semibold leading-4 mb-2"
                  style={{ fontFamily: 'PingFang SC', letterSpacing: 0 }}
                >
                  Model
                </div>
                <ModelSelector
                  model={modelInfo ?? null}
                  setModel={setModelInfo}
                  size="medium"
                  briefMode={false}
                  variant="filled"
                  trigger={['click']}
                  contextItems={contextItems}
                />
              </div>

              <div>
                <div
                  className="text-xs font-semibold leading-4 mb-2 flex items-center justify-between"
                  style={{ fontFamily: 'PingFang SC', letterSpacing: 0 }}
                >
                  <span>指令</span>
                  <Button
                    type="text"
                    size="small"
                    className="text-xs h-auto px-2 py-1 text-refly-text-1 hover:text-refly-text-0"
                    onClick={handleAddToolsAndContext}
                  >
                    @ Add tools and context
                  </Button>
                </div>
                <div
                  className="rounded-lg pt-2 pb-3 px-3 relative"
                  style={{ backgroundColor: '#F6F6F6' }}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                >
                  {/* Drag overlay */}
                  {isDragging && (
                    <div
                      className="absolute inset-0 bg-refly-primary-default/10 border-2 border-refly-Card-Border rounded-lg flex items-center justify-center z-10"
                      style={{ backdropFilter: 'blur(20px)' }}
                    >
                      <div
                        className="text-sm font-semibold text-refly-primary-default text-center"
                        style={{
                          fontFamily: 'PingFang SC',
                          fontSize: '14px',
                          lineHeight: '20px',
                          letterSpacing: 0,
                        }}
                      >
                        在此处拖放文件
                      </div>
                    </div>
                  )}
                  <EditChatInput
                    ref={chatComposerRef}
                    enabled={true}
                    resultId={resultId}
                    version={version}
                    contextItems={editContextItems}
                    query={currentQuery}
                    actionMeta={actionMeta}
                    modelInfo={
                      modelInfo ?? {
                        name: '',
                        label: '',
                        provider: '',
                        contextLimit: 0,
                        maxOutput: 0,
                      }
                    }
                    setEditMode={() => {}}
                    runtimeConfig={runtimeConfig}
                    onQueryChange={setCurrentQuery}
                    selectedToolsets={selectedToolsets}
                    setSelectedToolsets={setSelectedToolsets}
                  />

                  <ConfigInfoDisplay
                    nodeId={node.id}
                    selectedToolsets={selectedToolsets}
                    contextItems={editContextItems}
                    onRemoveFile={handleRemoveFile}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'lastRun' && (
            <div className="h-full w-full flex flex-col">
              {!result && !loading ? (
                <div className="h-full w-full flex items-center justify-center">
                  <Result
                    status="404"
                    subTitle={t('canvas.skillResponse.resultNotFound')}
                    extra={<Button onClick={handleDelete}>{t('canvas.nodeActions.delete')}</Button>}
                  />
                </div>
              ) : (
                <div className="h-full w-full flex flex-col">
                  <div className="flex-1 overflow-auto preview-container transition-opacity duration-500">
                    {loading && !isStreaming && (
                      <Skeleton className="mt-1" active paragraph={{ rows: 5 }} />
                    )}
                    {(result?.status === 'executing' || result?.status === 'waiting') &&
                      !outputStep &&
                      statusText && (
                        <div className="flex flex-col gap-2 animate-pulse">
                          <Divider dashed className="my-2" />
                          <div className="m-2 flex items-center gap-1 text-gray-500">
                            <Thinking size={16} />
                            <span className="text-sm">{statusText}</span>
                          </div>
                        </div>
                      )}
                    {outputStep && (
                      <>
                        <Divider dashed className="my-2" />
                        <ActionStepCard
                          result={result}
                          step={outputStep}
                          status={result?.status}
                          query={currentQuery ?? title ?? ''}
                        />
                      </>
                    )}
                    {result?.status === 'failed' && !loading && (
                      <FailureNotice result={result} handleRetry={handleRetry} />
                    )}
                  </div>

                  {outputStep && result?.status === 'finish' && (
                    <ActionContainer
                      result={result}
                      step={outputStep}
                      nodeId={node.id}
                      initSelectedToolsets={
                        nodeSelectedToolsets?.length > 0 ? nodeSelectedToolsets : [EMPTY_TOOLSET]
                      }
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {knowledgeBaseStore?.sourceListDrawerVisible ? (
        <SourceListModal classNames="source-list-modal" />
      ) : null}
    </div>
  );
};

export const SkillResponseNodePreview = memo(SkillResponseNodePreviewComponent);

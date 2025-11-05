import { EditChatInput } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/edit-chat-input';
import { SourceListModal } from '@refly-packages/ai-workspace-common/components/source-list/source-list-modal';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { locateToNodePreviewEmitter } from '@refly-packages/ai-workspace-common/events/locateToNodePreview';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { useFetchActionResult } from '@refly-packages/ai-workspace-common/hooks/canvas/use-fetch-action-result';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { useFetchResources } from '@refly-packages/ai-workspace-common/hooks/use-fetch-resources';
import {
  CanvasNode,
  convertResultContextToItems,
  purgeContextItems,
  ResponseNodeMeta,
} from '@refly/canvas-common';
import { ActionResult, GenericToolset } from '@refly/openapi-schema';
import { useActionResultStoreShallow, useKnowledgeBaseStoreShallow } from '@refly/stores';
import { cn } from '@refly/utils/cn';
import { sortSteps } from '@refly/utils/step';
import { Button, Divider, Result, Skeleton } from 'antd';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Thinking } from 'refly-icons';
import { ActionContainer } from './action-container';
import { ActionStepCard } from './action-step';
import { FailureNotice } from './failure-notice';
import { PreviewChatInput } from './preview-chat-input';
import CrazySpinner from '@refly-packages/ai-workspace-common/components/editor/components/ui/icons/crazy-spinner';
import Magic from '@refly-packages/ai-workspace-common/components/editor/components/ui/icons/magic';

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
  const [editMode, setEditMode] = useState(false);

  const nodeSelectedToolsets = node?.data?.metadata?.selectedToolsets;
  const [selectedToolsets, setSelectedToolsets] = useState<GenericToolset[]>(
    nodeSelectedToolsets?.length > 0 ? nodeSelectedToolsets : [EMPTY_TOOLSET],
  );

  const shareId = node.data?.metadata?.shareId;
  const { data: shareData, loading: shareDataLoading } = useFetchShareData(shareId);
  const loading = fetchActionResultLoading || shareDataLoading;

  const [statusText, setStatusText] = useState('');

  // Track if the last SSE event had content
  const [lastEventHadContent, setLastEventHadContent] = useState(true);

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

  // Track content from SSE events
  useEffect(() => {
    const handleUpdateResult = (event: { resultId: string; payload: ActionResult }) => {
      if (event.resultId !== resultId) {
        return;
      }

      // Check if the latest step has content
      const latestSteps = event.payload?.steps || [];
      const outputStep = latestSteps.find((step) => OUTPUT_STEP_NAMES.includes(step.name));

      if (outputStep) {
        // If we have an output step, check if it has meaningful content
        const hasContent = !!outputStep.content && outputStep.content.trim().length > 0;
        setLastEventHadContent(hasContent);
      }
    };

    actionEmitter.on('updateResult', handleUpdateResult);
    return () => {
      actionEmitter.off('updateResult', handleUpdateResult);
    };
  }, [resultId]);

  const { data } = node;

  const title = result?.title ?? data?.title;
  const actionMeta = result?.actionMeta ?? data?.metadata?.actionMeta;
  const version = result?.version ?? data?.metadata?.version ?? 0;
  const modelInfo = result?.modelInfo ?? data?.metadata?.modelInfo;
  const runtimeConfig = result?.runtimeConfig ?? data?.metadata?.runtimeConfig;
  const structuredData = data?.metadata?.structuredData;

  const [currentQuery, setCurrentQuery] = useState<string | null>(
    (structuredData?.query as string) ?? (result?.input?.query as string) ?? title,
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

  useEffect(() => {
    const handleLocateToPreview = (event: { id: string; type?: 'editResponse' }) => {
      if (event.id === node.id && event.type === 'editResponse') {
        setEditMode(true);
      }
    };

    locateToNodePreviewEmitter.on('locateToNodePreview', handleLocateToPreview);

    return () => {
      locateToNodePreviewEmitter.off('locateToNodePreview', handleLocateToPreview);
    };
  }, [node.id]);

  const outputStep = steps.find((step) => OUTPUT_STEP_NAMES.includes(step.name));

  const { data: resources } = useFetchResources();

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
    <div
      className="flex flex-col gap-4 h-full w-full max-w-[1024px] mx-auto overflow-hidden"
      onClick={() => {
        if (editMode) {
          setEditMode(false);
        }
      }}
    >
      {
        <div className="px-4 pt-4">
          <EditChatInput
            enabled={editMode}
            resultId={resultId}
            version={version}
            contextItems={contextItems}
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
            setEditMode={setEditMode}
            runtimeConfig={runtimeConfig}
            onQueryChange={setCurrentQuery}
            selectedToolsets={selectedToolsets}
            setSelectedToolsets={setSelectedToolsets}
          />
          <PreviewChatInput
            enabled={!editMode}
            readonly={readonly}
            contextItems={contextItems}
            query={currentQuery}
            actionMeta={actionMeta}
            setEditMode={setEditMode}
            resources={resources}
          />
        </div>
      }

      <div className="flex-1 min-h-0 overflow-y-auto px-4">
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
            <div
              className={cn(
                'h-full overflow-auto preview-container transition-opacity duration-500',
                { 'opacity-30': editMode },
              )}
            >
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
                  {/* Show "AI is thinking" when last SSE event had no content and status is executing/waiting */}
                  {!lastEventHadContent &&
                  (result?.status === 'executing' || result?.status === 'waiting') ? (
                    <div className="flex items-center px-4 py-3 text-sm font-medium text-primary-600">
                      <Magic className="mr-2 w-4 h-4 shrink-0" />
                      {t('canvas.skillResponse.aiThinking', { defaultValue: 'AI is thinking' })}
                      <div className="mt-1 ml-2">
                        <CrazySpinner />
                      </div>
                    </div>
                  ) : (
                    <ActionStepCard
                      result={result}
                      step={outputStep}
                      status={result?.status}
                      query={currentQuery ?? title ?? ''}
                    />
                  )}
                </>
              )}
              {result?.status === 'failed' && !loading && (
                <FailureNotice result={result} handleRetry={handleRetry} />
              )}
            </div>
          </div>
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

      {knowledgeBaseStore?.sourceListDrawerVisible ? (
        <SourceListModal classNames="source-list-modal" />
      ) : null}
    </div>
  );
};

export const SkillResponseNodePreview = memo(SkillResponseNodePreviewComponent);

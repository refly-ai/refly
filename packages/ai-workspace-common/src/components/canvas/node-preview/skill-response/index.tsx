import { useEffect, useState, useMemo, memo, useCallback } from 'react';
import { Button, Divider, Result, Skeleton, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { useActionResultStoreShallow } from '@refly/stores';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { ActionResult, GenericToolset } from '@refly/openapi-schema';
import { CanvasNode, ResponseNodeMeta } from '@refly/canvas-common';
import { Thinking } from 'refly-icons';
import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { ActionStepCard } from './action-step';
import { convertResultContextToItems, purgeContextItems } from '@refly/canvas-common';
import { PreviewChatInput } from './preview-chat-input';
import { SourceListModal } from '@refly-packages/ai-workspace-common/components/source-list/source-list-modal';
import { useKnowledgeBaseStoreShallow } from '@refly/stores';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { EditChatInput } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/edit-chat-input';
import { cn } from '@refly/utils/cn';
import { useReactFlow } from '@xyflow/react';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { IconLoading } from '@refly-packages/ai-workspace-common/components/common/icon';
import { locateToNodePreviewEmitter } from '@refly-packages/ai-workspace-common/events/locateToNodePreview';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { processContentPreview } from '@refly-packages/ai-workspace-common/utils/content';
import { useUserStore } from '@refly/stores';
import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { sortSteps } from '@refly/utils/step';
import { ActionContainer } from './action-container';
import { FailureNotice } from './failure-notice';

interface SkillResponseNodePreviewProps {
  node: CanvasNode<ResponseNodeMeta>;
  resultId: string;
}

const OUTPUT_STEP_NAMES = ['answerQuestion', 'generateDocument', 'generateCodeArtifact'];

const SkillResponseNodePreviewComponent = ({ node, resultId }: SkillResponseNodePreviewProps) => {
  const { result, isStreaming, updateActionResult } = useActionResultStoreShallow((state) => ({
    result: state.resultMap[resultId],
    isStreaming: !!state.streamResults[resultId],
    updateActionResult: state.updateActionResult,
  }));
  const knowledgeBaseStore = useKnowledgeBaseStoreShallow((state) => ({
    sourceListDrawerVisible: state.sourceListDrawer.visible,
  }));

  const { getNodes } = useReactFlow();
  const { setNodeData } = useNodeData();
  const { deleteNode } = useDeleteNode();

  const { canvasId, readonly } = useCanvasContext();
  const { invokeAction } = useInvokeAction({ source: 'skill-response-node-preview' });
  const { resetFailedState } = useActionPolling();

  const { t } = useTranslation();
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(!result);

  const nodeSelectedToolsets = node?.data?.metadata?.selectedToolsets;
  const [selectedToolsets, setSelectedToolsets] = useState<GenericToolset[]>(
    nodeSelectedToolsets ?? [],
  );

  const shareId = node.data?.metadata?.shareId;
  const { data: shareData } = useFetchShareData(shareId);

  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    if (shareData && !result) {
      updateActionResult(resultId, shareData);
      setLoading(false);
    }
  }, [shareData, result, resultId, updateActionResult]);

  const fetchActionResult = async (resultId: string) => {
    const { isLogin } = useUserStore.getState();
    if (!isLogin) {
      return;
    }

    setLoading(true);
    const { data, error } = await getClient().getActionResult({
      query: { resultId },
    });
    setLoading(false);

    if (error || !data?.success) {
      return;
    }

    // Make sure the result has at least one step to prevent infinite loading
    const result = data.data;
    if (result.status === 'finish' && result.steps?.length === 0) {
      result.steps = [{ name: 'answerQuestion', content: '' }];
    }

    updateActionResult(resultId, result);

    const remoteResult = data.data;
    const node = getNodes().find((node) => node.data?.entityId === resultId);
    if (node && remoteResult) {
      setNodeData(node.id, {
        title: remoteResult.title,
        contentPreview: processContentPreview(remoteResult.steps?.map((s) => s?.content || '')),
        metadata: {
          status: remoteResult?.status,
          reasoningContent: processContentPreview(
            remoteResult.steps?.map((s) => s?.reasoningContent || ''),
          ),
        },
      });
    }
  };

  useEffect(() => {
    // Do not fetch action result if streaming
    if (isStreaming) {
      return;
    }
    if ((!result || (result.status === 'finish' && result.steps?.length === 0)) && !shareId) {
      fetchActionResult(resultId);
    } else if (result) {
      setLoading(false);
    }
  }, [resultId, result, shareId, isStreaming]);

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

  const title = result?.title ?? data?.title;
  const actionMeta = result?.actionMeta ?? data?.metadata?.actionMeta;
  const version = result?.version ?? data?.metadata?.version ?? 0;
  const modelInfo = result?.modelInfo ?? data?.metadata?.modelInfo;
  const tplConfig = result?.tplConfig ?? data?.metadata?.tplConfig;
  const runtimeConfig = result?.runtimeConfig ?? data?.metadata?.runtimeConfig;
  const structuredData = data?.metadata?.structuredData;

  const [currentQuery, setCurrentQuery] = useState<string | null>(
    (structuredData?.query as string) ?? (result?.input?.query as string) ?? title,
  );

  useEffect(() => {
    if (result?.input?.query) {
      setCurrentQuery((structuredData?.query as string) ?? (result?.input?.query as string));
    }
  }, [result?.input?.query, structuredData?.query]);

  const { steps = [], context, history = [] } = result ?? {};
  const contextItems = useMemo(() => {
    // Prefer contextItems from node metadata
    if (data?.metadata?.contextItems) {
      return purgeContextItems(data?.metadata?.contextItems);
    }

    // Fallback to contextItems from context (could be legacy nodes)
    return convertResultContextToItems(context ?? {}, history);
  }, [data, context, history]);

  useEffect(() => {
    const skillName = actionMeta?.name || 'commonQnA';
    if (result?.status !== 'executing' && result?.status !== 'waiting') return;
    setEditMode(false);

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
    setNodeData(node.id, {
      ...node.data,
      metadata: {
        ...node.data?.metadata,
        status: 'waiting',
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

  if (!result && !loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Result
          status="404"
          subTitle={t('canvas.skillResponse.resultNotFound')}
          extra={<Button onClick={handleDelete}>{t('canvas.nodeActions.delete')}</Button>}
        />
      </div>
    );
  }

  const outputStep = steps.find((step) => OUTPUT_STEP_NAMES.includes(step.name));

  return (
    <div
      className="flex flex-col gap-4 h-full max-w-[1024px] mx-auto overflow-hidden"
      onClick={() => {
        if (editMode) {
          setEditMode(false);
        }
      }}
    >
      {title && (
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
            tplConfig={tplConfig}
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
          />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4">
        <Spin
          spinning={!isStreaming && result?.status === 'executing'}
          indicator={<IconLoading className="animate-spin" />}
          size="large"
          tip={t('canvas.skillResponse.generating')}
          wrapperClassName="h-full w-full flex flex-col"
        >
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
                <ActionStepCard
                  result={result}
                  step={outputStep}
                  status={result?.status}
                  query={title}
                />
              </>
            )}
            {result?.status === 'failed' && (
              <FailureNotice result={result} handleRetry={handleRetry} />
            )}
          </div>
        </Spin>
      </div>

      {outputStep && <ActionContainer result={result} step={outputStep} nodeId={node.id} />}

      {knowledgeBaseStore?.sourceListDrawerVisible ? (
        <SourceListModal classNames="source-list-modal" />
      ) : null}
    </div>
  );
};

export const SkillResponseNodePreview = memo(
  SkillResponseNodePreviewComponent,
  (prevProps, nextProps) => {
    return prevProps.node.id === nextProps.node.id && prevProps.resultId === nextProps.resultId;
  },
);

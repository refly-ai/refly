import { useEffect, useState, useMemo, memo, useCallback } from 'react';
import { Button, Divider, message, Result, Skeleton, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { useActionResultStoreShallow } from '@refly-packages/ai-workspace-common/stores/action-result';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { ActionResult, ActionStep } from '@refly/openapi-schema';
import {
  CanvasNode,
  ResponseNodeMeta,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';

import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { ActionStepCard } from './action-step';
import {
  convertResultContextToItems,
  purgeContextItems,
} from '@refly-packages/ai-workspace-common/utils/map-context-items';

import { PreviewChatInput } from './preview-chat-input';
import { SourceListModal } from '@refly-packages/ai-workspace-common/components/source-list/source-list-modal';
import { useKnowledgeBaseStoreShallow } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { EditChatInput } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/edit-chat-input';
import { cn } from '@refly/utils/cn';
import { useReactFlow } from '@xyflow/react';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import {
  IconError,
  IconLoading,
  IconRerun,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { locateToNodePreviewEmitter } from '@refly-packages/ai-workspace-common/events/locateToNodePreview';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { processContentPreview } from '@refly-packages/ai-workspace-common/utils/content';
import { useUserStore } from '@refly-packages/ai-workspace-common/stores/user';
import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useSkillError } from '@refly-packages/ai-workspace-common/hooks/use-skill-error';

interface SkillResponseNodePreviewProps {
  node: CanvasNode<ResponseNodeMeta>;
  resultId: string;
}

const StepsList = memo(
  ({
    steps,
    result,
    title,
    nodeId,
  }: { steps: ActionStep[]; result: ActionResult; title: string; nodeId: string }) => {
    return (
      <>
        {steps.map((step, index) => (
          <div key={step.name}>
            <Divider className="my-2" />
            <ActionStepCard
              result={result}
              step={step}
              stepStatus={
                result?.status === 'executing' && index === steps?.length - 1
                  ? 'executing'
                  : 'finish'
              }
              index={index + 1}
              query={title}
              nodeId={nodeId}
            />
          </div>
        ))}
      </>
    );
  },
);

const SkillResponseNodePreviewComponent = ({ node, resultId }: SkillResponseNodePreviewProps) => {
  const { result, traceId, isStreaming, updateActionResult } = useActionResultStoreShallow(
    (state) => ({
      result: state.resultMap[resultId],
      traceId: state.traceIdMap[resultId],
      isStreaming: !!state.streamResults[resultId],
      updateActionResult: state.updateActionResult,
    }),
  );
  const knowledgeBaseStore = useKnowledgeBaseStoreShallow((state) => ({
    sourceListDrawerVisible: state.sourceListDrawer.visible,
  }));

  const { getNodes } = useReactFlow();
  const { setNodeData } = useNodeData();
  const { deleteNode } = useDeleteNode();

  const { canvasId, readonly } = useCanvasContext();
  const { invokeAction } = useInvokeAction();
  const { resetFailedState } = useActionPolling();

  const { t } = useTranslation();
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(!result);

  const shareId = node.data?.metadata?.shareId;
  const { data: shareData } = useFetchShareData(shareId);

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

    updateActionResult(resultId, data.data);

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
    if (!result && !shareId) {
      fetchActionResult(resultId);
    } else if (result) {
      setLoading(false);
    }
  }, [resultId, result, shareId]);

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

  const { errCode, errMsg, rawError } = useSkillError(result?.errors?.[0]);

  const { steps = [], context, history = [] } = result ?? {};
  const contextItems = useMemo(() => {
    // Prefer contextItems from node metadata
    if (data?.metadata?.contextItems) {
      return purgeContextItems(data?.metadata?.contextItems);
    }

    // Fallback to contextItems from context (could be legacy nodes)
    return convertResultContextToItems(context, history);
  }, [data, context, history]);

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
          name: actionMeta?.name || 'CommonQnA',
        },
        contextItems,
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

  const isPending = result?.status === 'executing' || result?.status === 'waiting' || loading;
  const errDescription = useMemo(() => {
    return `${errCode} ${errMsg} ${rawError ? `: ${String(rawError)}` : ''}`;
  }, [errCode, errMsg, rawError]);

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

  return (
    <div className="flex flex-col space-y-4 p-4 h-full max-w-[1024px] mx-auto">
      {title && (
        <>
          <EditChatInput
            enabled={editMode}
            resultId={resultId}
            version={version}
            contextItems={contextItems}
            query={title}
            actionMeta={actionMeta}
            modelInfo={modelInfo}
            setEditMode={setEditMode}
            tplConfig={tplConfig}
            runtimeConfig={runtimeConfig}
          />
          <PreviewChatInput
            enabled={!editMode}
            readonly={readonly}
            contextItems={contextItems}
            query={title}
            actionMeta={actionMeta}
            setEditMode={setEditMode}
          />
        </>
      )}

      <Spin
        spinning={!isStreaming && result?.status === 'executing'}
        indicator={<IconLoading className="animate-spin" />}
        size="large"
        tip={t('canvas.skillResponse.generating')}
      >
        <div
          className={cn('flex-grow transition-opacity duration-500', { 'opacity-30': editMode })}
          onClick={() => {
            if (editMode) {
              setEditMode(false);
            }
          }}
        >
          {steps.length === 0 && isPending && (
            <Skeleton className="mt-1" active paragraph={{ rows: 5 }} />
          )}
          <StepsList steps={steps} result={result} title={title} nodeId={node.id} />

          {result?.status === 'failed' && (
            <div className="mt-2 flex flex-col gap-2 border border-solid border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-md">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    <IconError className="flex items-center justify-center text-yellow-500 flex-shrink-0" />
                    {t('canvas.skillResponse.error.defaultTitle')}
                  </div>
                  {errCode && (
                    <div className="space-y-2">
                      <p className="text-gray-700 dark:text-gray-200 text-xs break-words">
                        {errDescription}
                      </p>
                      {traceId && (
                        <p className="text-gray-500 dark:text-gray-400 text-xs break-all">
                          Trace ID: {traceId}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="text"
                  size="small"
                  className="text-xs"
                  onClick={() => {
                    if (errCode) {
                      navigator.clipboard.writeText(`${errDescription}\nTrace ID: ${traceId}`);
                      message.success(t('components.markdown.copySuccess'));
                    }
                  }}
                >
                  {t('common.copyRequestInfo')}
                </Button>
                <Button
                  type="primary"
                  size="small"
                  className="text-xs"
                  icon={<IconRerun className="text-xs flex items-center justify-center" />}
                  onClick={handleRetry}
                >
                  {t('canvas.nodeActions.rerun')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Spin>

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

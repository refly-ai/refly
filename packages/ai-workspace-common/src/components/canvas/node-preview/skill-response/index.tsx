import { useEffect, useState, useMemo, memo, useCallback } from 'react';
import { Button, Divider, Result, Skeleton } from 'antd';
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
import { convertResultContextToItems } from '@refly-packages/ai-workspace-common/utils/map-context-items';

import { PreviewChatInput } from './preview-chat-input';
import { SourceListModal } from '@refly-packages/ai-workspace-common/components/source-list/source-list-modal';
import { useKnowledgeBaseStore } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { EditChatInput } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/edit-chat-input';
import { cn } from '@refly-packages/utils/cn';
import { useReactFlow } from '@xyflow/react';
import { usePatchNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-patch-node-data';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { IconRerun } from '@refly-packages/ai-workspace-common/components/common/icon';

import { locateToNodePreviewEmitter } from '@refly-packages/ai-workspace-common/events/locateToNodePreview';
import { getWholeParsedContent } from '@refly-packages/utils/content-parser';
interface SkillResponseNodePreviewProps {
  node: CanvasNode<ResponseNodeMeta>;
  resultId: string;
}

const StepsList = memo(
  ({ steps, result, title }: { steps: ActionStep[]; result: ActionResult; title: string }) => {
    return (
      <>
        {steps.map((step, index) => (
          <div key={step.name}>
            <Divider className="my-2" />
            <ActionStepCard
              result={result}
              step={step}
              stepStatus={
                result.status === 'executing' && index === steps?.length - 1
                  ? 'executing'
                  : 'finish'
              }
              index={index + 1}
              query={title}
            />
          </div>
        ))}
      </>
    );
  },
);

const SkillResponseNodePreviewComponent = ({ node, resultId }: SkillResponseNodePreviewProps) => {
  const { result, updateActionResult } = useActionResultStoreShallow((state) => ({
    result: state.resultMap[resultId],
    updateActionResult: state.updateActionResult,
  }));
  const knowledgeBaseStore = useKnowledgeBaseStore((state) => ({
    sourceListDrawerVisible: state.sourceListDrawer.visible,
  }));

  const { getNodes } = useReactFlow();
  const patchNodeData = usePatchNodeData();
  const { deleteNode } = useDeleteNode();

  const { canvasId } = useCanvasContext();
  const { invokeAction } = useInvokeAction();

  const { t } = useTranslation();
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchActionResult = async (resultId: string) => {
    setLoading(true);
    const { data, error } = await getClient().getActionResult({
      query: { resultId },
    });

    if (error || !data?.success) {
      return;
    }

    updateActionResult(resultId, data.data);
    setLoading(false);

    const remoteResult = data.data;
    const node = getNodes().find((node) => node.data?.entityId === resultId);
    if (node && remoteResult) {
      patchNodeData(node.id, {
        title: remoteResult.title,
        contentPreview: remoteResult.steps
          ?.map((s) => getWholeParsedContent(s?.reasoningContent, s?.content))
          .filter(Boolean)
          .join('\n'),
        metadata: {
          status: remoteResult.status,
        },
      });
    }
  };

  useEffect(() => {
    if (!result) {
      fetchActionResult(resultId);
    } else {
      setLoading(false);
    }
  }, [resultId, result]);

  const scrollToBottom = useCallback(
    (event: { resultId: string; payload: ActionResult }) => {
      if (event.resultId !== resultId || event.payload.status !== 'executing') {
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

  const { steps = [], context, history = [] } = result ?? {};
  const contextItems = useMemo(() => {
    // Prefer contextItems from node metadata
    if (data.metadata?.contextItems) {
      return data.metadata?.contextItems;
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
    invokeAction(
      {
        resultId,
        query: title,
      },
      {
        entityId: canvasId,
        entityType: 'canvas',
      },
    );
  }, [resultId, title, canvasId, invokeAction]);

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

  const isPending = result?.status === 'executing' || result?.status === 'waiting' || loading;

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
          />
          <PreviewChatInput
            enabled={!editMode}
            readonly
            contextItems={contextItems}
            query={title}
            actionMeta={actionMeta}
            setEditMode={setEditMode}
          />
        </>
      )}

      <div
        className={cn('h-full transition-opacity duration-500', { 'opacity-30': editMode })}
        onClick={() => {
          if (editMode) {
            setEditMode(false);
          }
        }}
      >
        {result?.status === 'failed' ? (
          <div className="h-full w-full flex items-center justify-center">
            <Result
              status="500"
              subTitle={t('canvas.skillResponse.executionFailed')}
              extra={
                <Button
                  icon={<IconRerun className="text-sm flex items-center justify-center" />}
                  onClick={handleRetry}
                >
                  {t('canvas.nodeActions.rerun')}
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {steps.length === 0 && isPending && (
              <Skeleton className="mt-1" active paragraph={{ rows: 5 }} />
            )}
            <StepsList steps={steps} result={result} title={title} />
          </>
        )}
      </div>

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

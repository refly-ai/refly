import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
import { useFetchActionResult } from '@refly-packages/ai-workspace-common/hooks/canvas/use-fetch-action-result';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { CanvasNode, convertResultContextToItems, ResponseNodeMeta } from '@refly/canvas-common';
import { ActionResult } from '@refly/openapi-schema';
import {
  useActionResultStoreShallow,
  useCanvasStoreShallow,
  type ResultActiveTab,
} from '@refly/stores';
import { sortSteps } from '@refly/utils/step';
import { Segmented, Button } from 'antd';
import { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import { SkillResponseNodeHeader } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/skill-response-node-header';
import { ConfigureTab } from './configure-tab';
import { LastRunTab } from './last-run-tab';
import { ActionStepCard } from './action-step';
import { Close, Play } from 'refly-icons';
import { useReactFlow } from '@xyflow/react';
import { processQueryWithMentions } from '@refly/utils/query-processor';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { ProductCard } from '@refly-packages/ai-workspace-common/components/markdown/plugins/tool-call/product-card';

interface SkillResponseNodePreviewProps {
  node: CanvasNode<ResponseNodeMeta>;
  resultId: string;
  purePreview?: boolean;
}

const OUTPUT_STEP_NAMES = ['answerQuestion', 'generateDocument', 'generateCodeArtifact'];

const SkillResponseNodePreviewComponent = ({
  node,
  resultId,
  purePreview,
}: SkillResponseNodePreviewProps) => {
  const {
    result,
    activeTab = 'configure',
    isStreaming,
    updateActionResult,
    setResultActiveTab,
    setCurrentFile,
    currentFile,
  } = useActionResultStoreShallow((state) => ({
    result: state.resultMap[resultId],
    activeTab: state.resultActiveTabMap[resultId],
    isStreaming: !!state.streamResults[resultId],
    updateActionResult: state.updateActionResult,
    setResultActiveTab: state.setResultActiveTab,
    setCurrentFile: state.setCurrentFile,
    currentFile: state.currentFile,
  }));
  const { setNodes } = useReactFlow();

  const { setNodeData } = useNodeData();
  const { fetchActionResult, loading: fetchActionResultLoading } = useFetchActionResult();

  const { canvasId, readonly } = useCanvasContext();
  const { invokeAction } = useInvokeAction({ source: 'skill-response-node-preview' });
  const { resetFailedState } = useActionPolling();

  const { t } = useTranslation();
  const { data: variables } = useVariablesManagement(canvasId);

  const shareId = node.data?.metadata?.shareId;
  const nodeStatus = node.data?.metadata?.status;
  const { data: shareData, loading: shareDataLoading } = useFetchShareData(shareId);
  const loading = fetchActionResultLoading || shareDataLoading;

  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    if (shareData && !result && shareData?.resultId === resultId) {
      updateActionResult(resultId, shareData);
    }
  }, [shareData, result, resultId, updateActionResult]);

  useEffect(() => {
    // Do not fetch action result if streaming
    if (isStreaming || nodeStatus === 'init') {
      return;
    }
    if (!!resultId && shareData?.resultId !== resultId) {
      // Always refresh in background to keep store up-to-date
      fetchActionResult(resultId, { silent: !!result, nodeToUpdate: node });
    }
  }, [resultId, shareId, isStreaming, shareData, nodeStatus]);

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

  const actionMeta = result?.actionMeta ?? data?.metadata?.actionMeta;
  const version = result?.version ?? data?.metadata?.version ?? 0;

  const title = data?.title ?? result?.title;
  const query = data?.metadata?.query ?? result?.input?.query;
  const modelInfo = data?.metadata?.modelInfo ?? result?.modelInfo;
  const contextItems =
    data?.metadata?.contextItems ?? convertResultContextToItems(result?.context, result?.history);
  const selectedToolsets = data?.metadata?.selectedToolsets ?? result?.toolsets;

  const { steps = [] } = result ?? {};

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

  const handleRetry = useCallback(() => {
    // Reset failed state before retrying
    resetFailedState(resultId);
    const { processedQuery } = processQueryWithMentions(query, {
      replaceVars: true,
      variables,
    });

    // Update node status immediately to show "waiting" state
    const nextVersion = (node.data?.metadata?.version || 0) + 1;
    setNodeData(node.id, {
      metadata: {
        status: 'waiting',
        version: nextVersion,
      },
    });

    invokeAction(
      {
        resultId,
        query: processedQuery,
        modelInfo,
        contextItems,
        selectedToolsets,
        version: nextVersion,
      },
      {
        entityId: canvasId,
        entityType: 'canvas',
      },
    );
  }, [
    resultId,
    query,
    modelInfo,
    contextItems,
    selectedToolsets,
    canvasId,
    invokeAction,
    resetFailedState,
    setNodeData,
    node.id,
    node.data,
  ]);

  const outputStep = steps.find((step) => OUTPUT_STEP_NAMES.includes(step.name));

  const handleClose = () => {
    setNodes((nodes) =>
      nodes.map((n) => ({
        ...n,
        selected: false,
      })),
    );
  };
  const { nodeExecutions } = useCanvasStoreShallow((state) => ({
    nodeExecutions: state.canvasNodeExecutions[canvasId] ?? [],
  }));

  const isExecuting = useMemo(() => {
    return nodeExecutions.some((execution) => ['executing', 'waiting'].includes(execution.status));
  }, [nodeExecutions]);

  const isRunning = useMemo(
    () => isExecuting || result?.status === 'executing' || result?.status === 'waiting',
    [isExecuting, result?.status],
  );

  useEffect(() => {
    setCurrentFile(null);
  }, [resultId]);

  useEffect(() => {
    if (result?.status === 'waiting') {
      setCurrentFile(null);
    }
  }, [result?.status]);

  const TitleActions = useMemo(() => {
    return (
      <>
        <Button type="text" icon={<Play size={20} />} onClick={handleRetry} disabled={isRunning} />
        <Button type="text" icon={<Close size={24} />} onClick={handleClose} />
      </>
    );
  }, [handleClose, handleRetry, isRunning]);

  return purePreview ? (
    !result && !loading ? (
      <div className="h-full w-full flex items-center justify-center">
        <img src={EmptyImage} alt="no content" className="w-[120px] h-[120px] -mb-4" />
      </div>
    ) : (
      <ActionStepCard
        result={result}
        step={outputStep}
        status={result?.status}
        query={query ?? title ?? ''}
      />
    )
  ) : (
    <div className="h-full w-full max-w-[1024px] mx-auto flex flex-col overflow-hidden">
      <SkillResponseNodeHeader
        nodeId={node.id}
        entityId={data.entityId}
        title={title}
        readonly={readonly}
        source="preview"
        className="!h-14"
        actions={TitleActions}
      />

      {currentFile ? (
        <ProductCard
          file={currentFile}
          classNames="w-full flex-1 overflow-y-auto"
          source="preview"
        />
      ) : (
        <div className="flex-1 flex flex-col min-h-0 px-4">
          <div className="py-3">
            <Segmented
              options={[
                { label: t('agent.configure'), value: 'configure' },
                { label: t('agent.lastRun'), value: 'lastRun' },
              ]}
              value={activeTab}
              onChange={(value) => setResultActiveTab(resultId, value as ResultActiveTab)}
              block
              size="small"
              shape="round"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {activeTab === 'configure' && (
              <ConfigureTab
                query={query}
                version={version}
                resultId={resultId}
                nodeId={node.id}
                canvasId={canvasId}
              />
            )}

            {activeTab === 'lastRun' && (
              <LastRunTab
                loading={loading}
                isStreaming={isStreaming}
                result={result}
                outputStep={outputStep}
                statusText={statusText}
                query={query}
                title={title}
                nodeId={node.id}
                selectedToolsets={selectedToolsets}
                handleRetry={handleRetry}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const SkillResponseNodePreview = memo(SkillResponseNodePreviewComponent);

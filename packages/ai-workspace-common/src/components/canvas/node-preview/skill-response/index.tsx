import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
import { useFetchActionResult } from '@refly-packages/ai-workspace-common/hooks/canvas/use-fetch-action-result';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { CanvasNode, convertResultContextToItems, ResponseNodeMeta } from '@refly/canvas-common';
import {
  useActionResultStoreShallow,
  type ResultActiveTab,
  useCanvasStoreShallow,
} from '@refly/stores';
import { Segmented, Button } from 'antd';
import { memo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import { SkillResponseNodeHeader } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/skill-response-node-header';
import { ConfigureTab } from './configure-tab';
import { LastRunTab } from './last-run-tab';
import { ActionStepCard } from './action-step';
import { Close } from 'refly-icons';
import { processQueryWithMentions } from '@refly/utils/query-processor';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { ProductCard } from '@refly-packages/ai-workspace-common/components/markdown/plugins/tool-call/product-card';
import { SkillResponseActions } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/skill-response-actions';
import { useSkillResponseActions } from '@refly-packages/ai-workspace-common/hooks/canvas/use-skill-response-actions';

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
  const { setNodePreview } = useCanvasStoreShallow((state) => ({
    setNodePreview: state.setNodePreview,
  }));

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

  const { data } = node;

  const version = result?.version ?? data?.metadata?.version ?? 0;

  const title = data?.title ?? result?.title;
  const query = data?.metadata?.query ?? result?.input?.query;
  const modelInfo = data?.metadata?.modelInfo ?? result?.modelInfo;
  const contextItems =
    data?.metadata?.contextItems ?? convertResultContextToItems(result?.context, result?.history);
  const selectedToolsets = data?.metadata?.selectedToolsets ?? result?.toolsets;

  const { steps = [] } = result ?? {};

  const handleRetry = useCallback(() => {
    // Reset failed state before retrying
    resetFailedState(resultId);
    const { llmInputQuery } = processQueryWithMentions(query, {
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
        title: title ?? query,
        nodeId: node.id,
        resultId,
        query: llmInputQuery,
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
    title,
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

  const handleClose = useCallback(() => {
    setNodePreview(canvasId, null);
  }, [canvasId, setNodePreview]);

  // Get node execution status
  const isExecuting = data.metadata?.status === 'executing' || data.metadata?.status === 'waiting';

  const { workflowIsRunning, handleStop } = useSkillResponseActions({
    nodeId: node.id,
    entityId: data.entityId,
    canvasId,
  });

  useEffect(() => {
    setCurrentFile(null);
  }, [resultId]);

  useEffect(() => {
    if (isExecuting) {
      setCurrentFile(null);
      setResultActiveTab(resultId, 'lastRun');
    }
  }, [isExecuting, resultId]);

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
    <div className="h-full w-full flex flex-col overflow-hidden">
      <SkillResponseNodeHeader
        nodeId={node.id}
        entityId={data.entityId}
        title={title}
        source="preview"
        className="!h-14"
        canEdit={!readonly}
        actions={
          <SkillResponseActions
            readonly={readonly}
            nodeIsExecuting={isExecuting}
            workflowIsRunning={workflowIsRunning}
            variant="preview"
            onRerun={handleRetry}
            onStop={handleStop}
            extraActions={<Button type="text" icon={<Close size={24} />} onClick={handleClose} />}
          />
        }
      />

      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className="py-3 px-4">
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

        <div className="flex-1 min-h-0 overflow-y-auto relative">
          <div
            className={activeTab === 'configure' ? 'h-full' : 'hidden'}
            style={{ display: activeTab === 'configure' ? 'block' : 'none' }}
          >
            <ConfigureTab
              readonly={readonly}
              query={query}
              version={version}
              resultId={resultId}
              nodeId={node.id}
              canvasId={canvasId}
              disabled={readonly || isExecuting}
            />
          </div>

          <div
            className={activeTab === 'lastRun' ? 'h-full' : 'hidden'}
            style={{ display: activeTab === 'lastRun' ? 'block' : 'none' }}
          >
            <LastRunTab
              loading={loading}
              isStreaming={isStreaming}
              resultId={resultId}
              result={result}
              outputStep={outputStep}
              query={query}
              title={title}
              nodeId={node.id}
              selectedToolsets={selectedToolsets}
              handleRetry={handleRetry}
            />
          </div>
        </div>

        {currentFile && (
          <div className="absolute inset-0 bg-refly-bg-content-z2 z-10">
            <ProductCard file={currentFile} classNames="w-full h-full" source="preview" />
          </div>
        )}
      </div>
    </div>
  );
};

export const SkillResponseNodePreview = memo(SkillResponseNodePreviewComponent);

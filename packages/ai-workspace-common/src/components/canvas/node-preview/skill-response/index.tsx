import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
import { useFetchActionResult } from '@refly-packages/ai-workspace-common/hooks/canvas/use-fetch-action-result';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import {
  CanvasNode,
  convertResultContextToItems,
  purgeContextItems,
  ResponseNodeMeta,
} from '@refly/canvas-common';
import { ActionResult, GenericToolset } from '@refly/openapi-schema';
import { IContextItem } from '@refly/common-types';
import { useActionResultStoreShallow, type ResultActiveTab } from '@refly/stores';
import { sortSteps } from '@refly/utils/step';
import { Segmented } from 'antd';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import { SkillResponseNodeHeader } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/skill-response-node-header';
import { ConfigureTab } from './configure-tab';
import { LastRunTab } from './last-run-tab';
import { ActionStepCard } from './action-step';

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
  } = useActionResultStoreShallow((state) => ({
    result: state.resultMap[resultId],
    activeTab: state.resultActiveTabMap[resultId],
    isStreaming: !!state.streamResults[resultId],
    updateActionResult: state.updateActionResult,
    setResultActiveTab: state.setResultActiveTab,
  }));

  const { setNodeData } = useNodeData();
  const { fetchActionResult, loading: fetchActionResultLoading } = useFetchActionResult();

  const { canvasId, readonly } = useCanvasContext();
  const { invokeAction } = useInvokeAction({ source: 'skill-response-node-preview' });
  const { resetFailedState } = useActionPolling();

  const { t } = useTranslation();

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

  const setQuery = useCallback(
    (query: string) => {
      setNodeData(node.id, {
        metadata: { query },
      });
    },
    [setNodeData, node.id],
  );

  const setModelInfo = useCallback(
    (modelInfo: any | null) => {
      setNodeData(node.id, {
        metadata: { modelInfo },
      });
    },
    [setNodeData, node.id],
  );

  const setSelectedToolsets = useCallback(
    (toolsets: GenericToolset[]) => {
      setNodeData(node.id, {
        metadata: { selectedToolsets: toolsets },
      });
    },
    [setNodeData, node.id],
  );

  const setContextItems = useCallback(
    (contextItems: IContextItem[]) => {
      setNodeData(node.id, {
        metadata: { contextItems: purgeContextItems(contextItems) },
      });
    },
    [setNodeData, node.id],
  );

  const { steps = [] } = result ?? {};

  const handleRemoveContextItem = useCallback(
    (item: IContextItem) => {
      if (!item?.entityId) {
        return;
      }

      const currentItems = contextItems ?? [];
      const nextItems = currentItems.filter(
        (contextItem) => contextItem.entityId !== item.entityId,
      );
      setContextItems(nextItems);
    },
    [contextItems, setContextItems],
  );

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
        query: title,
        selectedSkill: {
          name: actionMeta?.name || 'commonQnA',
        },
        contextItems,
        selectedToolsets,
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
      />

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
            shape="round"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeTab === 'configure' && (
            <ConfigureTab
              query={query}
              version={version}
              resultId={resultId}
              modelInfo={modelInfo}
              selectedToolsets={selectedToolsets}
              contextItems={contextItems}
              canvasId={canvasId}
              setModelInfo={setModelInfo}
              setSelectedToolsets={setSelectedToolsets}
              setContextItems={setContextItems}
              setQuery={setQuery}
              onRemoveContextItem={handleRemoveContextItem}
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
    </div>
  );
};

export const SkillResponseNodePreview = memo(SkillResponseNodePreviewComponent);

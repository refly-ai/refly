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
import { Segmented, Button, message } from 'antd';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.webp';
import { SkillResponseNodeHeader } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/skill-response-node-header';
import { ConfigureTab } from './configure-tab';
import { LastRunTab } from './last-run-tab';
import { ActionStepCard } from './action-step';
import { Close } from 'refly-icons';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { useQueryProcessor } from '@refly-packages/ai-workspace-common/hooks/use-query-processor';
import { ProductCard } from '@refly-packages/ai-workspace-common/components/markdown/plugins/tool-call/product-card';
import { LastRunTabContext } from '@refly-packages/ai-workspace-common/context/run-location';
import { SkillResponseActions } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/skill-response-actions';
import { useSkillResponseActions } from '@refly-packages/ai-workspace-common/hooks/canvas/use-skill-response-actions';
import { useVariableView } from '@refly-packages/ai-workspace-common/hooks/canvas/use-variable-view';
import { logEvent } from '@refly/telemetry-web';
import { useShareDataContext } from '@refly-packages/ai-workspace-common/context/use-share-data';
import { parseMentionsFromQuery } from '@refly/utils';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import type { DriveFile } from '@refly/openapi-schema';
import { useQueryClient } from '@tanstack/react-query';

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
  const queryClient = useQueryClient();
  const { data: variables = [] } = useVariablesManagement(canvasId);
  const { processQuery } = useQueryProcessor();
  const { handleVariableView } = useVariableView(canvasId);

  const shareId = node.data?.metadata?.shareId;
  const nodeStatus = node.data?.metadata?.status;

  // Determine whether to use shareData based on context provider
  // - true: explicitly use shareData (workflow app result preview)
  // - false: explicitly fetch from API (workflow execution products, canvas editing)
  // - undefined: default to false (fetch from API)
  const useShareDataFromContext = useShareDataContext();
  const shouldUseShareData = useShareDataFromContext ?? false;

  // Use refs to avoid stale closures in useEffect while preventing infinite loops
  const nodeRef = useRef(node);
  useEffect(() => {
    nodeRef.current = node;
  }, [node]);

  const resultRef = useRef(result);
  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  // Only fetch shareData when shouldUseShareData is true and shareId exists
  const { data: shareData, loading: shareDataLoading } = useFetchShareData(
    shouldUseShareData ? shareId : undefined,
  );
  const loading = fetchActionResultLoading || shareDataLoading;

  // Use shareData when explicitly enabled via context
  useEffect(() => {
    if (shouldUseShareData && shareData && shareData.resultId === resultId) {
      updateActionResult(resultId, shareData);
    }
  }, [shouldUseShareData, shareData, resultId, updateActionResult]);

  // Fetch action result when NOT using shareData
  useEffect(() => {
    // Skip if using shareData, streaming, or node is initializing
    if (shouldUseShareData || isStreaming || nodeStatus === 'init') {
      return;
    }
    if (resultId) {
      // Always refresh in background to keep store up-to-date
      fetchActionResult(resultId, { silent: !!resultRef.current, nodeToUpdate: nodeRef.current });
    }
  }, [resultId, shouldUseShareData, isStreaming, nodeStatus, fetchActionResult]);

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
    // Check for empty required file variables that are referenced in the current query
    // Extract variable references from the query using utility function
    const mentions = parseMentionsFromQuery(query || '');
    const referencedVariableIds = new Set<string>(
      mentions.filter((m) => m.type === 'var').map((m) => m.id),
    );

    // Find empty required file variables that are referenced in the query
    const emptyRequiredFileVar = variables.find(
      (v) =>
        referencedVariableIds.has(v.variableId) &&
        v.required &&
        v.variableType === 'resource' &&
        (!v.value || v.value.length === 0),
    );

    if (emptyRequiredFileVar) {
      message.warning(
        t('canvas.workflow.run.requiredFileInputsMissing') ||
          'This agent has required file inputs. Please upload the missing files before running.',
      );
      handleVariableView(emptyRequiredFileVar, { autoOpenEdit: true, showError: true });
      return;
    }

    // Reset failed state before retrying
    resetFailedState(resultId);
    const { llmInputQuery, referencedVariables } = processQuery(query, {
      replaceVars: true,
      variables,
    });

    // Update node status immediately to show "waiting" state
    const nextVersion =
      node.data?.metadata?.status === 'init' ? 0 : (node.data?.metadata?.version ?? 0) + 1;
    setNodeData(node.id, {
      metadata: {
        status: 'waiting',
        version: nextVersion,
      },
    });

    logEvent('run_agent_node', Date.now(), {
      canvasId,
      nodeId: node.id,
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
        workflowVariables: referencedVariables,
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
    variables,
    handleVariableView,
    t,
    processQuery,
  ]);

  const outputStep = steps.find((step) => OUTPUT_STEP_NAMES.includes(step.name));

  const handleClose = useCallback(() => {
    setNodePreview(canvasId, null);
  }, [canvasId, setNodePreview]);

  // Handle adding file to file library
  const handleAddToFileLibrary = useCallback(
    async (file: DriveFile) => {
      if (!canvasId || !file?.storageKey) {
        message.error(t('common.saveFailed') || 'Failed to add file to library');
        return;
      }

      try {
        const { data, error } = await getClient().createDriveFile({
          body: {
            canvasId,
            name: file.name ?? 'Untitled file',
            type: file.type ?? 'text/plain',
            storageKey: file.storageKey,
            source: 'manual',
            summary: file.summary,
          },
        });

        if (error || !data?.success) {
          throw new Error(error ? String(error) : 'Failed to create drive file');
        }

        // Refetch only file library queries (source: 'manual') to refresh the file list
        // Using refetchQueries instead of invalidateQueries to avoid clearing cache
        // This will trigger a refetch in FileOverview component without affecting other queries
        queryClient.refetchQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            // Check if this is a ListDriveFiles query
            if (queryKey[0] !== 'ListDriveFiles') {
              return false;
            }
            // Check if the query has source: 'manual'
            // Query key structure: ['ListDriveFiles', { query: { canvasId, source, ... } }]
            const queryOptions = queryKey[1] as
              | { query?: { source?: string; canvasId?: string } }
              | undefined;
            return (
              queryOptions?.query?.source === 'manual' && queryOptions?.query?.canvasId === canvasId
            );
          },
        });

        message.success(
          t('canvas.workflow.run.addToFileLibrarySuccess') || 'Successfully added to file',
        );
      } catch (err) {
        console.error('Failed to add file to library:', err);
        message.error(t('common.saveFailed') || 'Failed to add file to library');
        throw err;
      }
    },
    [canvasId, t, queryClient],
  );

  // Get node execution status
  const isExecuting = data.metadata?.status === 'executing' || data.metadata?.status === 'waiting';

  const { workflowIsRunning, handleStop } = useSkillResponseActions({
    nodeId: node.id,
    entityId: data.entityId,
    canvasId,
    query,
  });

  useEffect(() => {
    setCurrentFile(null);
  }, [resultId, setCurrentFile]);

  useEffect(() => {
    if (isExecuting) {
      setCurrentFile(null);
      setResultActiveTab(resultId, 'lastRun');
    }
  }, [isExecuting, resultId, setCurrentFile, setResultActiveTab]);

  // Memoize context value to prevent unnecessary re-renders
  const previewContextValue = useMemo(
    () => ({ location: 'agent' as const, setCurrentFile }),
    [setCurrentFile],
  );

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
        iconSize={20}
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
            nodeId={node.id}
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
              location="agent"
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
            <LastRunTabContext.Provider value={previewContextValue}>
              <ProductCard
                file={currentFile}
                classNames="w-full h-full"
                source="preview"
                onAddToFileLibrary={handleAddToFileLibrary}
              />
            </LastRunTabContext.Provider>
          </div>
        )}
      </div>
    </div>
  );
};

export const SkillResponseNodePreview = memo(SkillResponseNodePreviewComponent);

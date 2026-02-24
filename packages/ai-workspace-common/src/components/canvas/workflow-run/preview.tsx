import { Segmented, Skeleton, message } from 'antd';
import { memo, useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLazyCollapse } from '@refly-packages/ai-workspace-common/components/common/lazy-collapse';
import { WorkflowNodePanel } from './workflow-node-panel';
import { ProductCard } from '@refly-packages/ai-workspace-common/components/markdown/plugins/tool-call/product-card';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import type { DriveFile } from '@refly/openapi-schema';
import type { ResultActiveTab } from '@refly/stores';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import { useActionResultStoreShallow, useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useFetchActionResult } from '@refly-packages/ai-workspace-common/hooks/canvas/use-fetch-action-result';
import { CanvasNode, ResponseNodeMeta } from '@refly/canvas-common';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { LastRunTabContext } from '@refly-packages/ai-workspace-common/context/run-location';
import { WorkflowRunPreviewHeader } from './workflow-run-preview-header';
import { WorkflowRunForm } from './workflow-run-form';
import { WorkflowInputFormCollapse } from './workflow-input-form-collapse';
import { WorkflowVariable } from '@refly/openapi-schema';
import { logEvent } from '@refly/telemetry-web';
import {
  useGetCreditUsageByCanvasId,
  useGetWorkflowDetail,
  useListWorkflowExecutions,
  useListDriveFiles,
} from '@refly-packages/ai-workspace-common/queries/queries';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { useWorkflowIncompleteNodes } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useQueryClient } from '@tanstack/react-query';
import { ActionStatus } from '@refly/openapi-schema';
import type { WorkflowNodeExecution } from '@refly/openapi-schema';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
import { useQueryProcessor } from '@refly-packages/ai-workspace-common/hooks/use-query-processor';
import { parseMentionsFromQuery } from '@refly/utils';
import { convertResultContextToItems } from '@refly/canvas-common';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import './preview.scss';

const WorkflowRunPreviewComponent = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ResultActiveTab>('configure');
  // Track if LastRun tab has been rendered at least once (for lazy loading + keep mounted)
  const [hasRenderedLastRun, setHasRenderedLastRun] = useState(false);

  // Use lazy collapse hooks for managing panel rendering
  const agentNodesLazy = useLazyCollapse();
  const inputPanelsLazy = useLazyCollapse();
  const outputPanelsLazy = useLazyCollapse();
  const { markAsRendered: markAgentRendered } = agentNodesLazy;
  const { markAsRendered: markInputRendered } = inputPanelsLazy;
  const { markAsRendered: markOutputRendered } = outputPanelsLazy;
  const { canvasId, workflow } = useCanvasContext();
  const { nodes, edges } = useRealtimeCanvasData();
  const { resultMap, streamResults, currentFile, setCurrentFile } = useActionResultStoreShallow(
    (state) => ({
      resultMap: state.resultMap,
      streamResults: state.streamResults,
      currentFile: state.currentFile,
      setCurrentFile: state.setCurrentFile,
    }),
  );

  // Clear current file when opening the workflow run preview to ensure we show the input page
  useEffect(() => {
    setCurrentFile(null);
  }, [setCurrentFile]);

  // Track when LastRun tab is accessed for the first time (lazy loading)
  useEffect(() => {
    if (activeTab === 'lastRun' && !hasRenderedLastRun) {
      setHasRenderedLastRun(true);
    }
  }, [activeTab, hasRenderedLastRun]);
  const { fetchActionResult } = useFetchActionResult();
  const { setShowWorkflowRun, showWorkflowRun } = useCanvasResourcesPanelStoreShallow((state) => ({
    setShowWorkflowRun: state.setShowWorkflowRun,
    showWorkflowRun: state.showWorkflowRun,
  }));

  const {
    initializeWorkflow,
    isInitializing: loading,
    executionId,
    workflowStatus,
    isPolling,
    pollingError,
  } = workflow ?? {};

  const {
    data: workflowVariables,
    setVariables,
    isLoading: workflowVariablesLoading,
    refetch: refetchWorkflowVariables,
  } = useVariablesManagement(canvasId ?? '');

  const queryClient = useQueryClient();

  // Refresh workflow variables when switching to lastRun tab to show the latest execution input
  useEffect(() => {
    if (activeTab === 'lastRun' && refetchWorkflowVariables) {
      refetchWorkflowVariables();
    }
  }, [activeTab, refetchWorkflowVariables]);

  // Fetch latest workflow execution for this canvas when executionId is not available (e.g. after refresh)
  const { data: latestExecutionList } = useListWorkflowExecutions(
    {
      query: {
        canvasId: canvasId ?? '',
        order: 'creationDesc',
        pageSize: 1,
      },
    },
    undefined,
    {
      enabled: !executionId && !!canvasId && showWorkflowRun,
      refetchOnWindowFocus: false,
    },
  );

  const latestExecutionId = latestExecutionList?.data?.[0]?.executionId;
  const effectiveExecutionId = executionId ?? latestExecutionId ?? '';

  // Get workflow detail to sync node execution status
  const { data: workflowDetail, refetch: refetchWorkflowDetail } = useGetWorkflowDetail(
    {
      query: { executionId: effectiveExecutionId },
    },
    undefined,
    {
      enabled: !!effectiveExecutionId && showWorkflowRun,
      refetchOnWindowFocus: false,
    },
  );

  // Create a map of nodeId -> nodeExecution for quick lookup
  const nodeExecutionMap = useMemo(() => {
    const map = new Map<string, WorkflowNodeExecution>();
    if (workflowDetail?.data?.nodeExecutions) {
      for (const nodeExecution of workflowDetail.data.nodeExecutions) {
        if (nodeExecution.nodeId) {
          map.set(nodeExecution.nodeId, nodeExecution);
        }
      }
    }
    return map;
  }, [workflowDetail?.data?.nodeExecutions]);

  // Check if there are any incomplete nodes (status is 'init' or 'failed')
  const { hasIncompleteNodes } = useWorkflowIncompleteNodes();

  // Credit usage query with dynamic polling
  const { data: creditUsageData, isLoading: isCreditUsageLoading } = useGetCreditUsageByCanvasId(
    {
      query: { canvasId: canvasId ?? '' },
    },
    undefined,
    {
      enabled: showWorkflowRun && !!canvasId,
    },
  );

  // Refresh credit usage when workflow status changes to non-executing state
  useEffect(() => {
    if (
      showWorkflowRun &&
      canvasId &&
      queryClient &&
      executionId &&
      workflowStatus !== 'executing'
    ) {
      // Trigger refresh when workflowStatus is not executing
      queryClient.invalidateQueries({
        queryKey: ['getCreditUsageByCanvasId', { query: { canvasId } }],
      });
    }
  }, [workflowStatus, canvasId, showWorkflowRun, queryClient, executionId]);

  const [isRunning, setIsRunning] = useState(false);
  // State to track current time for real-time execution time updates
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time periodically when workflow is executing to show real-time execution time
  useEffect(() => {
    if (workflowStatus === 'executing' || isPolling) {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000); // Update every 1s for real-time execution time updates
      return () => clearInterval(interval);
    }
  }, [workflowStatus, isPolling]);

  const onSubmitVariables = useCallback(
    async (variables: WorkflowVariable[]) => {
      // Guard against missing canvasId
      if (!canvasId) {
        console.warn('Canvas ID is missing, cannot initialize workflow');
        return;
      }

      // Guard against missing initializeWorkflow
      if (!initializeWorkflow) {
        console.warn('Initialize workflow function is missing');
        return;
      }

      logEvent('run_workflow', null, {
        canvasId,
      });

      setVariables(variables);

      try {
        const success = await initializeWorkflow({
          canvasId,
          variables,
        });

        if (!success) {
          console.warn('Workflow initialization failed');
          // Reset running state on failure
          setIsRunning(false);
        } else {
          // Switch to Runlog tab after successful run
          setActiveTab('lastRun');
        }
      } catch (error) {
        console.error('Error initializing workflow:', error);
        // Reset running state on error
        setIsRunning(false);
      }
    },
    [canvasId, initializeWorkflow, setVariables],
  );

  // Helper function to format execution time duration
  const formatExecutionTime = useCallback(
    (startTime?: string, endTime?: string | number): string => {
      if (!startTime) {
        return '';
      }
      const start = new Date(startTime).getTime();
      const end =
        typeof endTime === 'number' ? endTime : endTime ? new Date(endTime).getTime() : Date.now();
      const ms = Math.max(0, end - start);
      const totalSeconds = Math.floor(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const remainSec = totalSeconds % 60;
      const mm = String(minutes).padStart(2, '0');
      const ss = String(remainSec).padStart(2, '0');
      return `${mm}:${ss}`;
    },
    [],
  );

  // Filter and sort skillResponse nodes by execution order (topological sort)
  // Show all nodes (including not executed ones)
  const skillResponseNodes = useMemo(() => {
    const filteredNodes = (nodes ?? [])
      .filter((node): node is CanvasNode<ResponseNodeMeta> => node?.type === 'skillResponse')
      .filter((node) => node?.data?.entityId); // Only include nodes with entityId

    if (filteredNodes.length === 0) {
      return [];
    }

    // Build parent-child relationships from edges
    const nodeMap = new Map(filteredNodes.map((n) => [n.id, n]));
    const parentMap = new Map<string, string[]>();
    const childMap = new Map<string, string[]>();

    // Initialize maps
    for (const node of filteredNodes) {
      parentMap.set(node.id, []);
      childMap.set(node.id, []);
    }

    // Build relationships from edges
    for (const edge of edges ?? []) {
      const sourceId = edge.source;
      const targetId = edge.target;

      if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
        // Add target as child of source
        const sourceChildren = childMap.get(sourceId) || [];
        sourceChildren.push(targetId);
        childMap.set(sourceId, sourceChildren);

        // Add source as parent of target
        const targetParents = parentMap.get(targetId) || [];
        targetParents.push(sourceId);
        parentMap.set(targetId, targetParents);
      }
    }

    // Topological sort: parents come before children
    const visited = new Set<string>();
    const result: CanvasNode<ResponseNodeMeta>[] = [];

    const visit = (node: CanvasNode<ResponseNodeMeta>) => {
      if (visited.has(node.id)) {
        return;
      }
      visited.add(node.id);

      // Visit parents first
      const parentIds = parentMap.get(node.id) || [];
      const parentNodes = parentIds
        .map((id) => nodeMap.get(id))
        .filter((n): n is CanvasNode<ResponseNodeMeta> => n !== undefined)
        .sort((a, b) => {
          // Sort by position y coordinate for consistent ordering when multiple parents
          const aY = a.position?.y ?? 0;
          const bY = b.position?.y ?? 0;
          return aY - bY;
        });

      for (const parentNode of parentNodes) {
        visit(parentNode);
      }

      result.push(node);
    };

    // Sort nodes by position y coordinate before processing
    // This ensures that when multiple nodes have no dependencies, they maintain their original order
    const sortedNodes = [...filteredNodes].sort((a, b) => {
      const aY = a.position?.y ?? 0;
      const bY = b.position?.y ?? 0;
      return aY - bY;
    });

    // Visit all nodes in sorted order
    for (const node of sortedNodes) {
      visit(node);
    }

    return result;
  }, [nodes, edges]);

  // Track in-flight fetch requests to prevent duplicate concurrent requests.
  // Only tracks requests while they're in progress; released on completion (success or failure).
  // This is needed because skillResponseNodes changes reference frequently (due to node data
  // updates, layout changes, etc.), causing this effect to re-fire repeatedly.
  const fetchingRef = useRef<Set<string>>(new Set());

  // Fetch action results for nodes that have been executed (not 'init' status)
  useEffect(() => {
    for (const node of skillResponseNodes) {
      const resultId = node.data?.entityId;
      const nodeStatus = node.data?.metadata?.status;

      // Skip nodes that haven't been executed yet - no action result exists on the backend
      if (!resultId || nodeStatus === 'init') {
        continue;
      }

      // Skip if already in store or a fetch is currently in-flight
      if (resultMap[resultId] || fetchingRef.current.has(resultId)) {
        continue;
      }

      fetchingRef.current.add(resultId);
      fetchActionResult(resultId, { silent: true, nodeToUpdate: node }).finally(() => {
        // Release on completion so that:
        // - On success: resultMap[resultId] becomes truthy, naturally preventing re-fetch
        // - On failure: allows retry on next effect trigger (e.g., status change, re-run)
        fetchingRef.current.delete(resultId);
      });
    }
  }, [skillResponseNodes, resultMap, fetchActionResult]);

  // Auto-expand executing nodes for streaming updates
  useEffect(() => {
    if (activeTab === 'lastRun' && hasRenderedLastRun) {
      for (const node of skillResponseNodes) {
        const resultId = node.data?.entityId;
        if (!resultId) continue;

        const nodeExecution = nodeExecutionMap.get(node.id);
        const result = resultMap[resultId];
        const metadataStatus = node.data?.metadata?.status as ActionStatus | 'init' | undefined;
        const nodeStatus = (
          metadataStatus === 'waiting' || metadataStatus === 'executing'
            ? metadataStatus
            : (nodeExecution?.status ?? result?.status ?? metadataStatus)
        ) as ActionStatus | 'init' | undefined;
        const isExecuting = nodeStatus === 'executing' || nodeStatus === 'waiting';
        const isNotExecuted = nodeStatus === 'init' || !nodeStatus;

        if (isExecuting) {
          markAgentRendered(node.id);
          markOutputRendered(node.id);
        } else if (isNotExecuted) {
          // Auto-expand input panel for not executed nodes
          markInputRendered(node.id);
        }
      }
    }
  }, [
    activeTab,
    hasRenderedLastRun,
    skillResponseNodes,
    nodeExecutionMap,
    resultMap,
    markAgentRendered,
    markInputRendered,
    markOutputRendered,
  ]);

  const handleClose = useCallback(() => {
    setShowWorkflowRun(false);
  }, [setShowWorkflowRun]);

  // Hooks for retry functionality
  const { invokeAction } = useInvokeAction({ source: 'workflow-run-preview' });
  const { resetFailedState } = useActionPolling();
  const { processQuery } = useQueryProcessor();
  const { setNodeData } = useNodeData();

  // Create retry handler for a specific node
  const createRetryHandler = useCallback(
    (node: CanvasNode<ResponseNodeMeta>, resultId: string) => {
      return () => {
        // Check for empty required file variables that are referenced in the current query
        const query = node.data?.metadata?.query ?? resultMap[resultId]?.input?.query ?? '';
        const mentions = parseMentionsFromQuery(query || '');
        const referencedVariableIds = new Set<string>(
          mentions.filter((m) => m.type === 'var').map((m) => m.id),
        );

        // Find empty required file variables that are referenced in the query
        const emptyRequiredFileVar = workflowVariables?.find(
          (v) =>
            referencedVariableIds.has(v.variableId) &&
            v.required &&
            v.variableType === 'resource' &&
            (!v.value || v.value.length === 0),
        );

        if (emptyRequiredFileVar) {
          message.warning(t('canvas.workflow.run.requiredFileInputsMissing'));
          return;
        }

        // Reset failed state before retrying
        resetFailedState(resultId);

        // Process query with variables
        const { llmInputQuery, referencedVariables } = processQuery(query, {
          replaceVars: true,
          variables: workflowVariables ?? [],
        });

        // Get node metadata
        const title = node.data?.title ?? resultMap[resultId]?.title;
        const modelInfo = node.data?.metadata?.modelInfo ?? resultMap[resultId]?.modelInfo;
        const contextItems =
          node.data?.metadata?.contextItems ??
          convertResultContextToItems(resultMap[resultId]?.context, resultMap[resultId]?.history);
        const selectedToolsets =
          node.data?.metadata?.selectedToolsets ?? resultMap[resultId]?.toolsets ?? [];

        // Calculate next version
        const currentVersion = resultMap[resultId]?.version ?? node.data?.metadata?.version ?? 0;
        const nextVersion = node.data?.metadata?.status === 'init' ? 0 : currentVersion + 1;

        // Update node status immediately to show "waiting" state
        setNodeData(node.id, {
          metadata: {
            status: 'waiting',
            version: nextVersion,
          },
        });

        logEvent('run_agent_node', Date.now(), {
          canvasId: canvasId ?? '',
          nodeId: node.id,
        });

        // Invoke action to retry
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
            entityId: canvasId ?? '',
            entityType: 'canvas',
          },
        );

        // Refetch workflow detail after a short delay to sync node execution status
        // This ensures the Preview panel shows the updated status after individual node retry
        setTimeout(() => {
          if (refetchWorkflowDetail) {
            refetchWorkflowDetail();
          }
        }, 1000);
      };
    },
    [canvasId, workflowVariables, resultMap, resetFailedState, setNodeData, invokeAction, t],
  );

  const [outputsOnly, setOutputsOnly] = useState(false);

  // Handler for toggling outputs only mode with telemetry
  const handleToggleOutputsOnly = useCallback(() => {
    const newOutputsOnly = !outputsOnly;
    setOutputsOnly(newOutputsOnly);

    // Track when user enables "only view result" mode
    if (newOutputsOnly) {
      logEvent('only_view_result', null, {
        canvasId: canvasId ?? '',
      });
    }
  }, [outputsOnly, canvasId]);

  // Fetch all agent-generated files from the canvas when outputsOnly is enabled
  const { data: driveFilesData, isLoading: isDriveFilesLoading } = useListDriveFiles(
    {
      query: {
        canvasId: canvasId ?? '',
        source: 'agent',
        scope: 'present',
        pageSize: 1000, // Large page size to get all files
      },
    },
    undefined,
    {
      enabled: outputsOnly && !!canvasId && showWorkflowRun,
      refetchOnWindowFocus: false,
    },
  );

  // Handle adding file to file library
  const handleAddToFileLibrary = useCallback(
    async (file: DriveFile, artifactLocation?: 'agent' | 'runlog') => {
      if (!canvasId || !file?.storageKey) {
        message.error(t('common.saveFailed'));
        return;
      }

      // Track when user saves artifact to file library
      logEvent('add_to_file', null, {
        canvasId,
        artifact_location: artifactLocation ?? 'runlog',
      });

      try {
        const { data, error } = await getClient().createDriveFile({
          body: {
            canvasId,
            name: file.name ?? t('common.untitled'),
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

        message.success(t('canvas.workflow.run.addToFileLibrarySuccess'));
      } catch (err) {
        console.error('Failed to add file to library:', err);
        message.error(t('common.saveFailed'));
        throw err;
      }
    },
    [canvasId, t, queryClient],
  );

  // Collect and sort product files by node execution order when outputsOnly is enabled
  const allProductFiles = useMemo(() => {
    if (!outputsOnly) {
      return [];
    }

    const driveFiles = driveFilesData?.data ?? [];
    if (driveFiles.length === 0) {
      return [];
    }

    // Create a set of resultIds from all nodes for quick lookup
    const resultIdSet = new Set<string>();
    for (const node of skillResponseNodes) {
      const resultId = node.data?.entityId;
      if (resultId) {
        resultIdSet.add(resultId);
      }
    }

    // Filter files that belong to any of the workflow nodes
    const workflowFiles = driveFiles.filter((file) => {
      if (!file?.resultId) {
        return false;
      }
      return resultIdSet.has(file.resultId);
    });

    // Create a map of resultId -> node index for sorting
    const resultIdToNodeIndex = new Map<string, number>();
    skillResponseNodes.forEach((node, index) => {
      const resultId = node.data?.entityId;
      if (resultId) {
        resultIdToNodeIndex.set(resultId, index);
      }
    });

    // Sort files by node execution order, then by creation time within each node
    const sortedFiles = workflowFiles.sort((a, b) => {
      const aNodeIndex = resultIdToNodeIndex.get(a.resultId ?? '') ?? Number.POSITIVE_INFINITY;
      const bNodeIndex = resultIdToNodeIndex.get(b.resultId ?? '') ?? Number.POSITIVE_INFINITY;

      // First sort by node execution order
      if (aNodeIndex !== bNodeIndex) {
        return aNodeIndex - bNodeIndex;
      }

      // Within the same node, sort by creation time (older first)
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });

    return sortedFiles;
  }, [outputsOnly, skillResponseNodes, driveFilesData?.data]);

  // Memoize context value to prevent unnecessary re-renders
  const previewContextValue = useMemo(
    () => ({ location: 'runlog' as const, setCurrentFile }),
    [setCurrentFile],
  );

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <WorkflowRunPreviewHeader
        onClose={handleClose}
        onToggleOutputsOnly={handleToggleOutputsOnly}
        outputsOnly={outputsOnly}
        showOutputsOnlyButton={activeTab === 'lastRun'}
      />

      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className="py-3 px-4">
          <Segmented
            options={[
              { label: t('agent.configure'), value: 'configure' },
              { label: t('agent.runlog'), value: 'lastRun' },
            ]}
            value={activeTab}
            onChange={(value) => setActiveTab(value as ResultActiveTab)}
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
            {workflowVariablesLoading ? (
              <div className="p-4">
                <Skeleton paragraph={{ rows: 10 }} active title={false} />
              </div>
            ) : (
              <WorkflowRunForm
                workflowVariables={workflowVariables ?? []}
                onSubmitVariables={onSubmitVariables}
                loading={loading ?? false}
                executionId={executionId}
                workflowStatus={workflowStatus}
                isPolling={isPolling}
                pollingError={pollingError}
                isRunning={isRunning}
                onRunningChange={setIsRunning}
                canvasId={canvasId}
                creditUsage={
                  isCreditUsageLoading || hasIncompleteNodes
                    ? null
                    : (creditUsageData?.data?.total ?? 0)
                }
              />
            )}
          </div>

          <div
            className={activeTab === 'lastRun' ? 'h-full overflow-y-auto' : 'hidden'}
            style={{ display: activeTab === 'lastRun' ? 'block' : 'none' }}
          >
            {/* Lazy loading: Only render LastRun content after first access, then keep it mounted */}
            {hasRenderedLastRun &&
              (outputsOnly ? (
                // Outputs only mode: Show only product cards
                <LastRunTabContext.Provider value={previewContextValue}>
                  <div className="flex flex-col gap-4 p-4">
                    {isDriveFilesLoading ? (
                      <Skeleton paragraph={{ rows: 6 }} active title={false} />
                    ) : allProductFiles.length === 0 ? (
                      <div className="flex items-center justify-center h-32 text-refly-text-2">
                        {t('canvas.workflow.run.noArtifacts')}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {allProductFiles.map((file) => (
                          <ProductCard
                            key={file.fileId}
                            file={file}
                            source="card"
                            onAddToFileLibrary={(file) => handleAddToFileLibrary(file, 'runlog')}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </LastRunTabContext.Provider>
              ) : (
                // Normal mode: Show user input + agent collapse components
                <div className="flex flex-col gap-2 px-4">
                  {/* User Input Section */}
                  {workflowVariables && workflowVariables.length > 0 && (
                    <WorkflowInputFormCollapse
                      key={`workflow-input-${workflowVariables.map((v) => `${v.variableId}-${JSON.stringify(v.value)}`).join('-')}`}
                      workflowVariables={workflowVariables}
                      canvasId={canvasId}
                      defaultActiveKey={[]}
                      readonly={true}
                    />
                  )}

                  {skillResponseNodes.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-refly-text-2">
                      {t('canvas.workflow.run.noNodes')}
                    </div>
                  ) : (
                    skillResponseNodes.map((node) => {
                      const resultId = node.data?.entityId;
                      if (!resultId) return null;
                      return (
                        <WorkflowNodePanel
                          key={node.id}
                          node={node}
                          resultId={resultId}
                          result={resultMap[resultId]}
                          nodeExecution={
                            nodeExecutionMap.get(node.id) as
                              | (WorkflowNodeExecution & {
                                  startTime?: string;
                                  endTime?: string;
                                })
                              | null
                          }
                          isStreaming={!!streamResults[resultId]}
                          currentTime={currentTime}
                          canvasId={canvasId ?? ''}
                          agentNodesLazy={agentNodesLazy}
                          inputPanelsLazy={inputPanelsLazy}
                          outputPanelsLazy={outputPanelsLazy}
                          createRetryHandler={createRetryHandler}
                          formatExecutionTime={formatExecutionTime}
                        />
                      );
                    })
                  )}
                </div>
              ))}
          </div>
        </div>

        {currentFile && (
          <div className="absolute inset-0 bg-refly-bg-content-z2 z-10">
            <LastRunTabContext.Provider value={previewContextValue}>
              <ProductCard
                file={currentFile}
                classNames="w-full h-full"
                source="preview"
                onAddToFileLibrary={(file) => handleAddToFileLibrary(file, 'runlog')}
              />
            </LastRunTabContext.Provider>
          </div>
        )}
      </div>
    </div>
  );
};

export const WorkflowRunPreview = memo(WorkflowRunPreviewComponent);

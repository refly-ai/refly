import { Segmented, Collapse, Skeleton, message } from 'antd';
import { memo, useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, CheckCircleBroken, AiChat, Cancelled, Subscription } from 'refly-icons';
import { ProductCard } from '@refly-packages/ai-workspace-common/components/markdown/plugins/tool-call/product-card';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import type { DriveFile } from '@refly/openapi-schema';
import type { ResultActiveTab } from '@refly/stores';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import { useActionResultStoreShallow, useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useFetchActionResult } from '@refly-packages/ai-workspace-common/hooks/canvas/use-fetch-action-result';
import { CanvasNode, ResponseNodeMeta } from '@refly/canvas-common';
import { LastRunTab } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/last-run-tab';
import { ConfigureTab } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/configure-tab';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { WorkflowRunPreviewHeader } from './workflow-run-preview-header';
import { WorkflowRunForm } from './workflow-run-form';
import { UserInputCollapse } from './user-input-collapse';
import { WorkflowVariable } from '@refly/openapi-schema';
import { logEvent } from '@refly/telemetry-web';
import {
  useGetCreditUsageByCanvasId,
  useGetWorkflowDetail,
  useListWorkflowExecutions,
  useGetCreditUsageByResultId,
  useListDriveFiles,
} from '@refly-packages/ai-workspace-common/queries/queries';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { useWorkflowIncompleteNodes } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useQueryClient } from '@tanstack/react-query';
import { IconLoading } from '@refly-packages/ai-workspace-common/components/common/icon';
import { ActionStatus } from '@refly/openapi-schema';
import type { WorkflowNodeExecution } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
import { useQueryProcessor } from '@refly-packages/ai-workspace-common/hooks/use-query-processor';
import { parseMentionsFromQuery } from '@refly/utils';
import { convertResultContextToItems } from '@refly/canvas-common';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import './preview.scss';

const OUTPUT_STEP_NAMES = ['answerQuestion', 'generateDocument', 'generateCodeArtifact'];

// Placeholder data
const PLACEHOLDER_DATA = {
  nodeId: 'placeholder-node-id',
  entityId: 'placeholder-entity-id',
  title: 'Placeholder Title',
  readonly: false,
  isExecuting: false,
  workflowIsRunning: false,
  currentFile: null,
};

// Component to display credit usage for a node
const NodeCreditUsage = memo(
  ({
    resultId,
    version,
    enabled,
  }: {
    resultId: string;
    version: number;
    enabled: boolean;
  }) => {
    const { data: creditData } = useGetCreditUsageByResultId(
      {
        query: {
          resultId,
          version: version.toString(),
        },
      },
      undefined,
      {
        enabled: enabled,
      },
    );
    const creditUsage = creditData?.data?.total ?? 0;

    return (
      <div className="flex items-center gap-1">
        <Subscription size={12} className="text-refly-text-2" />
        <span>{creditUsage}</span>
      </div>
    );
  },
);
NodeCreditUsage.displayName = 'NodeCreditUsage';

const WorkflowRunPreviewComponent = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ResultActiveTab>('configure');
  const { canvasId, workflow } = useCanvasContext();
  const { nodes, edges } = useRealtimeCanvasData();
  const { resultMap, streamResults } = useActionResultStoreShallow((state) => ({
    resultMap: state.resultMap,
    streamResults: state.streamResults,
  }));
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
  } = useVariablesManagement(canvasId ?? '');

  const queryClient = useQueryClient();

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
  const { data: workflowDetail } = useGetWorkflowDetail(
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

  // Fetch action results for all nodes
  useEffect(() => {
    for (const node of skillResponseNodes) {
      const resultId = node.data?.entityId;
      if (resultId && !resultMap[resultId]) {
        // Fetch result if not already in store
        fetchActionResult(resultId, { silent: true, nodeToUpdate: node });
      }
    }
  }, [skillResponseNodes, resultMap, fetchActionResult]);

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
          message.warning(
            t('canvas.workflow.run.requiredFileInputsMissing') ||
              'This agent has required file inputs. Please upload the missing files before running.',
          );
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
      };
    },
    [canvasId, workflowVariables, resultMap, resetFailedState, setNodeData, invokeAction, t],
  );

  const [outputsOnly, setOutputsOnly] = useState(false);

  // Fetch all agent-generated files from the canvas when outputsOnly is enabled
  const { data: driveFilesData } = useListDriveFiles(
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

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <WorkflowRunPreviewHeader
        onClose={handleClose}
        onToggleOutputsOnly={() => setOutputsOnly(!outputsOnly)}
        outputsOnly={outputsOnly}
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
            {outputsOnly ? (
              // Outputs only mode: Show only product cards
              <div className="flex flex-col gap-4 p-4">
                {allProductFiles.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-refly-text-2">
                    {t('canvas.workflow.run.noArtifacts') || 'No artifacts found'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {allProductFiles.map((file) => (
                      <ProductCard
                        key={file.fileId}
                        file={file}
                        source="card"
                        onAddToFileLibrary={handleAddToFileLibrary}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Normal mode: Show user input + agent collapse components
              <div className="flex flex-col gap-2 px-4">
                {/* User Input Section */}
                {workflowVariables && workflowVariables.length > 0 && (
                  <UserInputCollapse
                    workflowVariables={workflowVariables}
                    canvasId={canvasId}
                    defaultActiveKey={[]}
                    showToolsDependency={false}
                  />
                )}

                {skillResponseNodes.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-refly-text-2">
                    {t('canvas.workflow.run.noNodes') || 'No skill response nodes found'}
                  </div>
                ) : (
                  skillResponseNodes.map((node) => {
                    const resultId = node.data?.entityId;
                    if (!resultId) {
                      return null;
                    }

                    // Get node execution from workflow detail (prioritize this over canvas node metadata)
                    // Extend WorkflowNodeExecution with optional startTime/endTime for backward compatibility
                    const nodeExecution = nodeExecutionMap.get(node.id) as
                      | (WorkflowNodeExecution & {
                          startTime?: string;
                          endTime?: string;
                        })
                      | null;
                    const result = resultMap[resultId];
                    const isStreaming = !!streamResults[resultId];
                    const loading = !result && !isStreaming;

                    // Extract parameters for LastRunTab and ConfigureTab
                    const title = node.data?.title ?? result?.title ?? nodeExecution?.title;
                    const query = node.data?.metadata?.query ?? result?.input?.query ?? null;
                    const selectedToolsets =
                      node.data?.metadata?.selectedToolsets ?? result?.toolsets ?? [];
                    const steps = result?.steps ?? [];
                    const outputStep = steps.find((step) => OUTPUT_STEP_NAMES.includes(step.name));
                    const version = result?.version ?? node.data?.metadata?.version ?? 0;

                    // Get node execution status - prioritize nodeExecution status, then result status, then node metadata status
                    const nodeStatus = (nodeExecution?.status ??
                      result?.status ??
                      node.data?.metadata?.status) as ActionStatus | 'init' | undefined;
                    const isNotExecuted = nodeStatus === 'init' || !nodeStatus;
                    const isExecuting = nodeStatus === 'executing' || nodeStatus === 'waiting';
                    const isFinished = nodeStatus === 'finish';
                    const isFailed = nodeStatus === 'failed';

                    // Get error message from nodeExecution, result, or node metadata
                    const errorMessage =
                      nodeExecution?.errorMessage ??
                      result?.errors?.[0] ??
                      node.data?.metadata?.errors?.[0];

                    // Get execution time from nodeExecution
                    // Prefer startTime/endTime for execution duration, fallback to createdAt/updatedAt for backward compatibility
                    const executionTime = formatExecutionTime(
                      nodeExecution?.startTime ?? nodeExecution?.createdAt,
                      isExecuting
                        ? currentTime
                        : (nodeExecution?.endTime ?? nodeExecution?.updatedAt),
                    );

                    // Agent title
                    const agentTitle = title || 'Retrieve information and...';

                    // Get status icon based on node status (only for executed nodes)
                    const getStatusIcon = () => {
                      if (isNotExecuted) {
                        return null; // No icon for not executed nodes
                      }
                      if (isFinished) {
                        return <CheckCircleBroken size={16} color="#0E9F77" />;
                      }
                      if (isFailed) {
                        return <Cancelled size={16} color="#F04438" />;
                      }
                      if (isExecuting) {
                        return (
                          <IconLoading className="w-4 h-4 text-refly-primary-default animate-spin" />
                        );
                      }
                      return null;
                    };

                    // Build collapse items array for Input/Output sections
                    // - Not executed: Only input item (no output item)
                    // - Executed (running/finished/failed): Both input and output items
                    const collapseItems = [
                      {
                        key: 'input',
                        label: (
                          <div
                            className="flex items-center justify-between w-full"
                            style={{
                              padding: '10px 10px 10px 16px',
                              fontFamily: 'PingFang SC',
                              fontWeight: 500,
                              fontSize: '14px',
                              lineHeight: '1.7142857142857142em',
                              height: '34px',
                              borderRadius: '6px 6px 0px 0px',
                              backgroundColor: '#E6E8EA',
                              width: '100%',
                            }}
                          >
                            <span>Input</span>
                          </div>
                        ),
                        children: (
                          <div
                            className="bg-white"
                            style={{
                              padding: '8px 1px 12px',
                            }}
                          >
                            <ConfigureTab
                              readonly={true}
                              query={query}
                              version={version}
                              resultId={resultId}
                              nodeId={node.id}
                              canvasId={canvasId}
                              disabled={true}
                            />
                          </div>
                        ),
                      },
                      // Only add output item for executed nodes (running, finished, or failed)
                      // Not executed nodes will only have input item
                      ...(isNotExecuted
                        ? []
                        : [
                            {
                              key: 'output',
                              label: (
                                <div
                                  className="flex items-center justify-between w-full"
                                  style={{
                                    padding: '10px 16px',
                                    fontFamily: 'PingFang SC',
                                    fontWeight: 500,
                                    fontSize: '14px',
                                    lineHeight: '1.7142857142857142em',
                                    height: '34px',
                                    backgroundColor: '#E6E8EA',
                                    width: '100%',
                                  }}
                                >
                                  <span>Output</span>
                                </div>
                              ),
                              children: (
                                <div
                                  className="bg-white"
                                  style={{
                                    padding: '8px 1px 12px',
                                  }}
                                >
                                  {/* Show error message if execution failed */}
                                  {isFailed && errorMessage && (
                                    <div className="flex flex-col py-3 px-4 mb-2">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Cancelled size={16} color="#F04438" />
                                        <span className="text-sm font-semibold text-refly-func-danger-default">
                                          {t('canvas.workflow.run.executionFailed') ||
                                            'Execution Failed'}
                                        </span>
                                      </div>
                                      <div className="text-sm text-refly-text-1 bg-refly-Colorful-red-light rounded-lg p-3">
                                        {errorMessage}
                                      </div>
                                    </div>
                                  )}
                                  {/* Show result content for executed states (running, finished, failed) */}
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
                                    handleRetry={createRetryHandler(node, resultId)}
                                  />
                                </div>
                              ),
                            },
                          ]),
                    ];

                    return (
                      <div key={node.id} className="flex flex-col" style={{ gap: '8px' }}>
                        {/* Agent Node Collapse */}
                        <Collapse
                          defaultActiveKey={[]}
                          ghost
                          expandIcon={({ isActive }) => (
                            <ArrowDown
                              size={14}
                              className={`transition-transform ${isActive ? 'rotate-180' : ''}`}
                            />
                          )}
                          expandIconPosition="end"
                          className="agent-node-collapse [&_.ant-collapse-item]:!border-0 [&_.ant-collapse-header]:!bg-[#D9FFFE] [&_.ant-collapse-header]:!p-3 [&_.ant-collapse-header]:!rounded-lg [&_.ant-collapse-header]:!h-12 [&_.ant-collapse-content]:!bg-transparent [&_.ant-collapse-content]:!p-0 [&_.ant-collapse-content-box]:!p-0"
                          items={[
                            {
                              key: 'agent',
                              label: (
                                <div className="flex items-center justify-between w-full min-w-0">
                                  <div
                                    title={agentTitle}
                                    className="flex items-center flex-1 min-w-0"
                                    style={{ gap: '4px' }}
                                  >
                                    <AiChat size={20} className="flex-shrink-0" />
                                    <span
                                      className="text-[#1C1F23] truncate"
                                      style={{
                                        fontFamily: 'Inter',
                                        fontWeight: 500,
                                        fontSize: '14px',
                                        lineHeight: '1.5em',
                                        width: '180px',
                                      }}
                                    >
                                      {agentTitle}
                                    </span>
                                  </div>
                                  <div
                                    className="flex items-center flex-shrink-0"
                                    style={{ gap: '12px' }}
                                  >
                                    {/* Collapsed state: show different info based on status */}
                                    {/* 
                                    - Not executed: Only show node name (no time, no credit)
                                    - Running: Show node name + execution time (real-time updates)
                                    - Finished/Failed: Show node name + execution time + credit usage
                                    Note: Node name is always shown on the left side
                                  */}
                                    {isNotExecuted ? // Not executed: Only show node name (nothing else)
                                    null : (
                                      <div
                                        className="flex items-center"
                                        style={{
                                          gap: '2px',
                                          fontFamily: 'Inter',
                                          fontWeight: 400,
                                          fontSize: '10px',
                                          lineHeight: '1.4em',
                                          color: 'rgba(28, 31, 35, 0.35)',
                                        }}
                                      >
                                        {/* Running state: Show execution time */}
                                        {isExecuting && executionTime && (
                                          <span>{executionTime}</span>
                                        )}
                                        {/* Finished/Failed state: Show execution time + credit usage */}
                                        {(isFinished || isFailed) && (
                                          <>
                                            <NodeCreditUsage
                                              resultId={resultId}
                                              version={version}
                                              enabled={!!resultId && (isFinished || isFailed)}
                                            />
                                            {executionTime && <span>·</span>}
                                            {executionTime && <span>{executionTime}</span>}
                                          </>
                                        )}
                                      </div>
                                    )}
                                    {getStatusIcon()}
                                  </div>
                                </div>
                              ),
                              children: (
                                <>
                                  <div
                                    className="overflow-hidden bg-[#F6F6F6]"
                                    style={{
                                      borderWidth: '0.5px',
                                      borderColor: 'rgba(0, 0, 0, 0.14)',
                                      borderStyle: 'solid',
                                      borderRadius: '8px',
                                      marginTop: '10px',
                                      width: 'calc(100% - 8px)',
                                      marginLeft: 'auto',
                                      marginRight: 'auto',
                                    }}
                                  >
                                    <Collapse
                                      defaultActiveKey={
                                        isNotExecuted
                                          ? ['input'] // Not executed: Only show input area (expanded)
                                          : isExecuting
                                            ? ['output'] // Running: Input area (collapsed) + Output area (expanded with streaming)
                                            : [] // Finished/Failed: Input area (collapsed) + Output area (collapsed)
                                      }
                                      ghost
                                      expandIcon={({ isActive }) => (
                                        <ArrowDown
                                          size={14}
                                          className={`transition-transform ${isActive ? 'rotate-180' : ''}`}
                                        />
                                      )}
                                      expandIconPosition="end"
                                      className="workflow-run-preview-collapse"
                                      items={collapseItems}
                                    />
                                  </div>
                                </>
                              ),
                            },
                          ]}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {PLACEHOLDER_DATA.currentFile && (
          <div className="absolute inset-0 bg-refly-bg-content-z2 z-10">
            <ProductCard
              file={PLACEHOLDER_DATA.currentFile}
              classNames="w-full h-full"
              source="preview"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export const WorkflowRunPreview = memo(WorkflowRunPreviewComponent);

import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { useTranslation } from 'react-i18next';

import { CanvasNodeType, WorkflowNodeExecution } from '@refly/openapi-schema';
import { cn } from '@refly/utils/cn';
import { Empty, Skeleton } from 'antd';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { useState, useCallback, useEffect } from 'react';
import { ActionStepCard } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/action-step';
import { useActionResultStoreShallow } from '@refly/stores';
import { ReactFlowProvider } from '@xyflow/react';
import { CanvasProvider } from '@refly-packages/ai-workspace-common/context/canvas';
import { useFetchActionResult } from '@refly-packages/ai-workspace-common/hooks/canvas/use-fetch-action-result';

// Using a simple SVG icon instead of heroicons
const ChevronUpIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

// Custom hook to fetch ActionResult for a node execution
const useActionResult = (nodeExecution: WorkflowNodeExecution) => {
  const { result } = useActionResultStoreShallow((state) => ({
    result: nodeExecution.entityId ? state.resultMap[nodeExecution.entityId] : undefined,
  }));

  const { fetchActionResult, loading } = useFetchActionResult();

  useEffect(() => {
    if (
      nodeExecution.nodeType === 'skillResponse' &&
      nodeExecution.status === 'finish' &&
      nodeExecution.entityId &&
      !result
    ) {
      fetchActionResult(nodeExecution.entityId);
    }
  }, [
    nodeExecution.entityId,
    nodeExecution.nodeType,
    nodeExecution.status,
    result,
    fetchActionResult,
  ]);

  return { result, loading };
};

// Component to render node execution result with ActionStepCard
const NodeExecutionResult = ({ nodeExecution }: { nodeExecution: WorkflowNodeExecution }) => {
  const { t } = useTranslation();
  const { result, loading } = useActionResult(nodeExecution);

  // Only show result for skillResponse nodes that are finished
  if (
    nodeExecution.nodeType !== 'skillResponse' ||
    (nodeExecution.status !== 'finish' && nodeExecution.status !== 'failed')
  ) {
    return null;
  }

  if (loading) {
    return (
      <div className="p-3">
        <Skeleton active paragraph={{ rows: 3 }} />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-3 text-sm text-refly-text-2">
        {t('workflowApp.noResultData', 'No execution result available')}
      </div>
    );
  }

  // Find the output step (similar to SkillResponseNodePreview logic)
  const OUTPUT_STEP_NAMES = ['answerQuestion', 'generateDocument', 'generateCodeArtifact'];
  const outputStep = result.steps?.find((step) => OUTPUT_STEP_NAMES.includes(step.name));

  if (!outputStep) {
    return (
      <div className="p-3 text-sm text-refly-text-2">
        {t('workflowApp.noOutputStep', 'No output result found')}
      </div>
    );
  }

  return (
    <div className="p-3">
      {/* Provide necessary context providers for ActionStepCard */}
      {/* ReactFlowProvider: Required for useReactFlow hooks */}
      {/* CanvasProvider: Required for useCanvasContext in ActionStepCard */}
      <ReactFlowProvider>
        <CanvasProvider canvasId={nodeExecution.nodeId} readonly={true}>
          <ActionStepCard
            result={result}
            step={outputStep}
            status={result.status}
            query={nodeExecution.title || ''}
          />
        </CanvasProvider>
      </ReactFlowProvider>
    </div>
  );
};

export const WorkflowAppRunLogs = ({
  nodeExecutions,
}: { nodeExecutions: WorkflowNodeExecution[] }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.languages?.[0];
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const getStatusConfig = (nodeExecution: WorkflowNodeExecution) => {
    switch (nodeExecution.status) {
      case 'finish':
        return 'bg-refly-primary-light text-refly-primary-default';
      case 'failed':
        return 'bg-refly-Colorful-red-light text-refly-func-danger-default';
      case 'executing':
        return 'bg-refly-primary-light text-refly-primary-default';
      case 'waiting':
        return 'bg-refly-bg-control-z0 text-refly-text-2';
      default:
        return 'bg-refly-bg-control-z0 text-refly-text-2';
    }
  };

  const toggleExpanded = useCallback((nodeExecutionId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeExecutionId)) {
        newSet.delete(nodeExecutionId);
      } else {
        newSet.add(nodeExecutionId);
      }
      return newSet;
    });
  }, []);

  const isExpanded = useCallback(
    (nodeExecutionId: string) => {
      return expandedItems.has(nodeExecutionId);
    },
    [expandedItems],
  );

  return (
    <div className="w-full h-full flex flex-col gap-2">
      {nodeExecutions?.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center">
          <Empty description={t('workflowApp.emptyLogs')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <>
          {nodeExecutions?.map((nodeExecution) => {
            const expanded = isExpanded(nodeExecution.nodeExecutionId);

            return (
              <div
                key={nodeExecution.nodeExecutionId}
                className="w-full border-solid border-refly-Card-Border border-[1px] rounded-xl overflow-hidden bg-refly-bg-content-z2"
              >
                {/* Accordion Header */}
                <div
                  className="w-full px-3 py-2 flex items-center gap-3 justify-between hover:bg-refly-tertiary-hover cursor-pointer transition-colors duration-200"
                  onClick={() => toggleExpanded(nodeExecution.nodeExecutionId)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                    <NodeIcon small type={nodeExecution.nodeType as CanvasNodeType} />
                    <div className="min-w-0 flex-1 truncate font-semibold text-refly-text-0">
                      {nodeExecution.title}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div
                      className={cn(
                        'px-2 py-1 text-[10px] leading-[16px] font-semibold rounded-[4px]',
                        getStatusConfig(nodeExecution),
                      )}
                    >
                      {t(`canvas.workflow.run.nodeStatus.${nodeExecution.status}`, {
                        defaultValue: nodeExecution.status,
                      })}
                    </div>

                    <div className="text-[10px] leading-[16px] text-refly-text-2">
                      {time(nodeExecution.updatedAt, language as LOCALE)
                        ?.utc()
                        ?.fromNow()}
                    </div>

                    <ChevronUpIcon
                      className={cn(
                        'w-4 h-4 text-refly-text-2 transition-transform duration-200',
                        expanded ? 'rotate-180' : 'rotate-0',
                      )}
                    />
                  </div>
                </div>

                {/* Accordion Content */}
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-300 ease-in-out',
                    expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
                  )}
                >
                  <div className="border-t border-refly-Card-Border bg-refly-bg-content-z1">
                    {/* Show ActionStepCard for skillResponse nodes with results */}
                    <NodeExecutionResult nodeExecution={nodeExecution} />

                    {/* Show basic node execution details */}
                    <div className="px-3 pb-3">
                      <div className="pt-3 space-y-3">
                        {/* Error Information */}
                        {nodeExecution.status === 'failed' && (
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-refly-func-danger-default uppercase tracking-wide">
                              {t('workflowApp.error', 'Error')}
                            </div>
                            <div className="bg-refly-Colorful-red-light rounded-lg p-3">
                              <div className="text-xs text-refly-text-1 break-words">
                                {t('workflowApp.executionFailed', 'Node execution failed')}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Execution Status */}
                        {nodeExecution.status === 'waiting' ||
                          (nodeExecution.status === 'executing' && (
                            <div className="space-y-2">
                              <div className="text-xs font-semibold text-refly-text-1 uppercase tracking-wide">
                                {t('workflowApp.executionStatus', 'Execution Status')}
                              </div>
                              <div className="bg-refly-bg-control-z0 rounded-lg p-3 space-y-2">
                                <div className="flex items-start gap-2">
                                  <div className="text-xs font-medium text-refly-text-2 min-w-0 flex-shrink-0">
                                    {t('workflowApp.status', 'Status')}:
                                  </div>
                                  <div className="text-xs text-refly-text-1 break-words">
                                    {t(`canvas.workflow.run.nodeStatus.${nodeExecution.status}`, {
                                      defaultValue: nodeExecution.status,
                                    })}
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <div className="text-xs font-medium text-refly-text-2 min-w-0 flex-shrink-0">
                                    {t('workflowApp.createdAt', 'Created')}:
                                  </div>
                                  <div className="text-xs text-refly-text-1 break-words">
                                    {time(nodeExecution.createdAt, language as LOCALE)?.format(
                                      'YYYY-MM-DD HH:mm:ss',
                                    ) ?? '-'}
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <div className="text-xs font-medium text-refly-text-2 min-w-0 flex-shrink-0">
                                    {t('workflowApp.updatedAt', 'Updated')}:
                                  </div>
                                  <div className="text-xs text-refly-text-1 break-words">
                                    {time(nodeExecution.updatedAt, language as LOCALE)?.format(
                                      'YYYY-MM-DD HH:mm:ss',
                                    ) ?? '-'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* <EndMessage /> */}
        </>
      )}
    </div>
  );
};

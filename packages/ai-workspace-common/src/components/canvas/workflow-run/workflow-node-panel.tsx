import { Collapse } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, CheckCircleBroken, AiChat, Cancelled, Subscription } from 'refly-icons';
import { CanvasNode, ResponseNodeMeta } from '@refly/canvas-common';
import { LastRunTab } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/last-run-tab';
import { ConfigureTab } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/configure-tab';
import { IconLoading } from '@refly-packages/ai-workspace-common/components/common/icon';
import { ActionResult, ActionStatus } from '@refly/openapi-schema';
import type { WorkflowNodeExecution } from '@refly/openapi-schema';
import { useGetCreditUsageByResultId } from '@refly-packages/ai-workspace-common/queries/queries';
import { logEvent } from '@refly/telemetry-web';

const OUTPUT_STEP_NAMES = ['answerQuestion', 'generateDocument', 'generateCodeArtifact'];

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
      <div className="flex items-center gap-[2px]">
        <Subscription size={12} className="text-refly-text-2" color="rgba(28, 31, 35, 0.6)" />
        <span className="text-[rgba(28,31,35,0.6)]">{creditUsage}</span>
      </div>
    );
  },
);
NodeCreditUsage.displayName = 'NodeCreditUsage';

export interface LazyCollapseState {
  markAsRendered: (key: string | number) => void;
  shouldRender: (key: string | number) => boolean;
}

export interface WorkflowNodePanelProps {
  node: CanvasNode<ResponseNodeMeta>;
  resultId: string;
  result: ActionResult | undefined;
  nodeExecution:
    | (WorkflowNodeExecution & { startTime?: string; endTime?: string })
    | null
    | undefined;
  isStreaming: boolean;
  currentTime: number;
  canvasId: string;
  agentNodesLazy: LazyCollapseState;
  inputPanelsLazy: LazyCollapseState;
  outputPanelsLazy: LazyCollapseState;
  createRetryHandler: (node: CanvasNode<ResponseNodeMeta>, resultId: string) => () => void;
  formatExecutionTime: (startTime?: string, endTime?: string | number) => string;
}

export const WorkflowNodePanel = memo(
  ({
    node,
    resultId,
    result,
    nodeExecution,
    isStreaming,
    currentTime,
    canvasId,
    agentNodesLazy,
    inputPanelsLazy,
    outputPanelsLazy,
    createRetryHandler,
    formatExecutionTime,
  }: WorkflowNodePanelProps) => {
    const { t } = useTranslation();
    const loading = !result && !isStreaming;

    // Extract parameters for LastRunTab and ConfigureTab
    const title = node.data?.title ?? result?.title ?? nodeExecution?.title;
    const query = node.data?.metadata?.query ?? result?.input?.query ?? null;
    const selectedToolsets = node.data?.metadata?.selectedToolsets ?? result?.toolsets ?? [];
    const steps = result?.steps ?? [];
    const outputStep = steps.find((step) => OUTPUT_STEP_NAMES.includes(step.name));
    const version = result?.version ?? node.data?.metadata?.version ?? 0;

    // Get node execution status
    // When a node is retried, node.data.metadata.status is immediately set to 'waiting'/'executing'
    // but nodeExecution and result still hold the old 'failed' status until the API refreshes.
    // Prioritize the node metadata status when it indicates an active retry.
    const metadataStatus = node.data?.metadata?.status as ActionStatus | 'init' | undefined;
    const nodeStatus = (
      metadataStatus === 'waiting' || metadataStatus === 'executing'
        ? metadataStatus
        : (nodeExecution?.status ?? result?.status ?? metadataStatus)
    ) as ActionStatus | 'init' | undefined;
    const isNotExecuted = nodeStatus === 'init' || !nodeStatus;
    const isExecuting = nodeStatus === 'executing' || nodeStatus === 'waiting';
    const isFinished = nodeStatus === 'finish';
    const isFailed = nodeStatus === 'failed';

    // Get error message
    const errorMessage =
      nodeExecution?.errorMessage ?? result?.errors?.[0] ?? node.data?.metadata?.errors?.[0];

    // Get execution time
    const executionTime = formatExecutionTime(
      nodeExecution?.startTime ?? nodeExecution?.createdAt,
      isExecuting ? currentTime : (nodeExecution?.endTime ?? nodeExecution?.updatedAt),
    );

    const agentTitle = title || t('canvas.workflow.run.defaultAgentTitle');

    const getStatusIcon = () => {
      if (isNotExecuted) return null;
      if (isFinished) return <CheckCircleBroken size={16} color="#0E9F77" />;
      if (isFailed) return <Cancelled size={16} color="#F04438" />;
      if (isExecuting) {
        return <IconLoading className="w-4 h-4 text-refly-primary-default animate-spin" />;
      }
      return null;
    };

    // Build collapse items array for Input/Output sections
    const collapseItems = [
      {
        key: 'input',
        label: (
          <div className="flex items-center justify-between w-full py-[10px] pl-4 pr-[10px] font-medium text-sm leading-[1.7142857142857142em] h-[34px] rounded-t-[6px] bg-[#E6E8EA]">
            <span>{t('agent.configure')}</span>
          </div>
        ),
        children: inputPanelsLazy.shouldRender(node.id) ? (
          <div className="bg-white pt-2 px-[1px] pb-3">
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
        ) : null,
      },
      ...(isNotExecuted
        ? []
        : [
            {
              key: 'output',
              label: (
                <div className="flex items-center justify-between w-full py-[10px] px-4 font-medium text-sm leading-[1.7142857142857142em] h-[34px] bg-[#E6E8EA]">
                  <span>{t('agent.lastRun')}</span>
                </div>
              ),
              children: outputPanelsLazy.shouldRender(node.id) ? (
                <div className="bg-white pt-2 px-[1px] pb-3">
                  {/* Show error message if execution failed */}
                  {isFailed && errorMessage && (
                    <div className="flex flex-col py-3 px-4 mb-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Cancelled size={16} color="#F04438" />
                        <span className="text-sm font-semibold text-refly-func-danger-default">
                          {t('canvas.workflow.run.executionFailed')}
                        </span>
                      </div>
                      <div className="text-sm text-refly-text-1 bg-refly-Colorful-red-light rounded-lg p-3">
                        {errorMessage}
                      </div>
                    </div>
                  )}
                  {/* Show result content for executed states (running, finished, failed) */}
                  <LastRunTab
                    location="runlog"
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
              ) : null,
            },
          ]),
    ];

    return (
      <div className="flex flex-col gap-2">
        {/* Agent Node Collapse */}
        <Collapse
          defaultActiveKey={[]}
          ghost
          onChange={(activeKeys) => {
            if (Array.isArray(activeKeys) && activeKeys.includes('agent')) {
              agentNodesLazy.markAsRendered(node.id);
              if (canvasId) {
                logEvent('runlog_agent_expand', null, {
                  canvasId,
                  nodeId: node.id,
                  resultId,
                });
              }
            }
          }}
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
                  <div title={agentTitle} className="flex items-center flex-1 min-w-0 gap-1">
                    <AiChat size={20} className="flex-shrink-0" />
                    <span className="text-[#1C1F23] truncate font-inter font-medium text-sm leading-[1.5em] w-[180px]">
                      {agentTitle}
                    </span>
                  </div>
                  <div className="flex items-center flex-shrink-0 gap-3">
                    {isNotExecuted ? null : (
                      <div className="flex items-center gap-2 text-[10px] leading-[1.4em] font-normal">
                        {isExecuting && executionTime && (
                          <span className="text-[rgba(28,31,35,0.35)]">{executionTime}</span>
                        )}
                        {(isFinished || isFailed) && (
                          <>
                            <NodeCreditUsage
                              resultId={resultId}
                              version={version}
                              enabled={!!resultId && (isFinished || isFailed)}
                            />
                            {executionTime && (
                              <span className="text-[rgba(28,31,35,0.35)]">{executionTime}</span>
                            )}
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
                  {agentNodesLazy.shouldRender(node.id) && (
                    <div className="overflow-hidden bg-transparent border-[0.5px] border-solid border-[rgba(0,0,0,0.14)] rounded-lg mt-[10px] w-[calc(100%-8px)] mx-auto">
                      <Collapse
                        defaultActiveKey={isNotExecuted ? ['input'] : isExecuting ? ['output'] : []}
                        ghost
                        onChange={(activeKeys) => {
                          if (Array.isArray(activeKeys)) {
                            if (activeKeys.includes('input')) {
                              inputPanelsLazy.markAsRendered(node.id);
                            }
                            if (activeKeys.includes('output')) {
                              outputPanelsLazy.markAsRendered(node.id);
                              if (canvasId) {
                                logEvent('agent_output_select', null, {
                                  canvasId,
                                  nodeId: node.id,
                                  resultId,
                                });
                              }
                            }
                          }
                        }}
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
                  )}
                </>
              ),
            },
          ]}
        />
      </div>
    );
  },
);
WorkflowNodePanel.displayName = 'WorkflowNodePanel';

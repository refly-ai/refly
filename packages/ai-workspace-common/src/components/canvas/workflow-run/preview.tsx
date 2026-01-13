import { Segmented, Button, Collapse } from 'antd';
import { memo, useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SkillResponseNodeHeader } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/skill-response-node-header';
import { Close, ArrowDown, CheckCircleBroken, AiChat } from 'refly-icons';
import { SkillResponseActions } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/skill-response-actions';
import { ProductCard } from '@refly-packages/ai-workspace-common/components/markdown/plugins/tool-call/product-card';
import type { ResultActiveTab } from '@refly/stores';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import { useActionResultStoreShallow } from '@refly/stores';
import { useFetchActionResult } from '@refly-packages/ai-workspace-common/hooks/canvas/use-fetch-action-result';
import { CanvasNode, ResponseNodeMeta } from '@refly/canvas-common';
import { LastRunTab } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/last-run-tab';
import { ConfigureTab } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/configure-tab';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

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

const WorkflowRunPreviewComponent = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ResultActiveTab>('configure');
  const { canvasId, readonly } = useCanvasContext();
  const { nodes } = useRealtimeCanvasData();
  const { resultMap, streamResults } = useActionResultStoreShallow((state) => ({
    resultMap: state.resultMap,
    streamResults: state.streamResults,
  }));
  const { fetchActionResult } = useFetchActionResult();

  // Filter and sort skillResponse nodes
  const skillResponseNodes = useMemo(() => {
    return (nodes ?? [])
      .filter((node): node is CanvasNode<ResponseNodeMeta> => node?.type === 'skillResponse')
      .filter((node) => node?.data?.entityId) // Only include nodes with entityId
      .sort((a, b) => {
        // Sort by position (y coordinate) from top to bottom
        const aY = a.position?.y ?? 0;
        const bY = b.position?.y ?? 0;
        return aY - bY;
      });
  }, [nodes]);

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

  const handleClose = () => {
    // Placeholder: close handler
  };

  const handleRetry = () => {
    // Placeholder: retry handler
  };

  const handleStop = async () => {
    // Placeholder: stop handler
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <SkillResponseNodeHeader
        iconSize={20}
        nodeId={PLACEHOLDER_DATA.nodeId}
        entityId={PLACEHOLDER_DATA.entityId}
        title={PLACEHOLDER_DATA.title}
        source="preview"
        className="!h-14"
        canEdit={!PLACEHOLDER_DATA.readonly}
        actions={
          <SkillResponseActions
            readonly={PLACEHOLDER_DATA.readonly}
            nodeIsExecuting={PLACEHOLDER_DATA.isExecuting}
            workflowIsRunning={PLACEHOLDER_DATA.workflowIsRunning}
            variant="preview"
            onRerun={handleRetry}
            onStop={handleStop}
            nodeId={PLACEHOLDER_DATA.nodeId}
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
            {/* Configure tab content placeholder */}
          </div>

          <div
            className={activeTab === 'lastRun' ? 'h-full overflow-y-auto' : 'hidden'}
            style={{ display: activeTab === 'lastRun' ? 'block' : 'none' }}
          >
            <div className="flex flex-col gap-4 p-4">
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

                  const result = resultMap[resultId];
                  const isStreaming = !!streamResults[resultId];
                  const loading = !result && !isStreaming;

                  // Extract parameters for LastRunTab and ConfigureTab
                  const title = node.data?.title ?? result?.title;
                  const query = node.data?.metadata?.query ?? result?.input?.query ?? null;
                  const selectedToolsets =
                    node.data?.metadata?.selectedToolsets ?? result?.toolsets ?? [];
                  const steps = result?.steps ?? [];
                  const outputStep = steps.find((step) => OUTPUT_STEP_NAMES.includes(step.name));
                  const version = result?.version ?? node.data?.metadata?.version ?? 0;
                  const isExecuting =
                    node.data?.metadata?.status === 'executing' ||
                    node.data?.metadata?.status === 'waiting';

                  // Placeholder data for agent header
                  const agentTitle = title || 'Retrieve information and...';
                  const agentSubscribers = '743'; // Placeholder
                  const agentTime = '02:22'; // Placeholder

                  return (
                    <div key={node.id} className="flex flex-col" style={{ gap: '8px' }}>
                      {/* Agent Node Collapse */}
                      <Collapse
                        defaultActiveKey={['agent']}
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
                                    {/* Subscribe icon placeholder - using a simple SVG */}
                                    <svg
                                      width="12"
                                      height="12"
                                      viewBox="0 0 12 12"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                      style={{ flexShrink: 0 }}
                                    >
                                      <path
                                        d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z"
                                        fill="currentColor"
                                      />
                                    </svg>
                                    <span>{agentSubscribers}</span>
                                    <span>·</span>
                                    <span>{agentTime}</span>
                                  </div>
                                  <CheckCircleBroken size={16} color="#0E9F77" />
                                </div>
                              </div>
                            ),
                            children: (
                              <>
                                <style>
                                  {`
                                    .workflow-run-collapse .ant-collapse-item {
                                      border: none !important;
                                      margin-bottom: 0 !important;
                                    }
                                    .workflow-run-collapse .ant-collapse-item + .ant-collapse-item {
                                      margin-top: 2px !important;
                                    }
                                    .workflow-run-collapse .ant-collapse-item:first-child .ant-collapse-header {
                                      border-radius: 6px 6px 0px 0px !important;
                                    }
                                    .workflow-run-collapse .ant-collapse-header {
                                      background-color: #E6E8EA !important;
                                      height: 34px !important;
                                      min-height: 34px !important;
                                      padding: 0 !important;
                                      margin: 0 !important;
                                      color: #1C1F23 !important;
                                      font-weight: 500 !important;
                                      border-radius: 0 !important;
                                      border: none !important;
                                      display: flex !important;
                                      align-items: center !important;
                                    }
                                    .workflow-run-collapse .ant-collapse-expand-icon {
                                      padding-right: 10px !important;
                                      padding-left: 0 !important;
                                      display: flex !important;
                                      align-items: center !important;
                                      justify-content: center !important;
                                      height: 100% !important;
                                    }
                                    .workflow-run-collapse .ant-collapse-content {
                                      background-color: #FFFFFF !important;
                                      padding: 0 !important;
                                      border: none !important;
                                    }
                                    .workflow-run-collapse .ant-collapse-content-box {
                                      padding: 0 !important;
                                    }
                                  `}
                                </style>
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
                                    defaultActiveKey={['input', 'output']}
                                    ghost
                                    expandIcon={({ isActive }) => (
                                      <ArrowDown
                                        size={14}
                                        className={`transition-transform ${isActive ? 'rotate-180' : ''}`}
                                      />
                                    )}
                                    expandIconPosition="end"
                                    className="workflow-run-collapse"
                                    items={[
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
                                              readonly={readonly}
                                              query={query}
                                              version={version}
                                              resultId={resultId}
                                              nodeId={node.id}
                                              canvasId={canvasId}
                                              disabled={readonly || isExecuting}
                                            />
                                          </div>
                                        ),
                                      },
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
                                        ),
                                      },
                                    ]}
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

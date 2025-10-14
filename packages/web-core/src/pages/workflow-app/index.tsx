import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { message, Segmented, notification, Skeleton } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CanvasNodeType, WorkflowNodeExecution, WorkflowVariable } from '@refly/openapi-schema';
import { GithubStar } from '@refly-packages/ai-workspace-common/components/common/github-star';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { WorkflowAppProducts } from '@refly-packages/ai-workspace-common/components/workflow-app/products';
import { WorkflowAppRunLogs } from '@refly-packages/ai-workspace-common/components/workflow-app/run-logs';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { WorkflowRunForm } from '@refly-packages/ai-workspace-common/components/canvas/workflow-run/workflow-run-form';
import { useWorkflowExecutionPolling } from '@refly-packages/ai-workspace-common/hooks/use-workflow-execution-polling';
import { ReactFlowProvider } from '@refly-packages/ai-workspace-common/components/canvas';
import SettingModal from '@refly-packages/ai-workspace-common/components/settings';
import { useSiderStoreShallow, useCanvasOperationStoreShallow } from '@refly/stores';
import { ToolsDependencyChecker } from '@refly-packages/ai-workspace-common/components/canvas/tools-dependency';
import { CanvasProvider } from '@refly-packages/ai-workspace-common/context/canvas';
import { useIsLogin } from '@refly-packages/ai-workspace-common/hooks/use-is-login';
import { logEvent } from '@refly/telemetry-web';

const WorkflowAppPage: React.FC = () => {
  const { t } = useTranslation();
  const { shareId: routeShareId } = useParams();
  const navigate = useNavigate();
  const shareId = routeShareId ?? '';
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('runLogs');
  const [finalNodeExecutions, setFinalNodeExecutions] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Settings modal state
  const { showSettingModal, setShowSettingModal } = useSiderStoreShallow((state) => ({
    showSettingModal: state.showSettingModal,
    setShowSettingModal: state.setShowSettingModal,
  }));

  // Canvas operation state for duplicate functionality
  const { openDuplicateModal } = useCanvasOperationStoreShallow((state) => ({
    openDuplicateModal: state.openDuplicateModal,
  }));

  // Check user login status
  const { isLoggedRef } = useIsLogin();

  // Use shareId to directly access static JSON file
  const { data: workflowApp, loading: isLoading } = useFetchShareData(shareId);

  // Track enter_template_page event when page loads
  useEffect(() => {
    if (shareId) {
      logEvent('enter_template_page', null, { shareId });
    }
  }, [shareId]);

  const workflowVariables = useMemo(() => {
    return workflowApp?.variables ?? [];
  }, [workflowApp]);

  const { data: workflowDetail } = useWorkflowExecutionPolling({
    executionId,
    enabled: true,
    interval: 1000,

    onComplete: (status, data) => {
      // Save final nodeExecutions before clearing executionId
      if (data?.data?.nodeExecutions) {
        setFinalNodeExecutions(data.data.nodeExecutions);
      }

      // Clear executionId when workflow completes or fails
      setExecutionId(null);
      // Reset running state when workflow completes
      setIsRunning(false);

      if (status === 'finish') {
        notification.success({
          message: t('workflowApp.run.completed') || 'App run successfully',
        });
        // Auto switch to products tab when workflow completes successfully
        setActiveTab('products');
      } else if (status === 'failed') {
        notification.error({
          message: t('workflowApp.run.failed') || 'App run failed',
        });
      }
    },
    onError: (_error) => {
      // Clear executionId on error
      setExecutionId(null);
      // Reset running state on error
      setIsRunning(false);
      notification.error({
        message: t('workflowApp.run.error') || 'Run error',
      });
    },
  });

  const nodeExecutions = useMemo(() => {
    // Use current workflowDetail if available, otherwise use final cached results
    return workflowDetail?.nodeExecutions || finalNodeExecutions || [];
  }, [workflowDetail, finalNodeExecutions]);

  const products = useMemo(() => {
    return nodeExecutions
      .filter((nodeExecution: WorkflowNodeExecution) =>
        ['document', 'codeArtifact', 'image', 'video', 'audio'].includes(
          nodeExecution.nodeType as CanvasNodeType,
        ),
      )
      .filter((nodeExecution: WorkflowNodeExecution) => nodeExecution.status === 'finish');
  }, [nodeExecutions]);

  const logs = useMemo(() => {
    return nodeExecutions.filter((nodeExecution: WorkflowNodeExecution) =>
      ['skillResponse'].includes(nodeExecution.nodeType as CanvasNodeType),
    );
  }, [nodeExecutions]);

  const onSubmit = useCallback(
    async (variables: WorkflowVariable[]) => {
      logEvent('run_workflow_publish', Date.now(), {
        shareId,
      });
      // Check if user is logged in before executing workflow
      if (!isLoggedRef.current) {
        message.warning('Please login to run this workflow');
        // Redirect to login with return URL
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        navigate(`/?autoLogin=true&returnUrl=${returnUrl}`);
        return;
      }

      try {
        setIsRunning(true);

        const { data, error } = await getClient().executeWorkflowApp({
          body: {
            shareId: shareId,
            variables,
          },
        });

        if (error) {
          message.error(`executeWorkflowApp error: ${error}`);
          // Reset running state on error
          setIsRunning(false);
          return;
        }

        const newExecutionId = data?.data?.executionId ?? null;
        if (newExecutionId) {
          setExecutionId(newExecutionId);
          message.success('Workflow started');
          // Auto switch to runLogs tab when workflow starts
          setActiveTab('runLogs');
        } else {
          message.error('Failed to get execution ID');
          // Reset running state on failure
          setIsRunning(false);
        }
      } catch (error) {
        console.error('Error executing workflow app:', error);
        message.error('Failed to execute workflow');
        // Reset running state on error
        setIsRunning(false);
      }
    },
    [shareId, isLoggedRef, navigate],
  );

  const handleCopyWorkflow = useCallback(() => {
    logEvent('remix_workflow_publish', Date.now(), {
      shareId,
    });

    // Check if user is logged in before copying workflow
    if (!isLoggedRef.current) {
      message.warning('Please login to copy this workflow');
      // Redirect to login with return URL
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/?autoLogin=true&returnUrl=${returnUrl}`);
      return;
    }

    if (!shareId || !workflowApp?.title) {
      message.error(t('common.error'));
      return;
    }

    openDuplicateModal(workflowApp.canvasData?.canvasId || '', workflowApp.title, shareId);
  }, [
    shareId,
    workflowApp?.canvasData?.canvasId,
    workflowApp?.title,
    openDuplicateModal,
    t,
    isLoggedRef,
    navigate,
  ]);

  const handleCopyShareLink = useCallback(async () => {
    logEvent('duplicate_workflow_publish', Date.now(), {
      shareId,
      shareUrl: window.location.href,
    });
    try {
      // Copy current browser URL to clipboard
      await navigator.clipboard.writeText(window.location.href);
      message.success(t('canvas.workflow.run.shareLinkCopied') || 'Share link copied to clipboard');
    } catch (error) {
      console.error('Failed to copy share link:', error);
      message.error(t('canvas.workflow.run.shareLinkCopyFailed') || 'Failed to copy share link');
    }
  }, [t]);

  const segmentedOptions = useMemo(() => {
    return [
      {
        label: t('workflowApp.runLogs'),
        value: 'runLogs',
      },
      {
        label: t('workflowApp.products'),
        value: 'products',
      },
    ];
  }, [t]);

  return (
    <ReactFlowProvider>
      <CanvasProvider readonly={true} canvasId={workflowApp?.canvasData?.canvasId ?? ''}>
        <div className="min-h-screen bg-refly-bg-body-z0">
          {/* Header */}
          <div className="bg-refly-bg-float-z3 border-b border-refly-Card-Border">
            <div className="mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-3">
                  <Logo onClick={() => navigate?.('/')} />
                  <GithubStar />
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          {
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              {isLoading ? (
                <LoadingContent />
              ) : (
                <>
                  {/* Hero Section */}
                  <div className="text-center mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-refly-text-0">
                      {workflowApp?.title ?? ''}
                    </h1>
                    <p className="mt-3 sm:mt-4 text-base sm:text-lg text-refly-text-1 max-w-2xl mx-auto">
                      {workflowApp?.description ?? ''}
                    </p>
                  </div>

                  {/* Workflow Form */}
                  <div className="mb-6 sm:mb-8">
                    {
                      <WorkflowRunForm
                        workflowVariables={workflowVariables}
                        onSubmitVariables={onSubmit}
                        loading={isLoading}
                        onCopyWorkflow={handleCopyWorkflow}
                        onCopyShareLink={handleCopyShareLink}
                        isRunning={isRunning}
                        className="max-h-[500px] sm:max-h-[600px] bg-refly-bg-float-z3 rounded-lg border border-refly-Card-Border shadow-sm"
                      />
                    }
                  </div>

                  {/* Tools Dependency Form */}
                  {workflowApp?.canvasData && (
                    <div className="mb-6 sm:mb-8">
                      <ToolsDependencyChecker canvasData={workflowApp.canvasData} />
                    </div>
                  )}

                  {/* Tabs */}
                  <div className="mb-4 sm:mb-6 flex justify-center">
                    <Segmented
                      className="max-w-sm sm:max-w-md mx-auto"
                      shape="round"
                      options={segmentedOptions}
                      value={activeTab}
                      onChange={(value) => setActiveTab(value)}
                    />
                  </div>

                  {/* Content Area */}
                  <div className="bg-refly-bg-float-z3 rounded-lg border border-refly-Card-Border min-h-[200px]">
                    {activeTab === 'products' ? (
                      <WorkflowAppProducts products={products || []} />
                    ) : activeTab === 'runLogs' ? (
                      <WorkflowAppRunLogs nodeExecutions={logs || []} />
                    ) : null}
                  </div>
                </>
              )}
            </div>
          }
        </div>

        {/* Settings Modal */}
        <SettingModal visible={showSettingModal} setVisible={setShowSettingModal} />
      </CanvasProvider>
    </ReactFlowProvider>
  );
};

export default memo(WorkflowAppPage);

const LoadingContent = () => {
  return (
    <div className="p-4">
      <Skeleton paragraph={{ rows: 8 }} active title={false} />
    </div>
  );
};

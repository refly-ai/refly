import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { message, Segmented, notification, Skeleton } from 'antd';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CanvasNodeType, WorkflowNodeExecution, WorkflowVariable } from '@refly/openapi-schema';
import { GithubStar } from '@refly-packages/ai-workspace-common/components/common/github-star';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { WorkflowAppProducts } from '@refly-packages/ai-workspace-common/components/workflow-app/products';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { WorkflowRunForm } from '@refly-packages/ai-workspace-common/components/canvas/workflow-run/workflow-run-form';
import { useWorkflowExecutionPolling } from '@refly-packages/ai-workspace-common/hooks/use-workflow-execution-polling';
import { ReactFlowProvider } from '@refly-packages/ai-workspace-common/components/canvas';
import SettingModal from '@refly-packages/ai-workspace-common/components/settings';
import {
  useSiderStoreShallow,
  useCanvasOperationStoreShallow,
  useUserStoreShallow,
} from '@refly/stores';
import { CanvasProvider } from '@refly-packages/ai-workspace-common/context/canvas';
import { useIsLogin } from '@refly-packages/ai-workspace-common/hooks/use-is-login';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { logEvent } from '@refly/telemetry-web';
import { Helmet } from 'react-helmet';
import FooterSection from '@refly-packages/ai-workspace-common/components/workflow-app/FooterSection';
import WhyChooseRefly from './WhyChooseRefly';
import { SettingItem } from '@refly-packages/ai-workspace-common/components/sider/layout';

// User Avatar component for header
const UserAvatar = () => {
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  if (!userProfile?.uid) {
    return null;
  }

  return (
    <div className="group relative">
      <SettingItem showName={false} avatarAlign={'right'} />
    </div>
  );
};

const WorkflowAppPage: React.FC = () => {
  const { t } = useTranslation();
  const { shareId: routeShareId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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

  // Get subscription usage hook for refreshing credits
  const { refetchUsage } = useSubscriptionUsage();

  // Use shareId to directly access static JSON file
  const { data: workflowApp, loading: isLoading } = useFetchShareData(shareId);

  // Track enter_template_page event when page loads
  useEffect(() => {
    if (shareId) {
      logEvent('enter_template_page', null, { shareId });
    }
  }, [shareId]);

  const urlExecutionId = searchParams.get('executionId');
  // Restore executionId from URL on page load
  useEffect(() => {
    if (urlExecutionId) {
      setExecutionId(urlExecutionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlExecutionId]);

  const workflowVariables = useMemo(() => {
    return workflowApp?.variables ?? [];
  }, [workflowApp]);

  const { data: workflowDetail, status } = useWorkflowExecutionPolling({
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
      // Clear executionId from URL

      // Refresh credit balance after workflow completion
      refetchUsage();

      if (status === 'finish') {
        notification.success({
          message: t('workflowApp.run.completed'),
        });
        // Auto switch to products tab when workflow completes successfully
        products.length > 0 && setActiveTab('products');
      } else if (status === 'failed') {
        notification.error({
          message: t('workflowApp.run.failed'),
        });
      }
    },
    onError: (_error) => {
      // Clear executionId on error
      setExecutionId(null);
      // Reset running state on error
      setIsRunning(false);
      // Clear executionId from URL
      notification.error({
        message: t('workflowApp.run.error'),
      });
    },
  });

  // Update isRunning based on actual execution status from polling
  useEffect(() => {
    if (executionId) {
      if (status) {
        // Set isRunning based on actual status when available
        setIsRunning(status === 'init' || status === 'executing');
      } else {
        // When status is null but executionId exists, conservatively assume it's running
        // This handles the initial loading state when restoring from URL
        setIsRunning(true);
      }
    } else {
      // Clear isRunning when there's no executionId
      setIsRunning(false);
    }
  }, [executionId, status]);

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

  useEffect(() => {
    products.length > 0 && setActiveTab('products');
  }, [products?.length]);

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
        message.warning(t('workflowApp.run.loginRequired'));
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
          message.error(t('workflowApp.run.executeError'));
          // Reset running state on error
          setIsRunning(false);
          return;
        }

        const newExecutionId = data?.data?.executionId ?? null;
        if (newExecutionId) {
          setExecutionId(newExecutionId);
          message.success(t('workflowApp.run.workflowStarted'));
          // Update URL with executionId to enable page refresh recovery
          setSearchParams({ executionId: newExecutionId });

          // Auto switch to runLogs tab when workflow starts
          setActiveTab('runLogs');
        } else {
          message.error(t('workflowApp.run.executionIdFailed'));
          // Reset running state on failure
          setIsRunning(false);
        }
      } catch (error) {
        console.error('Error executing workflow app:', error);
        message.error(t('workflowApp.run.executeFailed'));
        // Reset running state on error
        setIsRunning(false);
      }
    },
    [shareId, isLoggedRef, navigate, setSearchParams],
  );

  const handleCopyWorkflow = useCallback(() => {
    logEvent('remix_workflow_publish', Date.now(), {
      shareId,
    });

    // Check if user is logged in before copying workflow
    if (!isLoggedRef.current) {
      message.warning(t('workflowApp.run.loginRequiredCopy'));
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
    const shareUrl = window.location.origin + window.location.pathname;
    logEvent('duplicate_workflow_publish', Date.now(), {
      shareId,
      shareUrl,
    });
    try {
      // Copy URL without query parameters to clipboard
      await navigator.clipboard.writeText(shareUrl);
      message.success(t('canvas.workflow.run.shareLinkCopied') || 'Share link copied to clipboard');
    } catch (error) {
      console.error('Failed to copy share link:', error);
      message.error(t('canvas.workflow.run.shareLinkCopyFailed'));
    }
  }, [t, shareId]);

  const segmentedOptions = useMemo(() => {
    return [
      // {
      //   label: t('workflowApp.runLogs'),
      //   value: 'runLogs',
      // },
      {
        label: t('workflowApp.products'),
        value: 'products',
      },
    ];
  }, [t]);

  return (
    <ReactFlowProvider>
      <CanvasProvider readonly={true} canvasId={workflowApp?.canvasData?.canvasId ?? ''}>
        <style>
          {`
            .refly.ant-layout {
              background-color: var(--refly-bg-content-z2);
              margin: 0px;
              border-radius: 0px;
              height: 100vh
            }
            .dark .refly.ant-layout {
              background-color: var(--refly-bg-content-z2);
            }
          `}
        </style>
        <div className="bg-[var(--refly-bg-content-z2)]">
          <div
            className={`relative flex flex-col shrink-0 h-[300px] ${
              workflowApp?.coverUrl
                ? 'bg-cover bg-center bg-no-repeat'
                : 'bg-[var(--refly-bg-content-z2)]'
            }`}
            style={
              workflowApp?.coverUrl
                ? {
                    backgroundImage: `url(${workflowApp.coverUrl})`,
                  }
                : {}
            }
          >
            {/* Gradient overlay - only shown when cover image exists */}
            {workflowApp?.coverUrl && (
              <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-white dark:from-black/30 dark:to-black backdrop-blur-[20px] pointer-events-none" />
            )}

            <Helmet>
              <title>{workflowApp?.title ?? ''}</title>
            </Helmet>

            {/* Header - Fixed at top with full transparency */}
            <div className=" top-0 left-0 right-0 z-50 border-b border-white/20 dark:border-[var(--refly-semi-color-border)] h-[64px]">
              <div className="relative mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                  <div className="flex items-center gap-3">
                    <Logo onClick={() => navigate?.('/')} />
                    <GithubStar />
                  </div>
                  <UserAvatar />
                </div>
              </div>
            </div>

            {/* Main Content - flex-1 to take remaining space with top padding for fixed header */}
            <div className="flex-1 pt-16 relative z-10">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {isLoading ? (
                  <LoadingContent />
                ) : (
                  <>
                    {/* Hero Section */}
                    <div className="text-center mb-6 sm:mb-8">
                      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--refly-text-0)] dark:text-[var(--refly-text-StaticWhite)] drop-shadow-sm">
                        {workflowApp?.title ?? ''}
                      </h1>
                      <p className="mt-3 sm:mt-4 text-base sm:text-lg text-[var(--refly-text-1)] dark:text-[var(--refly-text-2)] max-w-2xl mx-auto drop-shadow-sm">
                        {workflowApp?.description ?? ''}
                      </p>
                    </div>

                    {/* Workflow Form */}
                    <div className="mb-6 sm:mb-8 relative z-20">
                      <WorkflowRunForm
                        workflowApp={workflowApp}
                        workflowVariables={workflowVariables}
                        onSubmitVariables={onSubmit}
                        loading={isLoading}
                        onCopyWorkflow={handleCopyWorkflow}
                        onCopyShareLink={handleCopyShareLink}
                        isRunning={isRunning}
                        templateContent={workflowApp?.templateContent}
                        className="max-h-[500px] sm:max-h-[600px] bg-[var(--refly-bg-float-z3)] dark:bg-[var(--refly-bg-content-z2)] border border-[var(--refly-Card-Border)] dark:border-[var(--refly-semi-color-border)] shadow-[0_2px_20px_4px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_20px_4px_rgba(0,0,0,0.2)] px-4 py-3 rounded-2xl"
                      />
                    </div>

                    {logs.length > 0 && (
                      <>
                        {/* Tabs */}
                        {products.length > 0 && (
                          <div className="mb-4 sm:mb-6 flex justify-center relative z-20">
                            <Segmented
                              className="max-w-sm sm:max-w-md mx-auto"
                              shape="round"
                              options={segmentedOptions}
                              value={activeTab}
                              onChange={(value) => setActiveTab(value)}
                            />
                          </div>
                        )}

                        {/* Content Area */}
                        <div className="bg-[var(--refly-bg-float-z3)] dark:bg-[var(--refly-bg-content-z2)] rounded-lg border border-[var(--refly-Card-Border)] dark:border-[var(--refly-semi-color-border)] relative z-20">
                          {activeTab === 'products' ? (
                            <WorkflowAppProducts products={products || []} />
                          ) : activeTab ===
                            'runLogs' ? // <WorkflowAppRunLogs nodeExecutions={logs || []} />

                          null : null}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Why Choose Refly Section */}
            <WhyChooseRefly />

            {/* Footer Section - always at bottom */}
            <FooterSection />
          </div>

          {/* Settings Modal */}
          <SettingModal visible={showSettingModal} setVisible={setShowSettingModal} />
        </div>
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

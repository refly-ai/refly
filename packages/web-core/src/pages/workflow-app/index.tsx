import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { Avatar, message, notification, Skeleton, Tooltip } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CanvasNodeType, WorkflowNodeExecution, WorkflowVariable } from '@refly/openapi-schema';
import { GithubStar } from '@refly-packages/ai-workspace-common/components/common/github-star';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { WorkflowAppProducts } from '@refly-packages/ai-workspace-common/components/workflow-app/products';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
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
import { SelectedResultsGrid } from '@refly-packages/ai-workspace-common/components/workflow-app/selected-results-grid';
import { WorkflowAPPForm } from './workflow-app-form';

// User Avatar component for header
const UserAvatar = () => {
  const { t } = useTranslation();
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  if (!userProfile?.uid) {
    return (
      <Tooltip title={t('workflowApp.notLoggedIn')}>
        <Avatar size={36}>{t('workflowApp.notLoggedIn')}</Avatar>
      </Tooltip>
    );
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
  const shareId = routeShareId ?? '';
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('runLogs');
  const [finalNodeExecutions, setFinalNodeExecutions] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [executionCreditUsage, setExecutionCreditUsage] = useState<number | null>(null);

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
  const { data: workflowApp, loading: isLoading } = useFetchShareData(shareId, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-store',
    },
  });

  // Track enter_template_page event when page loads
  useEffect(() => {
    if (shareId) {
      logEvent('enter_template_page', null, { shareId });
    }
  }, [shareId]);

  const workflowVariables = useMemo(() => {
    return workflowApp?.variables ?? [];
  }, [workflowApp]);

  const { data: workflowDetail, status } = useWorkflowExecutionPolling({
    executionId,
    enabled: true,
    interval: 1000,

    onComplete: async (status, data) => {
      // Save final nodeExecutions before clearing executionId
      if (data?.data?.nodeExecutions) {
        setFinalNodeExecutions(data.data.nodeExecutions);
      }

      // Clear executionId when workflow completes or fails
      const currentExecutionId = executionId;
      setExecutionId(null);

      // Reset running state when workflow completes
      setIsRunning(false);
      // Clear executionId from URL

      // Refresh credit balance after workflow completion
      refetchUsage();

      // Fetch execution credit usage if workflow completed successfully
      if (status === 'finish' && currentExecutionId) {
        try {
          const response = await getClient().getCreditUsageByExecutionId({
            query: {
              executionId: currentExecutionId,
            },
          });
          if (response?.data?.data?.total) {
            setExecutionCreditUsage(response.data.data.total);
          }
        } catch (error) {
          console.error('Failed to fetch execution credit usage:', error);
        }
      }

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
      notification.error({
        message: t('workflowApp.run.error'),
      });

      // Clear executionId on error
      setExecutionId(null);
      // Reset running state on error
      setIsRunning(false);
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
      .filter(
        (nodeExecution: WorkflowNodeExecution) =>
          ['document', 'codeArtifact', 'image', 'video', 'audio'].includes(
            nodeExecution.nodeType as CanvasNodeType,
          ) ||
          (['skillResponse'].includes(nodeExecution.nodeType as CanvasNodeType) &&
            (workflowApp?.resultNodeIds?.includes(nodeExecution.nodeId) ?? false)),
      )
      .filter((nodeExecution: WorkflowNodeExecution) => nodeExecution.status === 'finish');
  }, [nodeExecutions, workflowApp?.resultNodeIds]);

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
    [shareId, isLoggedRef, navigate],
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

  return (
    <ReactFlowProvider>
      <CanvasProvider readonly={true} canvasId={workflowApp?.canvasData?.canvasId ?? ''}>
        <style>
          {`
          .refly.ant-layout {
              background-color: var(--refly-bg-content-z2);
              margin: 0px;
              border-radius: 0px;
              height: var(--screen-height)
            }
            .dark .refly.ant-layout {
              background: var(--bg---refly-bg-body-z0, #0E0E0E);
            }
          `}
        </style>
        <Helmet>
          <title>{workflowApp?.title ?? ''}</title>
        </Helmet>

        <div className="bg-[var(--refly-bg-content-z2)]">
          <div
            className={`fixed top-[var(--banner-height)] left-0 right-0  flex flex-col shrink-0 h-[300px] ${
              workflowApp?.coverUrl
                ? 'bg-cover bg-center bg-no-repeat'
                : 'bg-[var(--refly-bg-content-z2)] dark:bg-[var(--bg---refly-bg-body-z0,#0E0E0E)]'
            }`}
            style={
              workflowApp?.coverUrl
                ? {
                    backgroundImage: `url(${workflowApp.coverUrl})`,
                  }
                : undefined
            }
          >
            {/* Gradient overlay - only shown when cover image exists */}
            {workflowApp?.coverUrl && (
              <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-white dark:from-[rgba(25,25,25,0.25)] dark:to-[#0E0E0E] backdrop-blur-[20px] pointer-events-none" />
            )}
          </div>

          {/* Header - Fixed at top with full transparency */}
          <div className="fixed top-[var(--banner-height)] left-0 right-0 z-50 border-b border-white/20 dark:border-[var(--refly-semi-color-border)] h-[64px]">
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
                  <WorkflowAPPForm
                    workflowApp={workflowApp}
                    workflowVariables={workflowVariables}
                    onSubmitVariables={onSubmit}
                    loading={isLoading}
                    onCopyWorkflow={handleCopyWorkflow}
                    onCopyShareLink={handleCopyShareLink}
                    isRunning={isRunning}
                    templateContent={workflowApp?.templateContent}
                    executionCreditUsage={executionCreditUsage}
                    className="max-h-[500px] sm:max-h-[600px] bg-[var(--refly-bg-float-z3)] dark:bg-[var(--refly-bg-content-z2)] border border-[var(--refly-Card-Border)] dark:border-[var(--refly-semi-color-border)] shadow-[0_2px_20px_4px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_20px_4px_rgba(0,0,0,0.2)] px-4 py-3 rounded-2xl"
                  />

                  {logs.length > 0 && (
                    <>
                      {/* Tabs */}
                      {products.length > 0 && (
                        <div className="text-center text-[var(--refly-text-0)] dark:text-[var(--refly-text-StaticWhite)] mb-[15px] mt-[40px] font-['PingFang_SC'] font-semibold text-[14px] leading-[1.4285714285714286em]">
                          {!!executionCreditUsage && executionCreditUsage > 0
                            ? t('workflowApp.productsGeneratedWithCost', {
                                count: products.length,
                                executionCost: executionCreditUsage ?? 0,
                              })
                            : t('workflowApp.productsGenerated', { count: products.length })}
                        </div>
                      )}

                      {/* Content Area */}
                      <div className="bg-[var(--refly-bg-float-z3)] rounded-lg border border-[var(--refly-Card-Border)] dark:bg-[var(--bg---refly-bg-body-z0,#0E0E0E)] relative z-20">
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

          <div className="w-full max-w-[860px] mx-auto rounded-lg py-3 px-4 bg-[var(--refly-bg-content-z2)] dark:bg-[var(--bg---refly-bg-body-z0,#0E0E0E)] border border-[var(--refly-Card-Border)] mt-[10px]">
            {/* results grid */}
            {workflowApp?.resultNodeIds?.length > 0 && (
              <div className="flex flex-col gap-[10px]">
                <div className="text-center z-10 text-[var(--refly-text-0)] dark:text-[var(--refly-text-StaticWhite)] font-['PingFang_SC'] font-semibold text-[14px] leading-[1.4285714285714286em]">
                  {t('workflowApp.resultPreview')}
                </div>
                <SelectedResultsGrid
                  fillRow
                  bordered
                  selectedResults={workflowApp?.resultNodeIds ?? []}
                  options={workflowApp?.canvasData?.nodes || []}
                />
              </div>
            )}
          </div>

          {/* Why Choose Refly Section */}
          <WhyChooseRefly />
          {/* Footer Section - always at bottom */}
          <FooterSection />

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

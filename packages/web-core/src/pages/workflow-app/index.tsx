import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { Avatar, message, Modal, notification, Skeleton, Tooltip } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CanvasNodeType,
  WorkflowNodeExecution,
  WorkflowVariable,
  DriveFile,
  CanvasNode,
} from '@refly/openapi-schema';
import { mapDriveFilesToCanvasNodes, mapDriveFilesToWorkflowNodeExecutions } from '@refly/utils';
import { GithubStar } from '@refly-packages/ai-workspace-common/components/common/github-star';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { WorkflowAppProducts } from '@refly-packages/ai-workspace-common/components/workflow-app/products';
import { PublicFileUrlProvider } from '@refly-packages/ai-workspace-common/context/public-file-url';
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
import { SettingItem } from '@refly-packages/ai-workspace-common/components/canvas/front-page';
import { SelectedResultsGrid } from '@refly-packages/ai-workspace-common/components/workflow-app/selected-results-grid';
import { WorkflowAPPForm } from './workflow-app-form';
import Lottie from 'lottie-react';
import loadingAnimation from './loading.json';

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
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [finalNodeExecutions, setFinalNodeExecutions] = useState<WorkflowNodeExecution[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [showStatusSection, setShowStatusSection] = useState(false);
  const [executionCreditUsage, setExecutionCreditUsage] = useState<number | null>(null);

  // Drive files state for preview and runtime
  const [runtimeDriveFiles, setRuntimeDriveFiles] = useState<DriveFile[]>([]);

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

  // Track view_template_detail event when page loads completely
  useEffect(() => {
    if (shareId && !isLoading && workflowApp) {
      logEvent('view_template_detail', null, { shareId });
    }
  }, [shareId, isLoading, workflowApp]);

  const workflowVariables = useMemo(() => {
    return workflowApp?.variables ?? [];
  }, [workflowApp]);

  // Fetch drive files for preview when workflowApp loads
  const previewDriveFiles = workflowApp?.canvasData?.files ?? [];

  const {
    data: workflowDetail,
    status,
    stopPolling,
  } = useWorkflowExecutionPolling({
    executionId,
    enabled: true,
    interval: 1000,

    onComplete: async (status, data) => {
      // Save final nodeExecutions before clearing executionId
      if (data?.data?.nodeExecutions) {
        setFinalNodeExecutions(data.data.nodeExecutions);
      }
      if (data?.data?.canvasId) {
        setCanvasId(data.data.canvasId);
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
      // Keep execution credit usage and products state to preserve the scene
    },
  });

  useEffect(() => {
    if (workflowDetail?.canvasId) {
      setCanvasId(workflowDetail.canvasId);
    }
  }, [workflowDetail]);

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

  // Handle status section visibility with animation
  useEffect(() => {
    if (isRunning || isStopped) {
      // Show with animation
      setShowStatusSection(true);
    } else {
      // Hide with animation delay
      const timer = setTimeout(() => {
        setShowStatusSection(false);
      }, 300); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [isRunning, isStopped]);

  useEffect(() => {
    if (shareId) {
      setFinalNodeExecutions([]);
      stopPolling();
      setIsRunning(false);
      setIsStopped(false);
    }
  }, [shareId]);

  const nodeExecutions = useMemo(() => {
    // Use current workflowDetail if available, otherwise use final cached results
    return workflowDetail?.nodeExecutions || finalNodeExecutions || [];
  }, [workflowDetail, finalNodeExecutions]);

  // Fetch drive files for runtime products after execution completes
  useEffect(() => {
    if (!canvasId || isRunning || executionId) {
      return;
    }

    // Fetch when execution has completed (finalNodeExecutions present)
    // or when page loads with existing products (to support refresh)
    if (finalNodeExecutions.length > 0) {
      const fetchRuntimeFiles = async () => {
        try {
          const allFiles: DriveFile[] = [];
          let page = 1;
          const pageSize = 100;
          const MAX_PAGES = 100; // Safety limit: max 10000 files

          while (page <= MAX_PAGES) {
            const { data } = await getClient().listDriveFiles({
              query: {
                canvasId,
                source: 'agent',
                scope: 'present',
                page,
                pageSize,
              },
            });

            const files = data?.data ?? [];
            allFiles.push(...files);

            if (files.length < pageSize) {
              break;
            }
            page++;
          }

          setRuntimeDriveFiles(allFiles);
        } catch (error) {
          console.error('Failed to fetch runtime drive files:', error);
          // Silently degrade
        }
      };

      fetchRuntimeFiles();
    }
  }, [canvasId, isRunning, executionId, finalNodeExecutions.length]);

  const canvasFilesById = useMemo(() => {
    const map = new Map<string, DriveFile>();
    const files = workflowApp?.canvasData?.files ?? [];
    for (const file of files) {
      map.set(file.fileId, file);
    }
    return map;
  }, [workflowApp?.canvasData?.files]);

  const canvasNodesByResultId = useMemo(() => {
    const map = new Map<string, string>();
    const nodes = workflowApp?.canvasData?.nodes ?? [];
    for (const node of nodes as CanvasNode[]) {
      const resultId = node?.data?.entityId;
      if (resultId) {
        map.set(resultId, node.id);
      }
    }
    return map;
  }, [workflowApp?.canvasData?.nodes]);

  const parsedNodeExecutions = useMemo(() => {
    const map = new Map<string, string>();
    for (const execution of nodeExecutions) {
      if (!execution?.nodeData) return;
      try {
        const parsed = JSON.parse(execution.nodeData);
        const resultId = parsed?.data?.entityId;
        if (resultId) {
          map.set(resultId, execution.nodeId);
        }
      } catch (error) {
        console.warn('Failed to parse nodeData for execution', execution.nodeId, error);
      }
    }
    return map;
  }, [nodeExecutions]);

  const sourceDriveFiles = useMemo(() => {
    const ids = (workflowApp?.resultNodeIds as string[]) ?? [];
    const nodeIds = ids
      .filter((nodeId) => nodeId.startsWith('df-'))
      .map((fileId) => canvasFilesById.get(fileId)?.resultId)
      .filter((resultId): resultId is string => Boolean(resultId))
      .map((resultId) => canvasNodesByResultId.get(resultId))
      .filter((nodeId): nodeId is string => Boolean(nodeId));
    return new Set(nodeIds);
  }, [workflowApp?.resultNodeIds, canvasFilesById, canvasNodesByResultId]);

  const products = useMemo(() => {
    // Legacy product node executions (document, codeArtifact, image, video, audio)
    // These are old product nodes that may still exist before migration to drive_files
    const legacyNodeProducts = nodeExecutions
      .filter((nodeExecution: WorkflowNodeExecution) =>
        ['document', 'codeArtifact', 'image', 'video', 'audio'].includes(
          nodeExecution.nodeType as CanvasNodeType,
        ),
      )
      .filter((nodeExecution: WorkflowNodeExecution) => nodeExecution.status === 'finish');

    // Legacy skillResponse products (selected via resultNodeIds)
    const legacySkillProducts = nodeExecutions
      .filter(
        (nodeExecution: WorkflowNodeExecution) =>
          ['skillResponse'].includes(nodeExecution.nodeType as CanvasNodeType) &&
          (workflowApp?.resultNodeIds?.includes(nodeExecution.nodeId) ?? false),
      )
      .filter((nodeExecution: WorkflowNodeExecution) => nodeExecution.status === 'finish');

    // Map drive files to pseudo WorkflowNodeExecutions
    const serverOrigin = window.location.origin;

    const driveProducts = mapDriveFilesToWorkflowNodeExecutions(
      runtimeDriveFiles,
      serverOrigin,
    ).filter((nodeExecution: WorkflowNodeExecution) => {
      if (!nodeExecution.entityId) return false;
      const parentNodeId = parsedNodeExecutions?.get(nodeExecution.entityId);
      return parentNodeId ? sourceDriveFiles.has(parentNodeId) : false;
    });

    // Merge: priority order is legacyNodeProducts > legacySkillProducts > driveProducts
    // This ensures existing node executions take precedence over drive files
    const allProducts = [...legacyNodeProducts, ...legacySkillProducts, ...driveProducts];
    const uniqueMap = new Map<string, WorkflowNodeExecution>();

    for (const product of allProducts) {
      if (product?.nodeId && !uniqueMap.has(product.nodeId)) {
        uniqueMap.set(product.nodeId, product);
      }
    }

    return Array.from(uniqueMap.values());
  }, [nodeExecutions, runtimeDriveFiles, sourceDriveFiles, parsedNodeExecutions]);

  useEffect(() => {
    products.length > 0 && setActiveTab('products');
  }, [products?.length]);

  const logs = useMemo(() => {
    return nodeExecutions.filter((nodeExecution: WorkflowNodeExecution) =>
      ['skillResponse'].includes(nodeExecution.nodeType as CanvasNodeType),
    );
  }, [nodeExecutions]);

  // Map preview drive files to virtual CanvasNodes for result preview
  const previewOptions = useMemo(() => {
    const serverOrigin = window.location.origin;
    const driveFileNodes = mapDriveFilesToCanvasNodes(previewDriveFiles, serverOrigin);
    const canvasNodes = workflowApp?.canvasData?.nodes || [];

    // Merge and deduplicate by node ID
    const allNodes = [...driveFileNodes, ...canvasNodes];
    const uniqueMap = new Map<string, CanvasNode>();

    for (const node of allNodes) {
      if (node?.id && !uniqueMap.has(node.id)) {
        uniqueMap.set(node.id, node);
      }
    }

    return Array.from(uniqueMap.values());
  }, [previewDriveFiles, workflowApp?.canvasData?.nodes]);

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
        setIsStopped(false);
        // Reset execution credit usage when starting a new run
        setExecutionCreditUsage(null);
        // Reset products state when starting a new run
        setFinalNodeExecutions([]);
        setRuntimeDriveFiles([]);

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
          // Keep execution credit usage and products state to preserve the scene
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
          // Keep execution credit usage and products state to preserve the scene
        }
      } catch (error) {
        console.error('Error executing workflow app:', error);
        message.error(t('workflowApp.run.executeFailed'));
        // Reset running state on error
        setIsRunning(false);
        // Keep execution credit usage and products state to preserve the scene
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

  const handleAbortWorkflow = useCallback(() => {
    Modal.confirm({
      title: t('workflowApp.run.stopConfirmTitle'),
      content: (
        <div>
          <div>{t('workflowApp.run.stopConfirmMain')}</div>
          <div className="text-sm text-gray-500">{t('workflowApp.run.stopConfirmNote')}</div>
        </div>
      ),
      okText: t('workflowApp.run.confirm'),
      cancelText: t('common.cancel'),
      rootClassName: 'workflow-app-modal-confirm',
      okButtonProps: {
        type: 'primary',
      },
      onOk: async () => {
        // Get all executing skillResponse nodes
        logEvent('stop_template_run', null, {
          canvasId: workflowDetail?.canvasId ?? '',
          executionId,
        });

        const executingNodes = nodeExecutions.filter(
          (node: WorkflowNodeExecution) =>
            node.nodeType === 'skillResponse' &&
            (node.status === 'executing' || node.status === 'waiting'),
        );

        // Extract resultIds (entityId)
        const resultIds = executingNodes
          .map((node: WorkflowNodeExecution) => node.entityId)
          .filter((id: string | undefined): id is string => Boolean(id));

        // Abort all executing actions
        if (resultIds.length > 0) {
          await Promise.allSettled(
            resultIds.map((resultId: string) =>
              getClient()
                .abortAction({
                  body: {
                    resultId,
                  },
                })
                .catch((error) => {
                  console.warn(`Failed to abort action ${resultId}:`, error);
                }),
            ),
          );
        }

        // Save current executionId before clearing it
        const currentExecutionId = executionId;

        // Preserve canvasId if available in workflowDetail
        if (workflowDetail?.canvasId) {
          setCanvasId(workflowDetail.canvasId);
        }

        // Fetch execution credit usage before clearing executionId
        if (currentExecutionId) {
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

        // Preserve completed node executions before clearing executionId
        // Only keep nodes that have finished status
        const completedExecutions = nodeExecutions.filter(
          (node: WorkflowNodeExecution) => node.status === 'finish',
        );
        if (completedExecutions.length > 0) {
          setFinalNodeExecutions(completedExecutions);
        }

        // Clean up frontend state (but preserve completed results and credit usage)
        setExecutionId(null);
        setIsRunning(false);
        setIsStopped(true);
        // Don't clear executionCreditUsage - it's set above if available
        // Don't clear finalNodeExecutions - it's set above if available
        // Don't clear canvasId - it's set above if available
        // Don't clear runtimeDriveFiles - they will be fetched based on finalNodeExecutions and canvasId
        stopPolling();
        // Refresh credit balance after abort
        refetchUsage();
        message.success(t('workflowApp.run.stopSuccess'));
      },
    });
  }, [nodeExecutions, stopPolling, t, executionId, workflowDetail, refetchUsage, logEvent]);

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
        {/* Modal confirm button styling with theme colors - scoped to workflow-app only */}
        <style>
          {`
          .workflow-app-modal-confirm .ant-btn-primary {
            background-color: var(--refly-primary-default) !important;
            border-color: var(--refly-primary-default) !important;
            color: #ffffff !important;
          }

          .workflow-app-modal-confirm .ant-btn-primary:hover {
            background-color: var(--refly-primary-hover) !important;
            border-color: var(--refly-primary-hover) !important;
          }

          .workflow-app-modal-confirm .ant-btn-primary:active {
            background-color: var(--refly-primary-active) !important;
            border-color: var(--refly-primary-active) !important;
          }

          .workflow-app-modal-confirm .ant-btn-primary:disabled {
            background-color: var(--refly-primary-disabled) !important;
            border-color: var(--refly-primary-disabled) !important;
          }

          .workflow-app-modal-confirm .ant-btn-default:hover {
            border-color: var(--refly-primary-default) !important;
            color: var(--refly-primary-default) !important;
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
                    canvasId={canvasId}
                    templateContent={workflowApp?.templateContent}
                    executionCreditUsage={executionCreditUsage}
                    className="max-h-[500px] sm:max-h-[600px] bg-[var(--refly-bg-float-z3)] dark:bg-[var(--refly-bg-content-z2)] border border-[var(--refly-Card-Border)] dark:border-[var(--refly-semi-color-border)] shadow-[0_2px_20px_4px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_20px_4px_rgba(0,0,0,0.2)] px-4 py-3 rounded-2xl"
                  />

                  {/* Execution Status Section - Exact Figma Design */}
                  {showStatusSection && (
                    <div
                      className={`mt-6 w-full rounded-2xl relative mx-auto overflow-hidden transition-all duration-300 ease-in-out ${
                        isStopped
                          ? 'bg-[#F6F6F6] dark:bg-[var(--refly-bg-content-z2)]'
                          : 'bg-white dark:bg-[var(--refly-bg-content-z2)]'
                      } ${
                        isRunning || isStopped
                          ? 'opacity-100 translate-y-0'
                          : 'opacity-0 -translate-y-2'
                      }`}
                      style={{ maxWidth: '800px', minHeight: '244px', border: '1px solid #0E9F77' }}
                    >
                      {/* Responsive wrapper for scaling on smaller screens */}
                      <div className="relative w-full" style={{ minHeight: '244px' }}>
                        {isRunning ? (
                          <>
                            {/* Stop Button - Exact Position: x:717, y:16 */}
                            <button
                              type="button"
                              onClick={handleAbortWorkflow}
                              className="absolute flex items-center justify-center rounded-md bg-transparent hover:bg-[rgba(28,31,35,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)] transition-colors sm:left-[717px] right-4 sm:right-auto border border-[rgba(28,31,35,0.2)] dark:border-[rgba(255,255,255,0.2)]"
                              style={{
                                top: '16px',
                                width: '67px',
                                height: '28px',
                                padding: '10px',
                                gap: '10px',
                              }}
                            >
                              <span
                                className="text-[#1C1F23] dark:text-[var(--refly-text-0)]"
                                style={{
                                  fontFamily: 'Roboto',
                                  fontWeight: 600,
                                  fontSize: '12px',
                                  lineHeight: '1.6666666666666667em',
                                }}
                              >
                                {t('workflowApp.run.stop') || 'Stop'}
                              </span>
                            </button>

                            {/* Loading Animation and Status Group - Centered on mobile, exact position on desktop */}
                            <div
                              className="absolute left-1/2 -translate-x-1/2 sm:left-[268px] sm:translate-x-0"
                              style={{ top: '61px', width: '324px', height: '122px' }}
                            >
                              {/* Loading Animation - Lottie - Position: x:0, y:0 relative to group */}
                              <div
                                className="absolute"
                                style={{ left: '0px', top: '0px', width: '122px', height: '122px' }}
                              >
                                <Lottie
                                  animationData={loadingAnimation}
                                  loop
                                  autoplay
                                  style={{ width: '122px', height: '122px' }}
                                />
                              </div>

                              {/* Thinking... Text - Position: x:126, y:40 relative to group */}
                              <div
                                className="absolute bg-clip-text text-transparent"
                                style={{
                                  left: '126px',
                                  top: '40px',
                                  minWidth: '67px',
                                  height: '20px',
                                  fontFamily: 'Roboto',
                                  fontWeight: 600,
                                  fontSize: '14px',
                                  lineHeight: '1.4285714285714286em',
                                  background:
                                    'linear-gradient(24deg, rgba(142, 239, 182, 1) 0%, rgba(0, 178, 173, 1) 100%)',
                                  WebkitBackgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                }}
                              >
                                {t('workflowApp.run.thinking') || 'Thinking...'}
                              </div>

                              {/* Step Information Text - Position: x:126, y:64 relative to group */}
                              {(() => {
                                const nodes =
                                  nodeExecutions?.filter(
                                    (node: WorkflowNodeExecution) =>
                                      node.nodeType === 'skillResponse',
                                  ) ?? [];
                                const executingNodes =
                                  nodes?.filter(
                                    (node: WorkflowNodeExecution) => node.status === 'executing',
                                  ) ?? [];
                                const totalNodes = nodes?.length ?? 0;
                                const currentStep = executingNodes[0];
                                const finishedCount =
                                  nodes?.filter(
                                    (node: WorkflowNodeExecution) => node.status === 'finish',
                                  ).length ?? 0;
                                const stepNumber = finishedCount + (nodes.length > 0 ? 1 : 0);

                                if (nodes?.length > 0 || stepNumber > 0) {
                                  return (
                                    <div
                                      className="absolute text-[rgba(28,31,35,0.6)] dark:text-[rgba(255,255,255,0.6)]"
                                      style={{
                                        left: '126px',
                                        top: '64px',
                                        width: '198px',
                                        fontFamily: 'PingFang SC',
                                        fontWeight: 400,
                                        fontSize: '12px',
                                        lineHeight: '1.6666666666666667em',
                                      }}
                                    >
                                      {stepNumber > 0 && totalNodes > 0 ? (
                                        <div className="flex flex-col">
                                          {/* Display all executing nodes with Step prefix */}
                                          {executingNodes?.slice(0, 5).map((node, index) => {
                                            return (
                                              <div
                                                key={node.nodeId ?? index}
                                                className="overflow-hidden text-ellipsis whitespace-nowrap"
                                              >
                                                <span className="whitespace-nowrap flex-shrink-0">
                                                  Step {stepNumber + index}/{totalNodes}:{' '}
                                                </span>
                                                <span>{node.title ?? ''}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                                          {currentStep?.title ?? ''}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </>
                        ) : isStopped ? (
                          /* Stopped State - Exact Figma Design */
                          <div
                            className="absolute left-1/2 -translate-x-1/2"
                            style={{
                              top: '112px',
                              width: '100%',
                              height: '22px',
                            }}
                          >
                            <div
                              className="text-center text-[rgba(28,31,35,0.6)] dark:text-[rgba(255,255,255,0.6)]"
                              style={{
                                fontFamily: 'PingFang SC',
                                fontWeight: 400,
                                fontSize: '12px',
                                lineHeight: '1.8333333333333333em',
                                textAlign: 'center',
                              }}
                            >
                              {t('workflowApp.run.stoppedMessage') ||
                                '停止运行，未生成结果，可重新运行模板'}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {(products.length > 0 || logs.length > 0) && (
                    <>
                      {/* Tabs */}
                      <div
                        className={`text-center text-[var(--refly-text-0)] dark:text-[var(--refly-text-StaticWhite)] font-['PingFang_SC'] font-semibold text-[14px] leading-[1.4285714285714286em] transition-all duration-300 ease-in-out overflow-hidden ${
                          products.length > 0
                            ? 'mt-10 mb-[15px] opacity-100'
                            : 'mt-0 mb-0 opacity-0 h-0 max-h-0'
                        }`}
                        style={{
                          maxHeight: products.length > 0 ? '200px' : '0px',
                        }}
                      >
                        {products.length > 0 &&
                          (!!executionCreditUsage && executionCreditUsage > 0
                            ? t('workflowApp.productsGeneratedWithCost', {
                                count: products.length,
                                executionCost: executionCreditUsage ?? 0,
                              })
                            : t('workflowApp.productsGenerated', { count: products.length }))}
                      </div>

                      {/* Content Area */}
                      <div className="bg-[var(--refly-bg-float-z3)] rounded-lg border border-[var(--refly-Card-Border)] dark:bg-[var(--bg---refly-bg-body-z0,#0E0E0E)] relative z-20 transition-all duration-300 ease-in-out">
                        <div className="transition-opacity duration-300 ease-in-out">
                          {activeTab === 'products' ? (
                            <PublicFileUrlProvider value={false}>
                              <WorkflowAppProducts products={products || []} />
                            </PublicFileUrlProvider>
                          ) : activeTab ===
                            'runLogs' ? // <WorkflowAppRunLogs nodeExecutions={logs || []} />

                          null : null}
                        </div>
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
                <PublicFileUrlProvider>
                  <SelectedResultsGrid
                    fillRow
                    bordered
                    selectedResults={workflowApp?.resultNodeIds ?? []}
                    options={previewOptions}
                  />
                </PublicFileUrlProvider>
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

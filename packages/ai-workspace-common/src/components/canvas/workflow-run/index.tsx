import { Button, Skeleton } from 'antd';
import { Close } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { WorkflowRunForm } from './workflow-run-form';
import './index.scss';
import { useCallback, useState } from 'react';
import { WorkflowVariable } from '@refly/openapi-schema';
import { logEvent } from '@refly/telemetry-web';
import { useGetCreditUsageByCanvasId } from '@refly-packages/ai-workspace-common/queries/queries';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';

export const WorkflowRun = () => {
  const { t } = useTranslation();
  const { setShowWorkflowRun, showWorkflowRun } = useCanvasResourcesPanelStoreShallow((state) => ({
    setShowWorkflowRun: state.setShowWorkflowRun,
    showWorkflowRun: state.showWorkflowRun,
  }));

  const { workflow, canvasId } = useCanvasContext();
  const {
    initializeWorkflow,
    isInitializing: loading,
    executionId,
    workflowStatus,
    isPolling,
    pollingError,
  } = workflow;
  const {
    data: workflowVariables,
    setVariables,
    isLoading: workflowVariablesLoading,
  } = useVariablesManagement(canvasId);

  const { data: creditUsageData, isLoading: isCreditUsageLoading } = useGetCreditUsageByCanvasId(
    {
      query: { canvasId },
    },
    undefined,
    {
      enabled: showWorkflowRun && !!canvasId,
    },
  );

  const [isRunning, setIsRunning] = useState(false);

  const handleClose = useCallback(() => {
    setShowWorkflowRun(false);
  }, [setShowWorkflowRun]);

  const onSubmitVariables = useCallback(
    async (variables: WorkflowVariable[]) => {
      // Guard against missing canvasId
      if (!canvasId) {
        console.warn('Canvas ID is missing, cannot initialize workflow');
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
        }
      } catch (error) {
        console.error('Error initializing workflow:', error);
        // Reset running state on error
        setIsRunning(false);
      }
    },
    [canvasId, initializeWorkflow, setVariables, setIsRunning],
  );

  if (!showWorkflowRun) return null;

  return (
    <div className="z-[30] absolute -top-[1px] -right-[1px] -bottom-[1px] w-[400px] flex flex-col rounded-xl bg-refly-bg-content-z2 border-solid border-[1px] border-refly-Card-Border shadow-refly-m overflow-hidden">
      <div className="w-full h-14 flex gap-2 items-center justify-between p-3 border-solid border-refly-Card-Border border-[1px] border-x-0 border-t-0">
        <div className="text-refly-text-0 text-base font-semibold leading-[26px] min-w-0 flex-1">
          {t('canvas.workflow.run.title')}
        </div>

        <Button type="text" icon={<Close size={24} />} onClick={handleClose} />
      </div>

      <div className="flex-1 w-full overflow-y-auto">
        {workflowVariablesLoading ? (
          <div className="p-4">
            <Skeleton paragraph={{ rows: 10 }} active title={false} />
          </div>
        ) : (
          <WorkflowRunForm
            workflowVariables={workflowVariables}
            onSubmitVariables={onSubmitVariables}
            loading={loading}
            executionId={executionId}
            workflowStatus={workflowStatus}
            isPolling={isPolling}
            pollingError={pollingError}
            isRunning={isRunning}
            onRunningChange={setIsRunning}
            creditUsage={isCreditUsageLoading ? null : (creditUsageData?.data?.total ?? 0)}
          />
        )}
      </div>
    </div>
  );
};

import React, { useMemo, useCallback, useState } from 'react';
import { Button, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { CreateWorkflowAppModal } from '@refly-packages/ai-workspace-common/components/workflow-app/create-modal';
import { useListWorkflowApps } from '@refly-packages/ai-workspace-common/queries';
import { logEvent } from '@refly/telemetry-web';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useCanvasStoreShallow } from '@refly/stores';
import { useSkillResponseLoadingStatus } from '@refly-packages/ai-workspace-common/hooks/canvas/use-skill-response-loading-status';
import { TurnRight } from 'refly-icons';

interface PublishTemplateButtonProps {
  canvasId: string;
  canvasTitle: string;
}

const PublishTemplateButton = React.memo(
  ({ canvasId, canvasTitle }: PublishTemplateButtonProps) => {
    const { t } = useTranslation();
    const { forceSyncState } = useCanvasContext();
    const [createTemplateModalVisible, setCreateTemplateModalVisible] = useState(false);

    // Get latest workflow app for this canvas
    const { data: workflowAppsData, refetch: refetchWorkflowApps } = useListWorkflowApps(
      { query: { canvasId } },
      ['workflow-apps', canvasId],
      {
        enabled: !!canvasId,
      },
    );

    // Get the latest workflow app for this canvas
    const latestWorkflowApp = useMemo(() => {
      const result = workflowAppsData?.data?.[0] ?? null;
      return result;
    }, [workflowAppsData, canvasId]);

    const handlePublishToCommunity = useCallback(async () => {
      // Make sure the canvas data is synced to the remote
      await forceSyncState({ syncRemote: true });
      setCreateTemplateModalVisible(true);
    }, [forceSyncState]);

    const handlePublishSuccess = useCallback(async () => {
      // Refresh workflow apps data after successful publish
      await refetchWorkflowApps();
    }, [refetchWorkflowApps]);

    const { nodeExecutions } = useCanvasStoreShallow((state) => ({
      nodeExecutions: state.canvasNodeExecutions[canvasId] ?? [],
    }));

    const executionStats = useMemo(() => {
      const total = nodeExecutions.length;
      const executing = nodeExecutions.filter((n) => n.status === 'executing').length;
      const finished = nodeExecutions.filter((n) => n.status === 'finish').length;
      const failed = nodeExecutions.filter((n) => n.status === 'failed').length;
      const waiting = nodeExecutions.filter((n) => n.status === 'waiting').length;

      return { total, executing, finished, failed, waiting };
    }, [nodeExecutions]);

    const { isLoading: skillResponseLoading, skillResponseNodes } =
      useSkillResponseLoadingStatus(canvasId);

    const toolbarLoading =
      executionStats.executing > 0 || executionStats.waiting > 0 || skillResponseLoading;

    return (
      <>
        <CreateWorkflowAppModal
          canvasId={canvasId}
          title={canvasTitle}
          visible={createTemplateModalVisible}
          setVisible={setCreateTemplateModalVisible}
          onPublishSuccess={handlePublishSuccess}
          appId={latestWorkflowApp?.appId}
        />
        <Tooltip
          title={
            toolbarLoading
              ? t('shareContent.waitForAgentsToFinish')
              : !skillResponseNodes?.length
                ? t('shareContent.noSkillResponseNodes')
                : undefined
          }
          placement="top"
        >
          <Button
            disabled={toolbarLoading || !skillResponseNodes?.length}
            type="primary"
            icon={<TurnRight size={16} />}
            onClick={() => {
              logEvent('canvas::canvas_publish_template', Date.now(), {
                canvas_id: canvasId,
              });
              handlePublishToCommunity();
            }}
          >
            {t('shareContent.publishTemplate')}
          </Button>
        </Tooltip>
      </>
    );
  },
);

PublishTemplateButton.displayName = 'PublishTemplateButton';

export default PublishTemplateButton;

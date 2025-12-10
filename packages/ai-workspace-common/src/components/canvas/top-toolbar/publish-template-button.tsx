import React, { useMemo, useCallback, useState } from 'react';
import { Button, Tooltip, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { CreateWorkflowAppModal } from '@refly-packages/ai-workspace-common/components/workflow-app/create-modal';
import { useListWorkflowApps } from '@refly-packages/ai-workspace-common/queries';
import { logEvent } from '@refly/telemetry-web';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useCanvasStoreShallow } from '@refly/stores';
import { useSkillResponseLoadingStatus } from '@refly-packages/ai-workspace-common/hooks/canvas/use-skill-response-loading-status';
import { TurnRight } from 'refly-icons';
import { cn } from '@refly/utils/cn';
import { PublishTemplatePopover } from './publish-template-popover';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';

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

    // Get canvas data for validation
    const { nodes } = useRealtimeCanvasData();

    // Filter skillResponse nodes for validation
    const skillResponseNodesForValidation = useMemo(() => {
      return nodes.filter((node) => node.type === 'skillResponse');
    }, [nodes]);

    // Canvas validation checks
    const canvasValidation = useMemo(() => {
      // Check for failed or unrun skillResponse nodes
      // Returns true if any skillResponse node has status 'failed', 'init', or undefined
      const hasFailedOrUnrunNodes = skillResponseNodesForValidation.some((node) => {
        const status = (node.data?.metadata as any)?.status;
        return status === 'failed' || status === 'init' || !status;
      });

      // Check if there are no skillResponse nodes
      // Returns true if there are no Agent nodes in the canvas
      const hasNoSkillResponseNodes = skillResponseNodesForValidation.length === 0;

      return {
        hasFailedOrUnrunNodes,
        hasNoSkillResponseNodes,
      };
    }, [skillResponseNodesForValidation]);

    // Validate canvas before publishing
    // Returns true if validation passes, false otherwise
    const validateCanvas = useCallback(() => {
      // Priority:  No Agents > Agent Not Run or Failed

      if (canvasValidation.hasNoSkillResponseNodes) {
        // Show toast
        message.error(t('workflowApp.validationNoAgents'));
        // Trigger canvas fitView event
        window.dispatchEvent(
          new CustomEvent('refly:canvas:fitView', {
            detail: { canvasId },
          }),
        );
        return false;
      }

      if (canvasValidation.hasFailedOrUnrunNodes) {
        // Get failed or unrun node IDs for highlighting
        const failedOrUnrunNodeIds = skillResponseNodesForValidation
          .filter((node) => {
            if (!node?.id) return false;
            const status = (node.data?.metadata as any)?.status;
            return status === 'failed' || status === 'init' || !status;
          })
          .map((node) => node.id)
          .filter(Boolean) as string[];

        // Show toast
        message.error(t('workflowApp.validationAgentsNotRun'));

        // Only trigger highlight if we have valid node IDs
        if (failedOrUnrunNodeIds.length > 0) {
          // Trigger canvas fitView and highlight event
          window.dispatchEvent(
            new CustomEvent('refly:canvas:fitViewAndHighlight', {
              detail: {
                canvasId,
                nodeIds: failedOrUnrunNodeIds,
              },
            }),
          );
        } else {
          // Fallback: just fit view if no valid node IDs found
          window.dispatchEvent(
            new CustomEvent('refly:canvas:fitView', {
              detail: { canvasId },
            }),
          );
        }
        return false;
      }

      return true;
    }, [canvasValidation, canvasId, skillResponseNodesForValidation, t]);

    const handlePublishToCommunity = useCallback(async () => {
      // Make sure the canvas data is synced to the remote
      await forceSyncState({ syncRemote: true });

      // Validate canvas before opening modal
      if (!validateCanvas()) {
        return;
      }

      setCreateTemplateModalVisible(true);
    }, [forceSyncState, validateCanvas]);

    const handleUpdateTemplate = useCallback(async () => {
      // Make sure the canvas data is synced to the remote
      await forceSyncState({ syncRemote: true });

      // Validate canvas before opening modal
      if (!validateCanvas()) {
        return;
      }

      setCreateTemplateModalVisible(true);
    }, [forceSyncState, validateCanvas, canvasId]);

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

    const disabled = useMemo(() => {
      return toolbarLoading || !skillResponseNodes?.length;
    }, [toolbarLoading, skillResponseNodes]);

    const shareId = useMemo(() => {
      return latestWorkflowApp?.shareId;
    }, [latestWorkflowApp]);

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
        {shareId ? (
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
            <PublishTemplatePopover
              shareId={shareId}
              onUpdateTemplate={handleUpdateTemplate}
              disabled={disabled}
              onOpen={() => {
                logEvent('canvas::canvas_publish_template', Date.now(), {
                  canvas_id: canvasId,
                });
              }}
            >
              <Button
                className={cn(disabled ? 'opacity-50 cursor-not-allowed' : '')}
                type="primary"
                icon={<TurnRight size={16} />}
                //  remove this comment to restore the original style, the disable logic is handled in the event handler
                // disabled={disabled}
              >
                {t('shareContent.publishTemplate')}
              </Button>
            </PublishTemplatePopover>
          </Tooltip>
        ) : (
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
              className={cn(disabled ? 'opacity-50 cursor-not-allowed' : '')}
              type="primary"
              icon={<TurnRight size={16} />}
              //  remove this comment to restore the original style, the disable logic is handled in the event handler
              // disabled={disabled}
              onClick={() => {
                if (disabled) return;

                logEvent('canvas::canvas_publish_template', Date.now(), {
                  canvas_id: canvasId,
                });
                handlePublishToCommunity();
              }}
            >
              {t('shareContent.publishTemplate')}
            </Button>
          </Tooltip>
        )}
      </>
    );
  },
);

PublishTemplateButton.displayName = 'PublishTemplateButton';

export default PublishTemplateButton;

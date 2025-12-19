import { Button, Modal, Tooltip, message } from 'antd';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';
import { Play, StopCircle, Preview } from 'refly-icons';
import { ActionStatus } from '@refly/openapi-schema';
import { logEvent } from '@refly/telemetry-web';

interface SkillResponseActionsProps {
  nodeIsExecuting: boolean;
  workflowIsRunning: boolean;
  variant?: 'node' | 'preview';
  onRerunFromHere?: () => void;
  // For preview variant
  onRerun?: () => void;
  // Common
  onStop: () => Promise<void>;
  // Extra actions (e.g., Close button in preview)
  extraActions?: React.ReactNode;
  readonly?: boolean;
  status?: ActionStatus;
}

const SkillResponseActionsComponent = ({
  nodeIsExecuting,
  workflowIsRunning,
  variant = 'node',
  onRerunFromHere,
  onRerun,
  onStop,
  extraActions,
  readonly = false,
  status,
}: SkillResponseActionsProps) => {
  const { t } = useTranslation();

  // When workflow is running but current node is not executing, disable actions
  const disabled = readonly || workflowIsRunning;

  const isReRunning = status && status !== 'init';
  const singleButtonTitle = nodeIsExecuting
    ? t('canvas.skillResponse.stopSingle')
    : isReRunning
      ? t('canvas.skillResponse.rerunSingle')
      : t('canvas.skillResponse.runSingle');

  const handleRerunFromHereClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onRerunFromHere) {
        onRerunFromHere();
      }
    },
    [onRerunFromHere],
  );

  const handleRerunClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onRerun) {
        onRerun();
      }
    },
    [onRerun],
  );

  const handleStopClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (nodeIsExecuting) {
        Modal.confirm({
          title: t('canvas.skillResponse.stopConfirmModal.title'),
          content: (
            <div>
              <div>{t('canvas.skillResponse.stopConfirmModal.main')}</div>
              <div className="text-sm text-gray-500">
                {t('canvas.skillResponse.stopConfirmModal.note')}
              </div>
            </div>
          ),
          okText: t('canvas.skillResponse.stopConfirmModal.confirm'),
          cancelText: t('canvas.skillResponse.stopConfirmModal.cancel'),
          icon: null,
          centered: true,
          okButtonProps: {
            className:
              '!bg-[#0E9F77] !border-[#0E9F77] hover:!bg-[#0C8A66] hover:!border-[#0C8A66]',
          },
          onOk: async () => {
            logEvent('stop_agent_run', Date.now(), {});
            await onStop();
            message.success(t('canvas.skillResponse.stopSuccess'));
          },
        });
      }
    },
    [nodeIsExecuting, onStop, t, logEvent],
  );

  // Determine which icon to show
  const iconSize = variant === 'preview' ? 20 : 12;
  const iconClassName = variant === 'preview' ? '' : 'translate-y-[-1px]';
  let icon = <Play size={iconSize} className={iconClassName} />;
  if (nodeIsExecuting && !disabled) {
    icon = <StopCircle size={iconSize} className={iconClassName} />;
  }

  const buttonClassName =
    variant === 'preview'
      ? 'flex items-center justify-center'
      : '!h-5 !w-5 p-0 flex items-center justify-center hover:!bg-refly-tertiary-hover';

  const handleToggleWorkflowRun = useDebouncedCallback(
    async (e: React.MouseEvent) => {
      if (nodeIsExecuting) {
        handleStopClick(e);
      } else {
        handleRerunClick(e);
      }
    },
    500,
    {
      leading: true,
      trailing: false,
    },
  );

  // Preview variant: simple button(s)
  if (variant === 'preview') {
    return (
      <>
        <Button
          type="text"
          icon={icon}
          onClick={handleToggleWorkflowRun}
          disabled={disabled}
          className={buttonClassName}
        />
        {extraActions}
      </>
    );
  }

  return (
    <>
      <Tooltip title={t('canvas.skillResponse.rerunFromHere')}>
        <Button
          type="text"
          size="small"
          icon={<Preview size={iconSize} className={iconClassName} />}
          onClick={handleRerunFromHereClick}
          disabled={disabled || nodeIsExecuting}
          className={buttonClassName}
          title={t('canvas.skillResponse.rerunFromHere')}
        />
      </Tooltip>

      <Tooltip title={singleButtonTitle}>
        <Button
          type="text"
          size="small"
          icon={icon}
          onClick={handleToggleWorkflowRun}
          disabled={disabled}
          className={buttonClassName}
          title={singleButtonTitle}
        />
      </Tooltip>
    </>
  );
};

export const SkillResponseActions = memo(SkillResponseActionsComponent);

SkillResponseActions.displayName = 'SkillResponseActions';

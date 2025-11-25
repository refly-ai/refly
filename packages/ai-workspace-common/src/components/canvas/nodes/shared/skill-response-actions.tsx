import { Button, Dropdown, Modal, message } from 'antd';
import { memo, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Running1, StopCircle } from 'refly-icons';
import type { MenuProps } from 'antd';

interface SkillResponseActionsProps {
  nodeIsExecuting: boolean;
  workflowIsRunning: boolean;
  // Variant: 'node' shows dropdown menu, 'preview' shows simple button
  variant?: 'node' | 'preview';
  // For node variant
  onRerunSingle?: () => void;
  onRerunFromHere?: () => void;
  // For preview variant
  onRerun?: () => void;
  // Common
  onStop: () => Promise<void>;
  // Extra actions (e.g., Close button in preview)
  extraActions?: React.ReactNode;
  readonly?: boolean;
}

const SkillResponseActionsComponent = ({
  nodeIsExecuting,
  workflowIsRunning,
  variant = 'node',
  onRerunSingle,
  onRerunFromHere,
  onRerun,
  onStop,
  extraActions,
  readonly = false,
}: SkillResponseActionsProps) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  // When workflow is running but current node is not executing, disable actions
  const disabled = readonly || workflowIsRunning;

  const handleMenuClick = useCallback<NonNullable<MenuProps['onClick']>>(
    ({ key }) => {
      if (key === 'rerunSingle' && onRerunSingle) {
        onRerunSingle();
      } else if (key === 'rerunFromHere' && onRerunFromHere) {
        onRerunFromHere();
      }
    },
    [onRerunSingle, onRerunFromHere],
  );

  const handleStopClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (nodeIsExecuting) {
        Modal.confirm({
          title: t('canvas.skillResponse.stopConfirmModal.title'),
          content: t('canvas.skillResponse.stopConfirmModal.content'),
          okText: t('canvas.skillResponse.stopConfirmModal.confirm'),
          cancelText: t('canvas.skillResponse.stopConfirmModal.cancel'),
          icon: null,
          okButtonProps: {
            className:
              '!bg-[#0E9F77] !border-[#0E9F77] hover:!bg-[#0C8A66] hover:!border-[#0C8A66]',
          },
          onOk: async () => {
            await onStop();
            message.success(t('canvas.skillResponse.stopSuccess'));
          },
        });
      }
    },
    [nodeIsExecuting, onStop, t],
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

  const menuItems: MenuProps['items'] = useMemo(
    () => [
      {
        key: 'rerunFromHere',
        label: t('canvas.skillResponse.rerunFromHere'),
      },
      {
        key: 'rerunSingle',
        label: t('canvas.skillResponse.rerunSingle'),
      },
    ],
    [t],
  );

  // Determine which icon to show
  const iconSize = variant === 'preview' ? 20 : 12;
  const iconClassName = variant === 'preview' ? '' : 'translate-y-[-1px]';
  let icon = <Play size={iconSize} className={iconClassName} />;
  if (nodeIsExecuting && !disabled) {
    icon = isHovered ? (
      <StopCircle size={iconSize} className={iconClassName} />
    ) : (
      <Running1 size={iconSize} className={iconClassName} />
    );
  }

  const buttonClassName =
    variant === 'preview'
      ? 'flex items-center justify-center'
      : '!h-6 !w-6 p-0 flex items-center justify-center hover:!bg-refly-tertiary-hover';

  // Preview variant: simple button(s)
  if (variant === 'preview' || nodeIsExecuting) {
    return (
      <>
        <Button
          type="text"
          icon={icon}
          onClick={nodeIsExecuting ? handleStopClick : handleRerunClick}
          disabled={disabled}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={buttonClassName}
        />
        {extraActions}
      </>
    );
  }

  // Node variant: dropdown or stop button
  // When running, just show a button; when not running, show dropdown
  return (
    <Dropdown
      menu={{
        items: menuItems,
        onClick: handleMenuClick,
      }}
      trigger={['click']}
      placement="topLeft"
      disabled={disabled}
    >
      <Button
        type="text"
        size="small"
        icon={icon}
        disabled={disabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={buttonClassName}
      />
    </Dropdown>
  );
};

export const SkillResponseActions = memo(SkillResponseActionsComponent);

SkillResponseActions.displayName = 'SkillResponseActions';

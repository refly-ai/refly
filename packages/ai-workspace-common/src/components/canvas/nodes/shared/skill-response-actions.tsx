import { Button, Dropdown } from 'antd';
import { memo, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Running1, Stop } from 'refly-icons';
import type { MenuProps } from 'antd';

interface SkillResponseActionsProps {
  isRunning: boolean;
  onRerunSingle: () => void;
  onRerunFromHere: () => void;
  onStop: () => void;
}

const SkillResponseActionsComponent = ({
  isRunning,
  onRerunSingle,
  onRerunFromHere,
  onStop,
}: SkillResponseActionsProps) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  const handleMenuClick = useCallback<NonNullable<MenuProps['onClick']>>(
    ({ key }) => {
      if (key === 'rerunSingle') {
        onRerunSingle();
      } else if (key === 'rerunFromHere') {
        onRerunFromHere();
      }
    },
    [onRerunSingle, onRerunFromHere],
  );

  const handleRunClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isRunning) {
        onStop();
      }
    },
    [isRunning, onStop],
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
  let icon = <Play size={12} />;
  if (isRunning) {
    icon = isHovered ? <Stop size={12} /> : <Running1 size={12} />;
  }
  console.log('isRunning', isRunning);

  // When running, just show a button; when not running, show dropdown
  if (isRunning) {
    return (
      <Button
        type="text"
        size="small"
        icon={icon}
        onClick={handleRunClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="h-6 p-0 flex items-center justify-center hover:!bg-refly-tertiary-hover"
      />
    );
  }

  return (
    <Dropdown
      menu={{
        items: menuItems,
        onClick: handleMenuClick,
      }}
      trigger={['click']}
      placement="topLeft"
    >
      <Button
        type="text"
        size="small"
        icon={icon}
        onClick={handleRunClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="h-6 p-0 flex items-center justify-center hover:!bg-refly-tertiary-hover"
      />
    </Dropdown>
  );
};

export const SkillResponseActions = memo(SkillResponseActionsComponent, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.isRunning === nextProps.isRunning &&
    prevProps.onRerunSingle === nextProps.onRerunSingle &&
    prevProps.onRerunFromHere === nextProps.onRerunFromHere &&
    prevProps.onStop === nextProps.onStop
  );
});

SkillResponseActions.displayName = 'SkillResponseActions';

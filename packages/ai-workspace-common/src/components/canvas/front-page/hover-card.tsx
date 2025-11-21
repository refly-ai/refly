import { memo, useCallback, useMemo } from 'react';
import { Button } from 'antd';
import { Edit } from 'refly-icons';
import { CanvasActionDropdown } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal/canvasActionDropdown';
import { useTranslation } from 'react-i18next';
import { HoverCardContainer } from '@refly-packages/ai-workspace-common/components/common/hover-card';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';

interface HoverCardProps {
  canvasId: string;
  canvasName: string;
  children: React.ReactNode;
  onEdit?: (canvasId: string) => void;
  className?: string;
  onClick?: () => void;
}

export const HoverCard = memo(
  ({ canvasId, canvasName, children, onEdit, className, onClick }: HoverCardProps) => {
    const { t } = useTranslation();
    const { getCanvasList } = useHandleSiderData();
    const handleEdit = useCallback(() => {
      onEdit?.(canvasId);
    }, [canvasId, onEdit]);

    const handleClick = useCallback(() => {
      onClick?.();
    }, [onClick]);

    const actionContent = useMemo(
      () => (
        <>
          <Button
            type="primary"
            icon={<Edit size={16} />}
            onClick={handleEdit}
            className="flex-1 h-8 rounded-lg"
          >
            {t('frontPage.recentWorkflows.edit')}
          </Button>

          <div onClick={(e) => e.stopPropagation()}>
            <CanvasActionDropdown
              canvasId={canvasId}
              canvasName={canvasName}
              btnSize="small"
              afterDelete={getCanvasList}
            >
              <Button className="flex items-center w-20 h-8 px-3 rounded-lg">
                {t('frontPage.recentWorkflows.more')}
              </Button>
            </CanvasActionDropdown>
          </div>
        </>
      ),
      [canvasId, canvasName, handleEdit, t, getCanvasList],
    );

    return (
      <HoverCardContainer actionContent={actionContent} className={className} onClick={handleClick}>
        {children}
      </HoverCardContainer>
    );
  },
);

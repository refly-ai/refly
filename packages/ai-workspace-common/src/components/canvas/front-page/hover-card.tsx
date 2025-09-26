import { memo, useState, useCallback } from 'react';
import { Button } from 'antd';
import { Edit } from 'refly-icons';
import { CanvasActionDropdown } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal/canvasActionDropdown';
import cn from 'classnames';
import { useTranslation } from 'react-i18next';

interface HoverCardProps {
  canvasId: string;
  canvasName: string;
  children: React.ReactNode;
  onEdit?: (canvasId: string) => void;
  className?: string;
}

export const HoverCard = memo(
  ({ canvasId, canvasName, children, onEdit, className }: HoverCardProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const { t } = useTranslation();

    const handleEdit = useCallback(() => {
      onEdit?.(canvasId);
    }, [canvasId, onEdit]);

    return (
      <div
        className={cn('relative group overflow-hidden hover:shadow-refly-m', className)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}

        <div
          className={cn(
            'absolute bottom-[1px] left-[1px] right-[1px] flex items-center gap-2 py-3 px-4 rounded-xl transition-all duration-300 ease-in-out bg-refly-bg-glass-content backdrop-blur-[20px]',
            isHovered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0',
          )}
          style={{
            boxShadow: '0px 0px 60px 0px rgba(0, 0, 0, 0.08)',
          }}
        >
          <Button
            type="primary"
            icon={<Edit size={16} />}
            onClick={handleEdit}
            className="flex-1 h-8 rounded-lg"
          >
            {t('frontPage.recentWorkflows.edit')}
          </Button>

          <CanvasActionDropdown canvasId={canvasId} canvasName={canvasName} btnSize="small">
            <Button className="flex items-center w-20 h-8 px-3 rounded-lg">
              {t('frontPage.recentWorkflows.more')}
            </Button>
          </CanvasActionDropdown>
        </div>
      </div>
    );
  },
);

HoverCard.displayName = 'HoverCard';

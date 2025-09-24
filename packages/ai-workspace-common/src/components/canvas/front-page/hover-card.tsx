import { memo, useState, useCallback } from 'react';
import { Button } from 'antd';
import { Edit } from 'refly-icons';
import { CanvasActionDropdown } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal/canvasActionDropdown';
import cn from 'classnames';

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

    const handleEdit = useCallback(() => {
      onEdit?.(canvasId);
    }, [canvasId, onEdit]);

    return (
      <div
        className={cn('relative group overflow-hidden', className)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}

        {/* Action buttons overlay */}
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 p-3 bg-refly-bg-content-z2 border-t border-refly-Card-Border transition-all duration-300 ease-in-out',
            isHovered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0',
          )}
          style={{
            boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.1)',
            borderRadius: '0 0 12px 12px', // Match the card's border radius
          }}
        >
          <Button
            type="primary"
            size="small"
            icon={<Edit size={16} />}
            onClick={handleEdit}
            className="flex items-center gap-1 h-8 px-3"
          >
            编辑
          </Button>

          <CanvasActionDropdown canvasId={canvasId} canvasName={canvasName} btnSize="small">
            <Button size="small" className="flex items-center gap-1 h-8 px-3">
              更多
            </Button>
          </CanvasActionDropdown>
        </div>
      </div>
    );
  },
);

HoverCard.displayName = 'HoverCard';

import { memo, useCallback } from 'react';
import { Button, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  IconClose,
  IconEdit,
  IconPlus,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { useCopilotStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { cn } from '@refly/utils/cn';

interface NodeEditBannerProps {
  className?: string;
}

export const NodeEditBanner = memo(({ className }: NodeEditBannerProps) => {
  const { t } = useTranslation();
  const { canvasId } = useCanvasContext();

  const { nodeEditContext, setNodeEditContext, setNodeEditMode } = useCopilotStoreShallow(
    (state) => ({
      nodeEditContext: state.nodeEditContext[canvasId],
      setNodeEditContext: state.setNodeEditContext,
      setNodeEditMode: state.setNodeEditMode,
    }),
  );

  const handleClear = useCallback(() => {
    setNodeEditContext(canvasId, null);
  }, [canvasId, setNodeEditContext]);

  const handleModeChange = useCallback(
    (mode: 'modify' | 'extend') => {
      setNodeEditMode(canvasId, mode);
    },
    [canvasId, setNodeEditMode],
  );

  if (!nodeEditContext) {
    return null;
  }

  const { currentState, editMode } = nodeEditContext;
  const displayTitle = currentState.title || t('copilot.nodeEdit.untitled');

  return (
    <div
      className={cn(
        'px-3 py-2 bg-[#f0f9f6] border-b border-[#d1e9e0] flex flex-col gap-2',
        className,
      )}
    >
      {/* Header with title and close button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-[#0E9F77] text-white flex-shrink-0">
            {t('copilot.nodeEdit.editing')}
          </span>
          <span className="text-sm text-gray-700 truncate" title={displayTitle}>
            {displayTitle}
          </span>
        </div>
        <Tooltip title={t('copilot.nodeEdit.clearSelection')}>
          <Button
            type="text"
            size="small"
            icon={<IconClose className="text-gray-500" />}
            onClick={handleClear}
            className="!p-1 hover:!bg-gray-100"
          />
        </Tooltip>
      </div>

      {/* Edit mode buttons */}
      <div className="flex gap-2">
        <Tooltip title={t('copilot.nodeEdit.modifyDescription')}>
          <Button
            size="small"
            type={editMode === 'modify' ? 'primary' : 'default'}
            icon={<IconEdit />}
            onClick={() => handleModeChange('modify')}
            className={cn(
              editMode === 'modify'
                ? '!bg-[#0E9F77] !border-[#0E9F77] hover:!bg-[#0C8A66] hover:!border-[#0C8A66]'
                : '',
            )}
          >
            {t('copilot.nodeEdit.modifyNode')}
          </Button>
        </Tooltip>
        <Tooltip title={t('copilot.nodeEdit.extendDescription')}>
          <Button
            size="small"
            type={editMode === 'extend' ? 'primary' : 'default'}
            icon={<IconPlus />}
            onClick={() => handleModeChange('extend')}
            className={cn(
              editMode === 'extend'
                ? '!bg-[#0E9F77] !border-[#0E9F77] hover:!bg-[#0C8A66] hover:!border-[#0C8A66]'
                : '',
            )}
          >
            {t('copilot.nodeEdit.extendFromNode')}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
});

NodeEditBanner.displayName = 'NodeEditBanner';

import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { WiTime3 } from 'react-icons/wi';
import { HoverCard } from './hover-card';
import { useNavigate } from 'react-router-dom';
import { SiderData, useSiderStoreShallow } from '@refly/stores';
import { Avatar } from 'antd';
import { UsedToolsets } from '@refly-packages/ai-workspace-common/components/workflow-list/used-toolsets';
import defaultAvatar from '@refly-packages/ai-workspace-common/assets/refly_default_avatar.png';

export const RecentWorkflow = memo(({ canvases }: { canvases: SiderData[] }) => {
  const { i18n, t } = useTranslation();
  const language = i18n.languages?.[0];
  const navigate = useNavigate();

  const { setIsManualCollapse } = useSiderStoreShallow((state) => ({
    setIsManualCollapse: state.setIsManualCollapse,
  }));

  const handleEditCanvas = useCallback(
    (canvasId: string) => {
      setIsManualCollapse(false);
      navigate(`/canvas/${canvasId}`);
    },
    [navigate, setIsManualCollapse],
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {canvases?.map((canvas) => (
        <HoverCard
          key={canvas.id}
          canvasId={canvas.id}
          canvasName={canvas.name}
          onEdit={handleEditCanvas}
          onClick={() => handleEditCanvas(canvas.id)}
        >
          <div className="h-[120px] flex flex-col justify-between p-4 border-[1px] border-solid border-refly-Card-Border rounded-xl bg-refly-bg-content-z2 hover:shadow-refly-m transition-shadow cursor-pointer">
            <div>
              <div className="text-sm leading-5 font-semibold text-refly-text-0 line-clamp-1">
                {canvas.name || t('common.untitled')}
              </div>
              <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                <UsedToolsets toolsets={canvas.usedToolsets} />
              </div>
            </div>

            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <Avatar size={18} src={canvas.owner?.avatar || defaultAvatar} />
                <div className="text-xs leading-4 text-refly-text-3 truncate">
                  {canvas.owner?.nickname ? canvas.owner?.nickname : `@${canvas.owner?.name}`}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <WiTime3 className="w-4 h-4 text-refly-text-2" />
                <span className="text-refly-text-2 text-xs leading-4 whitespace-nowrap">
                  {time(canvas.updatedAt, language as LOCALE)
                    ?.utc()
                    ?.fromNow()}
                </span>
              </div>
            </div>
          </div>
        </HoverCard>
      ))}
    </div>
  );
});

RecentWorkflow.displayName = 'RecentWorkflow';

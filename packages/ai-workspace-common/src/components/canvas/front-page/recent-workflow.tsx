import { useTranslation } from 'react-i18next';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { WiTime3 } from 'react-icons/wi';
import { HoverCard } from './hover-card';
import { useNavigate } from 'react-router-dom';
import { SiderData } from '@refly/stores';

export const RecentWorkflow = ({ canvases }: { canvases: SiderData[] }) => {
  const { i18n } = useTranslation();
  const language = i18n.languages?.[0];
  const navigate = useNavigate();

  const handleEditCanvas = (canvasId: string) => {
    navigate(`/canvas/${canvasId}`);
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {canvases?.map((canvas) => (
        <HoverCard
          key={canvas.id}
          canvasId={canvas.id}
          canvasName={canvas.name}
          onEdit={handleEditCanvas}
        >
          <div className="h-[120px] flex flex-col justify-between p-4 border-[1px] border-solid border-refly-Card-Border rounded-xl bg-refly-bg-content-z2 hover:shadow-refly-m transition-shadow cursor-pointer">
            <div>
              <div className="text-sm leading-5 font-semibold text-refly-text-0 line-clamp-1">
                {canvas.name}
              </div>
              <div className="mt-2 text-refly-text-2">tools占位</div>
            </div>

            <div className="flex items-center gap-2 justify-between">
              <div className="text-xs leading-4 text-refly-text-3 line-clamp-1">用户名占位</div>
              <div className="flex items-center gap-1">
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
};

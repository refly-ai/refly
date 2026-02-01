import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { useNavigate } from 'react-router-dom';
import { SiderData, useSiderStoreShallow } from '@refly/stores';
import { Button } from 'antd';
import { UsedToolsets } from '@refly-packages/ai-workspace-common/components/workflow-list/used-toolsets';
import { More, Add } from 'refly-icons';
import { logEvent } from '@refly/telemetry-web';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { CanvasActionDropdown } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal/canvasActionDropdown';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';

const ActionDropdown = memo(
  ({
    canvasId,
    canvasName,
    className,
  }: { canvasId: string; canvasName: string; className?: string }) => {
    const { getCanvasList } = useHandleSiderData();
    return (
      <div className={className} onClick={(e) => e.stopPropagation()}>
        <CanvasActionDropdown
          canvasId={canvasId}
          canvasName={canvasName}
          btnSize="small"
          afterDelete={getCanvasList}
        >
          <Button type="text" icon={<More size={16} />} />
        </CanvasActionDropdown>
      </div>
    );
  },
);
ActionDropdown.displayName = 'ActionDropdown';

export const RecentWorkflow = memo(({ canvases }: { canvases: SiderData[] }) => {
  const { i18n, t } = useTranslation();
  const language = i18n.languages?.[0];
  const navigate = useNavigate();

  const { debouncedCreateCanvas, isCreating: createCanvasLoading } = useCreateCanvas();

  const { setIsManualCollapse } = useSiderStoreShallow((state) => ({
    setIsManualCollapse: state.setIsManualCollapse,
  }));

  const handleNewWorkflow = useCallback(() => {
    logEvent('new_workflow', Date.now(), {});
    debouncedCreateCanvas();
  }, [debouncedCreateCanvas, logEvent]);

  const handleEditCanvas = useCallback(
    (canvasId: string) => {
      setIsManualCollapse(false);
      navigate(`/workflow/${canvasId}`);
    },
    [navigate, setIsManualCollapse],
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Button
        className="h-[120px] flex items-center flex-col gap-3 border-[1px] border-dashed border-refly-Control-Border rounded-xl p-3 cursor-pointer !bg-transparent hover:bg-refly-fill-hover hover:shadow-refly-m transition-colors"
        onClick={handleNewWorkflow}
        disabled={createCanvasLoading}
      >
        <div className="flex justify-center items-center w-[30px] h-[30px] bg-refly-text-0 rounded-full">
          {createCanvasLoading ? (
            <Spin size="small" className="text-refly-bg-body-z0" />
          ) : (
            <Add size={16} color="var(--refly-bg-body-z0)" />
          )}
        </div>
        <div className="text-sm leading-5 font-bold text-refly-text-0 line-clamp-1">
          {t('frontPage.newWorkflow.buttonText')}
        </div>
      </Button>

      {canvases?.map((canvas) => (
        <div key={canvas.id} onClick={() => handleEditCanvas(canvas.id)}>
          <div className="h-[120px] flex flex-col justify-between p-4 pb-2 border-[1px] border-solid border-refly-Card-Border bg-refly-bg-control-z0 rounded-xl bg-refly-bg-content-z2 hover:bg-refly-fill-hover hover:shadow-refly-m transition-shadow cursor-pointer">
            <div>
              <div className="text-sm leading-5 font-semibold text-refly-text-0 line-clamp-1">
                {canvas.name || t('common.untitled')}
              </div>
              <div className="mt-1 flex w-fit">
                <UsedToolsets toolsets={canvas.usedToolsets} />
              </div>
            </div>

            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-refly-text-3 text-xs leading-4 whitespace-nowrap">
                    {time(canvas.updatedAt, language as LOCALE)
                      ?.utc()
                      ?.fromNow()}
                  </span>
                </div>
              </div>

              <ActionDropdown
                canvasId={canvas.id}
                canvasName={canvas.name}
                className="translate-x-2"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

RecentWorkflow.displayName = 'RecentWorkflow';

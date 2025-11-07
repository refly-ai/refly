import { memo, useEffect, useRef, useCallback, useState } from 'react';
import { useCanvasResourcesPanelStoreShallow, useImportResourceStoreShallow } from '@refly/stores';
import { Button, Input, Tooltip } from 'antd';
import { Add, SideRight } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import { MyUploadList } from '../my-upload';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useFetchResources } from '@refly-packages/ai-workspace-common/hooks/use-fetch-resources';
import { CanvasNode } from '@refly/canvas-common';

interface ResourceOverviewProps {
  currentResource: CanvasNode | null;
  setCurrentResource: (resource: CanvasNode | null) => void;
}
export const ResourceOverview = memo((props: ResourceOverviewProps) => {
  const { currentResource, setCurrentResource } = props;
  const { t } = useTranslation();
  const { shareLoading, readonly } = useCanvasContext();
  const {
    data: resources,
    isLoading: isLoadingResources,
    refetch: refetchResources,
  } = useFetchResources();
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { setSidePanelVisible, setWideScreenVisible } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      setSidePanelVisible: state.setSidePanelVisible,
      setWideScreenVisible: state.setWideScreenVisible,
    }),
  );

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    pollingIntervalRef.current = setInterval(() => {
      refetchResources();
    }, 2000);
  }, [refetchResources]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const shouldPoll = resources.some(
      (resource) => resource.indexStatus === 'wait_parse' || resource.indexStatus === 'wait_index',
    );

    if (shouldPoll && !pollingIntervalRef.current) {
      startPolling();
    } else if (!shouldPoll && pollingIntervalRef.current) {
      stopPolling();
    }

    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, [resources, startPolling, stopPolling]);
  const [searchKeyword, setSearchKeyword] = useState('');

  const { setImportResourceModalVisible } = useImportResourceStoreShallow((state) => ({
    setImportResourceModalVisible: state.setImportResourceModalVisible,
  }));

  const handleNewResource = () => {
    setImportResourceModalVisible(true);
  };

  const handleClose = useCallback(() => {
    setSidePanelVisible(false);
    setWideScreenVisible(false);
  }, [setSidePanelVisible, setWideScreenVisible]);

  return (
    <div className="w-[350px] h-full flex flex-col">
      <div className="h-[64px] px-3 py-4 flex gap-2 items-center justify-between border-solid border-[1px] border-x-0 border-t-0 border-refly-Card-Border">
        <div className="flex gap-2 items-center">
          <Tooltip title={t('canvas.toolbar.closeResourcesPanel')} arrow={false}>
            <Button type="text" icon={<SideRight size={22} />} onClick={handleClose} />
          </Tooltip>
          <div className="text-refly-text-0 text-base font-semibold leading-[26px] min-w-0 flex-1">
            {t('canvas.resourceLibrary.title')}
          </div>
        </div>

        {!readonly && (
          <Button
            size="small"
            type="text"
            className="text-refly-text-0 font-semibold"
            icon={<Add size={16} />}
            onClick={handleNewResource}
          >
            {t('canvas.resourceLibrary.new.resource')}
          </Button>
        )}
      </div>
      <div className="p-4 flex-grow flex flex-col gap-4 overflow-hidden">
        {isLoadingResources || shareLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="text-refly-text-2 text-sm leading-5">{t('common.loading')}</div>
          </div>
        ) : !resources.length ? (
          <div className="h-full flex flex-col items-center justify-center">
            <img src={EmptyImage} alt="empty" className="w-[180px] h-[180px]" />
            <div className="text-refly-text-2 text-sm leading-5">
              {t('canvas.resourceLibrary.empty')}
            </div>
            <Button type="primary" className="mt-5 w-[140px]" onClick={handleNewResource}>
              {t('canvas.resourceLibrary.new.resource')}
            </Button>
          </div>
        ) : (
          <>
            <div className="w-full">
              <Input
                placeholder={t('canvas.resourceLibrary.searchPlaceholder')}
                className="border border-refly-Card-Border"
                variant="filled"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
            </div>

            {/* block */}
            <div className="flex-grow overflow-y-auto min-h-0">
              <MyUploadList
                resources={resources}
                searchKeyword={searchKeyword}
                currentResource={currentResource}
                setCurrentResource={setCurrentResource}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
});

ResourceOverview.displayName = 'ResourceOverview';

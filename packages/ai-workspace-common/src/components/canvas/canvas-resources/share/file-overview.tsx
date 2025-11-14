import { memo, useCallback, useState } from 'react';
import { useCanvasResourcesPanelStoreShallow, useImportResourceStoreShallow } from '@refly/stores';
import { Button, Input, Tooltip } from 'antd';
import { Add, SideRight } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import { FileList } from '../file-list';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useFetchDriveFiles } from '@refly-packages/ai-workspace-common/hooks/use-fetch-resources';

export const FileOverview = memo(() => {
  const { t } = useTranslation();
  const { shareLoading, readonly } = useCanvasContext();
  const { data: files, isLoading: isLoadingFiles } = useFetchDriveFiles();

  const { setSidePanelVisible, setWideScreenVisible } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      setSidePanelVisible: state.setSidePanelVisible,
      setWideScreenVisible: state.setWideScreenVisible,
    }),
  );

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
      <div className="h-14 px-3 py-4 flex gap-2 items-center justify-between border-solid border-[1px] border-x-0 border-t-0 border-refly-Card-Border">
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
        {isLoadingFiles || shareLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="text-refly-text-2 text-sm leading-5">{t('common.loading')}</div>
          </div>
        ) : !files.length ? (
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
              <FileList files={files} searchKeyword={searchKeyword} />
            </div>
          </>
        )}
      </div>
    </div>
  );
});

FileOverview.displayName = 'FileOverview';

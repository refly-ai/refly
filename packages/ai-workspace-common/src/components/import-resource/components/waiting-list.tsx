import { memo } from 'react';
import { Button, Spin, Avatar } from 'antd';
import mime from 'mime/lite';
import { Delete } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import { useImportResourceStoreShallow } from '@refly/stores';
import type { WaitingListItem } from '@refly/stores/src/stores/import-resource';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { safeParseURL } from '@refly/utils';
import { ResourceIcon } from '@refly-packages/ai-workspace-common/components/common/resourceIcon';

const WaitingList = memo(() => {
  const { t } = useTranslation();
  const { waitingList, removeFromWaitingList } = useImportResourceStoreShallow((state) => ({
    waitingList: state.waitingList,
    removeFromWaitingList: state.removeFromWaitingList,
  }));

  const renderWeblinkItem = (item: WaitingListItem) => {
    const isError = item.link?.isError;
    const link = item.link;

    const isHandled = item.link?.isHandled;

    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Spin spinning={!isHandled} size="small">
          <Avatar
            className="w-5 h-5 rounded-full"
            src={
              link?.image ||
              `https://www.google.com/s2/favicons?domain=${safeParseURL(item.url)}&sz=16`
            }
          />
        </Spin>

        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'text-sm truncate',
              !isHandled ? 'text-refly-text-2' : 'text-refly-text-0',
            )}
          >
            {isError ? (
              <span className="text-red-500">{t('resource.import.scrapeError')}</span>
            ) : (
              link?.title || item.title || item.url
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFileItem = (item: WaitingListItem) => {
    const isLoading = item.file?.status === 'uploading';
    return (
      <div className="file-item-container flex items-center gap-2 flex-1 min-w-0">
        <Spin spinning={isLoading} size="small">
          {item.file?.type === 'image' && item.file.url ? (
            <img
              src={item.file.url}
              alt={item.file.url}
              className="w-5 h-5 rounded-md object-cover"
            />
          ) : item.file?.type === 'video' && item.file.url ? (
            <div className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                <path d="M8 11l3-2-3-2v4z" />
              </svg>
            </div>
          ) : item.file?.type === 'audio' && item.file.url ? (
            <div className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                <path d="M9 12l2-2-2-2v4z" />
              </svg>
            </div>
          ) : (
            <ResourceIcon
              url=""
              resourceType="file"
              resourceMeta={{ contentType: mime.getType(item.file.extension) }}
              size={16}
            />
          )}
        </Spin>
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'text-sm truncate',
              isLoading ? 'text-refly-text-2' : 'text-refly-text-0',
            )}
          >
            {item.title || item.file?.url}
          </div>
        </div>
      </div>
    );
  };

  if (waitingList.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-refly-text-1 text-xs leading-4">
          {t('resource.import.noPendingFiles')}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-1 p-3">
      {waitingList.map((item) => (
        <div key={item.id} className="p-2 group hover:bg-refly-tertiary-hover rounded-lg">
          <div className="flex items-center justify-between w-full gap-x-2">
            {item.type === 'weblink' ? renderWeblinkItem(item) : renderFileItem(item)}
            <Button
              type="text"
              size="small"
              icon={<Delete size={20} color="var(--refly-func-danger-default)" />}
              onClick={() => removeFromWaitingList(item.id)}
              className="flex-shrink-0 text-refly-text-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            />
          </div>
        </div>
      ))}
    </div>
  );
});

WaitingList.displayName = 'WaitingList';

export default WaitingList;

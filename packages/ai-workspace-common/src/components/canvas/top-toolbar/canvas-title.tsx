import { useEffect, useState, useCallback, memo } from 'react';
import { Tooltip, Skeleton, Typography, Avatar, Divider } from 'antd';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useTranslation } from 'react-i18next';
import { LOCALE } from '@refly/common-types';
import { IconCanvas, IconEdit } from '@refly-packages/ai-workspace-common/components/common/icon';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { useCanvasSync } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-sync';
import { CanvasRename } from './canvas-rename';
import { ShareUser } from '@refly/openapi-schema';
import { AiOutlineUser } from 'react-icons/ai';

export const CanvasTitle = memo(
  ({
    canvasId,
    canvasTitle,
    hasCanvasSynced,
    providerStatus,
    debouncedUnsyncedChanges,
    language,
  }: {
    canvasId: string;
    canvasTitle?: string;
    hasCanvasSynced: boolean;
    providerStatus: string;
    debouncedUnsyncedChanges: number;
    language: LOCALE;
  }) => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { syncTitleToYDoc } = useCanvasSync();
    const { updateCanvasTitle } = useSiderStoreShallow((state) => ({
      updateCanvasTitle: state.updateCanvasTitle,
    }));

    const handleEditClick = useCallback(() => {
      setIsModalOpen(true);
    }, []);

    const handleModalOk = useCallback(
      (newTitle: string) => {
        if (newTitle?.trim()) {
          syncTitleToYDoc(newTitle);
          setIsModalOpen(false);
        }
      },
      [canvasId, syncTitleToYDoc, updateCanvasTitle],
    );

    const handleModalCancel = useCallback(() => {
      setIsModalOpen(false);
    }, []);

    // Refetch canvas list when canvas title changes
    useEffect(() => {
      if (hasCanvasSynced && canvasTitle) {
        updateCanvasTitle(canvasId, canvasTitle);
      }
    }, [canvasTitle, hasCanvasSynced, canvasId]);

    const isSyncing = providerStatus !== 'connected' || debouncedUnsyncedChanges > 0;

    return (
      <>
        <div
          className="ml-1 group flex items-center gap-2 text-sm font-bold text-gray-500 cursor-pointer hover:text-gray-700"
          onClick={handleEditClick}
          data-cy="canvas-title-edit"
        >
          <Tooltip
            title={
              isSyncing
                ? t('canvas.toolbar.syncingChanges')
                : t('canvas.toolbar.synced', {
                    time: time(new Date(), language)?.utc()?.fromNow(),
                  })
            }
          >
            <div
              className={`
              relative w-2.5 h-2.5 rounded-full
              transition-colors duration-700 ease-in-out
              ${isSyncing ? 'bg-yellow-500 animate-pulse' : 'bg-green-400'}
            `}
            />
          </Tooltip>
          {!hasCanvasSynced ? (
            <Skeleton className="w-32" active paragraph={false} />
          ) : (
            <Typography.Text className="!max-w-72 text-gray-500" ellipsis={{ tooltip: true }}>
              {canvasTitle || t('common.untitled')}
            </Typography.Text>
          )}
          <IconEdit className="text-gray-500 flex items-center justify-center" />
        </div>

        <CanvasRename
          canvasId={canvasId}
          canvasTitle={canvasTitle}
          isModalOpen={isModalOpen}
          handleModalOk={handleModalOk}
          handleModalCancel={handleModalCancel}
        />
      </>
    );
  },
);

export const ReadonlyCanvasTitle = memo(
  ({
    canvasTitle,
    isLoading,
    owner,
  }: {
    canvasTitle?: string;
    isLoading: boolean;
    owner?: ShareUser;
  }) => {
    const { t } = useTranslation();

    return (
      <div
        className="ml-1 group flex items-center gap-2 text-sm font-bold text-gray-500"
        data-cy="canvas-title-readonly"
      >
        <IconCanvas />
        {isLoading ? (
          <Skeleton className="w-32" active paragraph={false} />
        ) : (
          <>
            <Typography.Text className="!max-w-72 text-gray-500" ellipsis={{ tooltip: true }}>
              {canvasTitle || t('common.untitled')}
            </Typography.Text>

            {owner && (
              <>
                <Divider type="vertical" className="h-4" />
                <Avatar
                  src={owner.avatar}
                  size={18}
                  shape="circle"
                  icon={!owner.avatar ? <AiOutlineUser /> : undefined}
                />
                <Typography.Text className="text-gray-500 font-light text-sm">
                  {`@${owner.name}`}
                </Typography.Text>
              </>
            )}
          </>
        )}
      </div>
    );
  },
);

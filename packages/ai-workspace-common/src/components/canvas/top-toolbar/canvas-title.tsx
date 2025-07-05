import { useEffect, useState, useCallback, memo } from 'react';
import { Tooltip, Skeleton, Typography, Avatar, Divider } from 'antd';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useTranslation } from 'react-i18next';
import { LOCALE } from '@refly/common-types';
import { IconCanvas, IconEdit } from '@refly-packages/ai-workspace-common/components/common/icon';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { CanvasRename } from './canvas-rename';
import { ShareUser } from '@refly/openapi-schema';
import { AiOutlineUser } from 'react-icons/ai';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';

export const CanvasTitle = memo(
  ({
    canvasId,
    hasCanvasSynced,
    canvasLoading,
    canvasTitle,
    language,
  }: {
    canvasId: string;
    hasCanvasSynced: boolean;
    canvasLoading: boolean;
    canvasTitle: string;
    language: LOCALE;
  }) => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { setCanvasTitle } = useCanvasStoreShallow((state) => ({
      setCanvasTitle: state.setCanvasTitle,
    }));

    const { updateCanvasTitle } = useSiderStoreShallow((state) => ({
      updateCanvasTitle: state.updateCanvasTitle,
    }));

    const handleEditClick = useCallback(() => {
      setIsModalOpen(true);
    }, []);

    const handleUpdateCanvasTitle = useCallback(
      (newTitle: string) => {
        // CH-TODO: 调接口更新canvas title

        updateCanvasTitle(canvasId, newTitle);
        setCanvasTitle(canvasId, newTitle);
      },
      [canvasId, updateCanvasTitle],
    );

    const handleModalOk = useCallback(
      (newTitle: string) => {
        if (newTitle?.trim()) {
          handleUpdateCanvasTitle(newTitle);
          setIsModalOpen(false);
        }
      },
      [canvasId, handleUpdateCanvasTitle],
    );

    const handleModalCancel = useCallback(() => {
      setIsModalOpen(false);
    }, []);

    // Refetch canvas list when canvas title changes
    useEffect(() => {
      if (hasCanvasSynced && canvasTitle) {
        updateCanvasTitle(canvasId, canvasTitle);
        setCanvasTitle(canvasId, canvasTitle);
      }
    }, [canvasTitle, hasCanvasSynced, canvasId, updateCanvasTitle, setCanvasTitle]);

    const isSyncing = canvasLoading;

    return (
      <>
        <div
          className="ml-1 group flex items-center gap-2 text-sm font-bold cursor-pointer"
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
          {canvasLoading ? (
            <Skeleton className="w-32" active paragraph={false} />
          ) : (
            <Typography.Text
              className="!max-w-72 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
              ellipsis={{ tooltip: true }}
            >
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

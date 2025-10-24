import { memo } from 'react';
import { Tooltip, Skeleton, Typography, Avatar, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { LOCALE } from '@refly/common-types';
import { IconCanvas } from '@refly-packages/ai-workspace-common/components/common/icon';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { ShareUser } from '@refly/openapi-schema';
import { AiOutlineUser } from 'react-icons/ai';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { useNavigate } from 'react-router-dom';
import { useUserStoreShallow } from '@refly/stores';
import defaultAvatar from '@refly-packages/ai-workspace-common/assets/refly_default_avatar.png';

export const CanvasTitle = memo(
  ({
    canvasLoading,
    canvasTitle,
    language,
    syncFailureCount,
  }: {
    canvasLoading: boolean;
    canvasTitle: string;
    language: LOCALE;
    syncFailureCount: number;
  }) => {
    const { t } = useTranslation();

    const isSyncing = canvasLoading;

    return (
      <>
        <div
          className="py-1 px-1.5 group flex items-center gap-2 text-sm font-semibold hover:bg-refly-tertiary-hover rounded-lg cursor-pointer"
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
              ${canvasLoading || syncFailureCount > 0 ? 'bg-yellow-500 animate-pulse' : 'bg-green-400'}
            `}
            />
          </Tooltip>
          {canvasLoading && !canvasTitle ? (
            <Skeleton className="w-32" active paragraph={false} />
          ) : (
            <Typography.Text className="!max-w-72 text-refly-text-0" ellipsis={{ tooltip: true }}>
              {canvasTitle || t('common.untitled')}
            </Typography.Text>
          )}
        </div>
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
    const navigate = useNavigate();
    const { isLogin } = useUserStoreShallow((state) => ({
      isLogin: state.isLogin,
    }));

    return (
      <div
        className="ml-1 group flex items-center gap-2 text-sm font-bold text-gray-500"
        data-cy="canvas-title-readonly"
      >
        <Tooltip
          title={t(isLogin ? 'canvas.toolbar.backDashboard' : 'canvas.toolbar.backHome')}
          arrow={false}
          align={{ offset: [20, -8] }}
        >
          <div
            className="flex-shrink-0 flex items-center justify-center h-8 w-8 hover:bg-refly-tertiary-hover rounded-lg cursor-pointer"
            onClick={() => navigate('/')}
          >
            <Logo textProps={{ show: false }} logoProps={{ show: true, className: '!w-5 !h-5' }} />
          </div>
        </Tooltip>

        <Divider type="vertical" className="m-0 h-5 bg-refly-Card-Border" />
        <IconCanvas />
        {isLoading ? (
          <Skeleton className="w-32" active paragraph={false} />
        ) : (
          <>
            <Typography.Text className="!max-w-64 text-gray-500" ellipsis={{ tooltip: true }}>
              {canvasTitle || t('common.untitled')}
            </Typography.Text>

            {owner && (
              <>
                <Divider type="vertical" className="h-6 mx-1" />
                <Avatar
                  src={owner.avatar || defaultAvatar}
                  size={18}
                  shape="circle"
                  icon={!owner.avatar ? <AiOutlineUser /> : undefined}
                />
                <Typography.Text
                  className="text-gray-500 font-light text-sm"
                  ellipsis={{ tooltip: true }}
                >
                  {owner.nickname ? owner.nickname : `@${owner.name}`}
                </Typography.Text>
              </>
            )}
          </>
        )}
      </div>
    );
  },
);

import { WorkflowApp } from '@refly/openapi-schema';
import { HoverCardContainer } from '@refly-packages/ai-workspace-common/components/common/hover-card';
import { Avatar, Button, Tooltip } from 'antd';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { useTranslation } from 'react-i18next';
import { WiTime3 } from 'react-icons/wi';
import { memo, useMemo, useCallback } from 'react';
import defaultAvatar from '@refly-packages/ai-workspace-common/assets/refly_default_avatar.png';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';
import { useUserStoreShallow, useAuthStoreShallow } from '@refly/stores';

interface AppCardData extends WorkflowApp {
  publishReviewStatus?: string;
  publishToCommunity?: boolean;
}

export const AppCard = memo(({ data }: { data: AppCardData; onDelete?: () => void }) => {
  const { i18n, t } = useTranslation();
  const language = i18n.languages?.[0];
  const { duplicateCanvas, loading: duplicating } = useDuplicateCanvas();
  const isLogin = useUserStoreShallow((state) => state.isLogin);
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  const handleView = () => {
    window.open(`/app/${data.shareId}`, '_blank');
  };

  const handleViewButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleView();
  };

  const handleUse = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      if (!isLogin) {
        setLoginModalOpen(true);
        return;
      }
      if (data.shareId) {
        duplicateCanvas({ shareId: data.shareId });
      }
    },
    [data.shareId, duplicateCanvas, isLogin, setLoginModalOpen],
  );

  // Determine review status
  const reviewStatus = useMemo(() => {
    if (!data.publishToCommunity) {
      return null;
    }

    const status = data.publishReviewStatus;
    if (status === 'reviewing') {
      return {
        label: t('appManager.reviewStatus.reviewing'),
        tooltip: t('appManager.reviewStatus.reviewingTooltip'),
      };
    }
    if (status === 'published' || status === 'approved') {
      return {
        label: t('appManager.reviewStatus.published'),
        tooltip: t('appManager.reviewStatus.publishedTooltip'),
      };
    }
    return null;
  }, [data.publishToCommunity, data.publishReviewStatus, t]);

  const actionContent = (
    <>
      <Button loading={duplicating} type="primary" onClick={handleUse} className="flex-1">
        {t('template.use')}
      </Button>
      <Button type="primary" onClick={(e) => handleViewButtonClick(e)} className="flex-1">
        {t('appManager.view')}
      </Button>
    </>
  );

  return (
    <>
      <HoverCardContainer actionContent={actionContent} onClick={handleView}>
        <div className="flex flex-col justify-between border-[1px] border-solid border-refly-Card-Border rounded-xl bg-refly-bg-content-z2 hover:shadow-refly-m cursor-pointer overflow-hidden">
          <div className="h-40 bg-gray-100 dark:bg-gray-700 flex items-center justify-center relative">
            {data?.coverUrl && (
              <img src={data?.coverUrl} alt={data.title} className="w-full h-full object-cover" />
            )}
            {reviewStatus && (
              <Tooltip title={reviewStatus?.tooltip}>
                <div
                  className="absolute top-2 right-2 flex items-center justify-center rounded-md text-white text-[10px] font-medium leading-[1.4em] cursor-default"
                  style={{
                    padding: '4px 10px',
                    backgroundColor: 'rgba(28, 31, 35, 0.6)',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {reviewStatus?.label}
                </div>
              </Tooltip>
            )}
          </div>
          <div className="p-4 flex-1 flex flex-col gap-2">
            <div className="text-sm font-semibold truncate">{data.title}</div>
            <div className="h-5 text-xs text-refly-text-2 line-clamp-1">{data.description}</div>

            <div className="flex items-center gap-2 text-xs text-refly-text-2">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <Avatar size={18} src={data.owner?.avatar || defaultAvatar} />
                <span className="truncate">
                  {data.owner?.nickname ? data.owner?.nickname : `@${data.owner?.name}`}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <WiTime3 className="w-4 h-4 text-refly-text-2" />
                <span className="whitespace-nowrap">
                  {time(data.createdAt, language as LOCALE)
                    ?.utc()
                    ?.fromNow()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </HoverCardContainer>
    </>
  );
});

AppCard.displayName = 'AppCard';

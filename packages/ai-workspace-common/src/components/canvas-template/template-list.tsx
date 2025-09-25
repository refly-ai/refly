import { useEffect, useCallback, useMemo } from 'react';
import { Empty, Avatar, Button, Typography, Tag } from 'antd';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import InfiniteScroll from 'react-infinite-scroll-component';
import {
  Spinner,
  EndMessage,
} from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import { useTranslation } from 'react-i18next';
import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { CanvasTemplate } from '@refly/openapi-schema';
import { IoPersonOutline } from 'react-icons/io5';
import { useCanvasTemplateModal } from '@refly/stores';
import { useDebouncedCallback } from 'use-debounce';
import { useNavigate } from 'react-router-dom';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';
import { staticPublicEndpoint } from '@refly/ui-kit';
import cn from 'classnames';
import { useUserStoreShallow } from '@refly/stores';
import { useAuthStoreShallow } from '@refly/stores';
import { logEvent } from '@refly/telemetry-web';

export const TemplateCard = ({
  template,
  className,
  showUser = true,
}: {
  template: CanvasTemplate;
  className?: string;
  showUser?: boolean;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setVisible: setModalVisible } = useCanvasTemplateModal((state) => ({
    setVisible: state.setVisible,
  }));
  const { duplicateCanvas, loading: duplicating } = useDuplicateCanvas();
  const isLogin = useUserStoreShallow((state) => state.isLogin);
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  const handlePreview = (e: React.MouseEvent<HTMLDivElement>) => {
    logEvent('home::template_preview', null, {
      templateId: template.templateId,
      templateName: template.title,
    });

    e.stopPropagation();
    if (template.shareId) {
      setModalVisible(false);
      navigate(`/preview/canvas/${template.shareId}`);
    }
  };

  const handleUse = (e: React.MouseEvent<HTMLDivElement>) => {
    logEvent('home::template_use', null, {
      templateId: template.templateId,
      templateName: template.title,
    });

    e.stopPropagation();
    if (!isLogin) {
      setLoginModalOpen(true);
      return;
    }
    if (template.shareId) {
      duplicateCanvas(template.shareId, template.templateId);
    }
  };

  return (
    <div
      className={`${className} m-2 flex flex-col group relative bg-refly-bg-content-z2 rounded-xl overflow-hidden cursor-pointer border-[0.5px] border-solid border-refly-Card-Border hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out h-[245px]`}
    >
      {template?.featured && (
        <Tag color="green" className="absolute top-2 right-0 z-10 shadow-sm">
          {t('common.featured')}
        </Tag>
      )}
      <div className="h-40 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
        <img
          src={`${staticPublicEndpoint}/share-cover/${template?.shareId}.png`}
          alt={`${template?.title} cover`}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="p-4 flex-1 flex flex-col gap-1">
        <div className="text-sm font-medium truncate">
          {template?.title || t('common.untitled')}
        </div>

        {showUser ? (
          <div className="flex items-center gap-1">
            <Avatar
              className="flex-shrink-0"
              size={18}
              src={template.shareUser?.avatar}
              icon={!template.shareUser?.avatar && <IoPersonOutline />}
            />
            <div className="truncate text-xs text-refly-text-1">
              {`@${template.shareUser?.name}`}
            </div>
          </div>
        ) : null}
      </div>

      {/* Hover overlay that slides up from bottom */}
      <div className="absolute left-0 bottom-0 w-full rounded-xl bg-refly-bg-glass-content backdrop-blur-[20px] shadow-refly-xl transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
        <div className="p-4 h-full flex flex-col justify-between">
          {/* Title and description section */}
          <div className="flex-1 flex flex-col gap-1">
            <div className="text-sm font-semibold text-refly-text-0 truncate">
              {template?.title || t('common.untitled')}
            </div>
            <Typography.Paragraph
              className="text-refly-text-2 text-xs !m-0"
              ellipsis={{ tooltip: true, rows: 4 }}
            >
              {template.description || t('template.noDescription')}
            </Typography.Paragraph>
          </div>

          {/* Action buttons section */}
          <div className="flex items-center justify-between gap-3 mt-3">
            <Button loading={duplicating} type="primary" className="flex-1" onClick={handleUse}>
              {t('template.use')}
            </Button>
            <Button type="default" className="w-20" onClick={handlePreview}>
              {t('template.preview')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TemplateListProps {
  source: 'front-page' | 'template-library';
  language: string;
  categoryId: string;
  searchQuery?: string;
  scrollableTargetId: string;
  className?: string;
}

export const TemplateList = ({
  source,
  language,
  categoryId,
  searchQuery,
  scrollableTargetId,
  className,
}: TemplateListProps) => {
  const { t } = useTranslation();
  const { visible } = useCanvasTemplateModal((state) => ({
    visible: state.visible,
  }));
  const { dataList, loadMore, reload, hasMore, isRequesting, setDataList } = useFetchDataList({
    fetchData: async (queryPayload) => {
      const res = await getClient().listCanvasTemplates({
        query: {
          language,
          categoryId: categoryId === 'my-templates' ? undefined : categoryId,
          scope: categoryId === 'my-templates' ? 'private' : 'private',
          ...queryPayload,
        },
      });
      return res?.data ?? { success: true, data: [] };
    },
    pageSize: 12,
  });

  useEffect(() => {
    if (!visible && source === 'template-library') return;
    reload();
  }, [language, categoryId]);

  useEffect(() => {
    if (source === 'front-page') return;
    visible ? reload() : setDataList([]);
  }, [visible]);

  const debounced = useDebouncedCallback(() => {
    reload();
  }, 300);

  useEffect(() => {
    debounced();
  }, [searchQuery]);

  const templateCards = useMemo(() => {
    return dataList?.map((item) => <TemplateCard key={item.templateId} template={item} />);
  }, [dataList]);

  const handleLoadMore = useCallback(() => {
    if (!isRequesting && hasMore) {
      loadMore();
    }
  }, [isRequesting, hasMore, loadMore]);

  const emptyState = (
    <div className="h-full flex items-center justify-center">
      <Empty description={t('template.emptyList')} />
    </div>
  );

  return (
    <div
      id={source === 'front-page' ? scrollableTargetId : undefined}
      className={cn('w-full h-full overflow-y-auto bg-gray-100 p-4 dark:bg-gray-700', className)}
    >
      <Spin className="spin" spinning={isRequesting && dataList.length === 0}>
        {dataList.length > 0 ? (
          <div
            id={source === 'template-library' ? scrollableTargetId : undefined}
            className="w-full h-full overflow-y-auto"
          >
            <InfiniteScroll
              dataLength={dataList.length}
              next={handleLoadMore}
              hasMore={hasMore}
              loader={<Spinner />}
              endMessage={<EndMessage />}
              scrollableTarget={scrollableTargetId}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {templateCards}
              </div>
            </InfiniteScroll>
          </div>
        ) : (
          !isRequesting && emptyState
        )}
      </Spin>
    </div>
  );
};

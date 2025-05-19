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
import { useCanvasTemplateModal } from '@refly-packages/ai-workspace-common/stores/canvas-template-modal';
import { useDebouncedCallback } from 'use-debounce';
import { useNavigate } from 'react-router-dom';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';
import { staticPublicEndpoint } from '@refly-packages/ai-workspace-common/utils/env';
import cn from 'classnames';

export const TemplateCard = ({
  template,
  className,
  showUser = true,
}: { template: CanvasTemplate; className?: string; showUser?: boolean }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setVisible: setModalVisible } = useCanvasTemplateModal((state) => ({
    setVisible: state.setVisible,
  }));
  const { duplicateCanvas, loading: duplicating } = useDuplicateCanvas();

  const handlePreview = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (template.shareId) {
      setModalVisible(false);
      navigate(`/preview/canvas/${template.shareId}`);
    }
  };

  const handleUse = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (template.shareId) {
      duplicateCanvas(template.shareId);
    }
  };

  return (
    <div
      className={`${className} m-2 group relative bg-white dark:bg-gray-900 rounded-lg overflow-hidden cursor-pointer shadow-sm hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out h-[245px]`}
    >
      {template?.featured && (
        <Tag color="green" className="absolute top-2 right-0 z-10 shadow-sm">
          {t('common.featured')}
        </Tag>
      )}
      <div className="h-40 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <img
          src={`${staticPublicEndpoint}/share-cover/${template?.shareId}.png`}
          alt={`${template?.title} cover`}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="px-3 py-1 text-[13px] font-medium truncate">
        <span>{template?.title || t('common.untitled')}</span>
      </div>

      {showUser ? (
        <div className="px-3 mb-2 flex items-center gap-1">
          <Avatar
            size={18}
            src={template.shareUser?.avatar}
            icon={!template.shareUser?.avatar && <IoPersonOutline />}
          />
          <div className="font-light truncate text-xs text-gray-500">{`@${template.shareUser?.name}`}</div>
        </div>
      ) : null}

      <div className="px-3 h-[20px]">
        <Typography.Paragraph
          className="text-gray-400 text-xs"
          ellipsis={{ tooltip: true, rows: 1 }}
        >
          {template.description || t('template.noDescription')}
        </Typography.Paragraph>
      </div>

      <div className="absolute left-0 bottom-0 w-full">
        <div className="absolute left-0 -top-8 w-full h-8 bg-gradient-to-b from-transparent to-white dark:to-gray-900 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        <div className="relative w-full h-16 py-2 px-4 bg-white dark:bg-gray-900 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-between gap-3">
          <Button
            type="default"
            className="flex-1 p-1 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={handlePreview}
          >
            {t('template.preview')}
          </Button>
          <Button
            loading={duplicating}
            type="primary"
            className="flex-1 p-1 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 delay-100"
            onClick={handleUse}
          >
            {t('template.use')}
          </Button>
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
          categoryId: categoryId === 'my-templates' ? null : categoryId,
          scope: categoryId === 'my-templates' ? 'private' : 'public',
          ...queryPayload,
        },
      });
      return res?.data;
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
      className={cn('w-full h-full overflow-y-auto bg-[#F8F9FA] p-4 dark:bg-gray-900', className)}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-2">
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

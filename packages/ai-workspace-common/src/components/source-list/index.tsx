import { Source } from '@refly/openapi-schema';
import { safeParseURL } from '@refly/utils/url';
import { Popover } from 'antd';
import { useTranslation } from 'react-i18next';

// 样式
import './index.scss';
import { IconRight } from '@arco-design/web-react/icon';
import { useKnowledgeBaseStoreShallow } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { getRuntime } from '@refly/utils/env';

interface SourceListProps {
  sources: Source[];
  query?: string;
}

const SourceItem = ({ source, index }: { source: Source; index: number }) => {
  const domain = safeParseURL(source?.url || '');
  const runtime = getRuntime();
  const isWeb = runtime === 'web';

  // Handle click based on source type
  const handleClick = () => {
    if (source?.metadata?.sourceType === 'library') {
      if (source.metadata?.entityType === 'resource') {
        // jumpToResource({ resId: source.metadata.entityId });
      } else if (source.metadata?.entityType === 'canvas') {
        // jumpToCanvas({
        //   canvasId: source.metadata?.entityId,
        //   projectId: source?.metadata?.projectId,
        // });
      }
    } else {
      // For web links, open in new tab
      window.open(source.url, '_blank');
    }
  };

  // Popover content with title, domain, icon and content
  const renderPopoverContent = () => (
    <div className="search-result-popover-content">
      {/* Title section */}
      <div className="flex items-center gap-2 mb-2">
        <h4
          className="font-medium text-base m-0 break-words overflow-hidden text-ellipsis whitespace-nowrap w-full dark:text-gray-200 dark:border-gray-700"
          title={source?.title ?? ''}
        >
          {source?.title ?? ''}
        </h4>
      </div>

      {/* Domain section */}
      {source?.url ? (
        <div className="flex items-center gap-2 mb-2 px-4">
          <img
            className="w-4 h-4 flex-shrink-0"
            alt={domain}
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${16}`}
          />
          <div
            className="text-zinc-400 text-sm break-all overflow-hidden text-ellipsis whitespace-nowrap max-w-[250px] dark:text-gray-200"
            title={domain}
          >
            {domain}
          </div>
        </div>
      ) : null}

      {/* Content section */}
      <div className="content-body pt-0 max-h-[300px] overflow-y-auto">
        <div
          className="line-clamp-6 overflow-hidden text-ellipsis dark:text-gray-500"
          title={source.pageContent}
        >
          {source.pageContent}
        </div>
      </div>
    </div>
  );

  return (
    <Popover
      content={renderPopoverContent()}
      placement={isWeb ? 'left' : 'top'}
      trigger="hover"
      overlayClassName="search-result-popover"
    >
      <div
        className="flex relative flex-col text-xs rounded-lg source-list-item cursor-pointer 
        hover:bg-gray-50 dark:hover:bg-gray-900
        border border-solid border-black/10 dark:border-white/10
        transition-all p-2"
        key={index}
        onClick={handleClick}
      >
        <div className="flex items-center gap-2 w-full">
          {/* Left section with number and title */}
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className="flex-shrink-0">{index + 1} ·</span>
            <span
              className="overflow-hidden text-ellipsis whitespace-nowrap font-medium text-zinc-950 dark:text-zinc-100"
              title={source?.title ?? ''}
            >
              {source?.title ?? ''}
            </span>
          </div>

          {/* Right section with domain and icon */}
          {source?.url ? (
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="overflow-hidden text-ellipsis whitespace-nowrap text-zinc-400 max-w-[120px]"
                title={domain}
              >
                {domain}
              </span>
              <img
                className="w-3 h-3 flex-shrink-0"
                alt={domain}
                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${16}`}
              />
            </div>
          ) : null}
        </div>
      </div>
    </Popover>
  );
};

const ViewMoreItem = ({
  sources = [],
  extraCnt = 0,
  onClick,
}: {
  sources: Source[];
  extraCnt: number;
  onClick: () => void;
}) => {
  const { t } = useTranslation();

  // Ensure we have a valid array and safely get the last items
  const extraSources = Array.isArray(sources)
    ? sources.slice(Math.max(sources.length - extraCnt, 0))
    : [];

  return (
    <div
      className="flex relative flex-col flex-wrap gap-2 justify-start items-start px-3 py-3 text-xs rounded-lg cursor-pointer 
      hover:bg-gray-50 source-list-item view-more-item border border-solid 
      border-black/10 transition-all dark:hover:bg-gray-900 dark:border-white/10"
      onClick={() => {
        onClick?.();
      }}
    >
      <div
        className="w-full overflow-hidden font-medium whitespace-nowrap text-ellipsis text-zinc-500 dark:text-zinc-400"
        title={t('copilot.sourceListModal.moreSources', { count: extraCnt })}
      >
        {t('copilot.sourceListModal.moreSources', { count: extraCnt })} <IconRight />
      </div>
      <div className="flex flex-wrap gap-1 max-w-full overflow-hidden">
        {extraSources.map((item, index) => {
          const url = item?.url;
          const domain = safeParseURL(url || '');

          if (!url) {
            return null;
          }

          return (
            <img
              key={index}
              className="flex-shrink-0 w-3 h-3"
              alt={url}
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${16}`}
            />
          );
        })}
      </div>
    </div>
  );
};

export const SourceList = (props: SourceListProps) => {
  const knowledgeBaseStore = useKnowledgeBaseStoreShallow((state) => ({
    updateSourceListDrawer: state.updateSourceListDrawer,
  }));

  const handleViewMore = () => {
    knowledgeBaseStore.updateSourceListDrawer({
      visible: true,
      sources: props?.sources ?? [],
      query: props?.query,
    });
  };

  const sources = props?.sources ?? [];

  return sources.length > 0 ? (
    <div className="session-source-content w-full overflow-hidden">
      <div className="session-source-list w-full max-w-full">
        {sources.slice(0, 3).map((item, index) => (
          <SourceItem key={index} index={index} source={item} />
        ))}
        {sources.length > 3 && (
          <ViewMoreItem
            onClick={handleViewMore}
            key="view-more"
            sources={sources}
            extraCnt={sources.slice(3).length}
          />
        )}
      </div>
    </div>
  ) : null;
};

import React from 'react';
import { List, Tag, Checkbox, Popover, Skeleton, Empty } from 'antd';
import { useMultilingualSearchStoreShallow } from '../stores/multilingual-search';
import { useTranslation } from 'react-i18next';
import './search-results.scss';
import { Source } from '@refly/openapi-schema';
import { TranslationWrapper } from '@refly-packages/ai-workspace-common/components/translation-wrapper';
import { SearchLocale } from '../stores/multilingual-search';
import { safeParseURL } from '@refly/utils/url';
import { AiOutlineGlobal, AiOutlineTranslation } from 'react-icons/ai';
import { defaultLocalesMap } from '../stores/multilingual-search';

interface SearchResultsProps {
  className?: string;
  outputLocale: SearchLocale;
  config?: {
    showCheckbox?: boolean;
    startIndex?: number;
    showIndex?: boolean;
    handleItemClick?: (item: Source) => void;
    enableTranslation?: boolean;
  };
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  className,
  outputLocale,
  config = {
    showCheckbox: true,
    startIndex: 1,
    showIndex: true,
    handleItemClick: (item) => window.open(item.url, '_blank'),
    enableTranslation: false,
  },
}) => {
  const { t, i18n } = useTranslation();
  const currentUiLocale = i18n.language as 'en' | 'zh-CN';
  const { results, selectedItems, toggleSelectedItem, isSearching } =
    useMultilingualSearchStoreShallow((state) => ({
      results: state.results,
      selectedItems: state.selectedItems,
      toggleSelectedItem: state.toggleSelectedItem,
      isSearching: state.isSearching,
    }));

  const renderPopoverContent = (item: Source) => {
    const domain = safeParseURL(item.url);
    return (
      <div className="search-result-popover-content">
        {/* Title section */}
        <div className="flex items-center gap-2 mb-2">
          <h4 className="font-medium text-base m-0 break-words dark:border-gray-700">
            <TranslationWrapper
              content={item.title || ''}
              targetLanguage={
                outputLocale.code === 'auto'
                  ? item.metadata?.translatedDisplayLocale
                  : outputLocale.code
              }
              className="dark:!text-gray-200"
              originalLocale={item.metadata?.originalLocale}
              enableTranslation={config.enableTranslation}
            />
          </h4>
        </div>

        {/* Domain section */}
        {item?.url ? (
          <div className="flex items-center gap-2 mb-2 px-4">
            <img
              className="w-4 h-4 flex-shrink-0"
              alt={domain}
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${16}`}
            />
            <div className="text-zinc-400 text-sm break-all">{domain}</div>
          </div>
        ) : null}

        {/* Content section */}
        <div className="content-body pt-0">
          <TranslationWrapper
            content={item.pageContent}
            targetLanguage={
              outputLocale.code === 'auto'
                ? item.metadata?.translatedDisplayLocale
                : outputLocale.code
            }
            originalLocale={item.metadata?.originalLocale}
            enableTranslation={config.enableTranslation}
          />
        </div>
      </div>
    );
  };

  const renderSkeletonItem = () => (
    <List.Item className="result-item">
      <div className="result-item-inner">
        <div className="result-details w-full">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <Skeleton.Input active className="!w-[400px] !mb-3" />
              <Skeleton paragraph={{ rows: 2 }} active />
            </div>
          </div>
        </div>
      </div>
    </List.Item>
  );

  const getLocaleName = (localeCode: string) => {
    const localeList = defaultLocalesMap[currentUiLocale];
    return localeList.find((locale) => locale.code === localeCode)?.name || localeCode;
  };

  return (
    <div className={`search-results ${className || ''}`}>
      <div className="search-results-content">
        {isSearching ? (
          <List className="search-results-skeleton-list">
            {[1, 2, 3].map((i) => (
              <React.Fragment key={i}>{renderSkeletonItem()}</React.Fragment>
            ))}
          </List>
        ) : results.length === 0 ? (
          <div className="search-results-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span className="text-gray-500">{t('resource.multilingualSearch.noResults')}</span>
              }
            />
          </div>
        ) : (
          <List
            bordered={false}
            dataSource={results}
            renderItem={(item, index) => (
              <List.Item className="result-item">
                <div className="result-item-inner">
                  {config.showCheckbox && (
                    <Checkbox
                      checked={selectedItems.includes(item)}
                      onChange={(e) => toggleSelectedItem(item, e.target.checked)}
                    />
                  )}
                  <Popover
                    content={renderPopoverContent(item)}
                    title={null}
                    placement="left"
                    overlayClassName="search-result-popover"
                    trigger="hover"
                    align={{ offset: [-50, 0] }}
                    mouseEnterDelay={0.5}
                  >
                    <div className="result-details" onClick={() => config.handleItemClick?.(item)}>
                      {config.showIndex && (
                        <div className="w-5">
                          <span className="h-8 w-8 inline-flex items-center justify-center origin-top-left scale-[60%] transform cursor-pointer rounded-full bg-zinc-100 text-center text-base font-medium no-underline hover:bg-zinc-300 dark:bg-gray-800 dark:hover:bg-gray-700">
                            {(config.startIndex || 1) + index}
                          </span>
                        </div>
                      )}
                      <div className="result-body w-full">
                        {item.metadata?.translatedDisplayLocale || item?.url ? (
                          <div className="result-header">
                            {item?.url ? (
                              <div className="site-info">
                                <img
                                  className="site-icon"
                                  src={`https://www.google.com/s2/favicons?domain=${safeParseURL(item.url)}&sz=32`}
                                  alt=""
                                />
                                <div className="site-meta">
                                  <a
                                    className="site-url text-gray-800 dark:text-gray-200"
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {item.url}
                                  </a>
                                </div>
                              </div>
                            ) : null}
                            {item.metadata?.translatedDisplayLocale && (
                              <Tag className="locale-tag">
                                <span>
                                  <AiOutlineGlobal /> {getLocaleName(item.metadata.originalLocale)}
                                </span>{' '}
                                →{' '}
                                <span>
                                  <AiOutlineTranslation />{' '}
                                  {getLocaleName(item.metadata.translatedDisplayLocale)}
                                </span>
                              </Tag>
                            )}
                          </div>
                        ) : null}

                        <div className="result-content">
                          <div className="result-title">
                            <TranslationWrapper
                              className="site-title"
                              content={item.title || ''}
                              targetLanguage={
                                outputLocale.code === 'auto'
                                  ? item.metadata?.translatedDisplayLocale
                                  : outputLocale.code
                              }
                              originalLocale={item.metadata?.originalLocale}
                              enableTranslation={config.enableTranslation}
                            />
                          </div>
                          <div className="result-content">
                            <TranslationWrapper
                              content={item.pageContent}
                              targetLanguage={
                                outputLocale.code === 'auto'
                                  ? item.metadata?.translatedDisplayLocale
                                  : outputLocale.code
                              }
                              originalLocale={item.metadata?.originalLocale}
                              enableTranslation={config.enableTranslation}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Popover>
                </div>
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
};

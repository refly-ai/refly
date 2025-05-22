import { useKnowledgeBaseStoreShallow } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { useEffect, useMemo, useState } from 'react';
import { message, Tabs, Drawer, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { Source } from '@refly/openapi-schema';
import { getPopupContainer } from '@refly-packages/ai-workspace-common/utils/ui';
import { getRuntime } from '@refly/utils/env';
import './index.scss';
import { LinkOutlined } from '@ant-design/icons';
import { SearchResults } from '@refly-packages/ai-workspace-common/modules/multilingual-search/components/search-results';
import {
  ActionMenu,
  ImportActionMode,
} from '@refly-packages/ai-workspace-common/modules/multilingual-search/components/action-menu';
import {
  defaultLocalesMap,
  SearchLocale,
  useMultilingualSearchStoreShallow,
} from '@refly-packages/ai-workspace-common/modules/multilingual-search/stores/multilingual-search';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { CloseOutlined } from '@ant-design/icons';
interface SourceListModalProps {
  classNames: string;
  width?: number;
  height?: string;
  placement?: 'bottom' | 'left' | 'right' | 'top';
}

export const SourceListModal = (props: SourceListModalProps) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('webSearch');
  const currentUiLocale = i18n.language as 'en' | 'zh-CN';
  const knowledgeBaseStore = useKnowledgeBaseStoreShallow((state) => ({
    sourceListDrawer: state.sourceListDrawer,
    updateSourceListDrawer: state.updateSourceListDrawer,
  }));

  const outputLocale: SearchLocale = useMemo(
    () => ({
      code: currentUiLocale,
      name:
        defaultLocalesMap[currentUiLocale].find((locale) => locale.code === currentUiLocale)
          ?.name || currentUiLocale,
    }),
    [currentUiLocale],
  );

  const { setResults, setIsSearching } = useMultilingualSearchStoreShallow((state) => ({
    setResults: state.setResults,
    setIsSearching: state.setIsSearching,
  }));

  const { readonly } = useCanvasContext();

  const runtime = getRuntime();
  const isWeb = runtime === 'web';
  const width = isWeb ? '50%' : props.width || '100%';
  const height = isWeb ? '100%' : props.height || '66%';

  const groupedSources = useMemo(() => {
    return (knowledgeBaseStore?.sourceListDrawer?.sources || []).reduce(
      (acc, source) => {
        const sourceType = source?.metadata?.sourceType || 'library';
        if (sourceType === 'webSearch') {
          acc.webSearch.push(source);
        } else {
          acc.library.push(source);
        }
        return acc;
      },
      { webSearch: [], library: [] } as { webSearch: Source[]; library: Source[] },
    );
  }, [knowledgeBaseStore?.sourceListDrawer?.sources]);

  const handleClose = () => {
    knowledgeBaseStore.updateSourceListDrawer({ visible: false });
    setResults([]);
    setIsSearching(false);
  };

  // Set default active tab based on available results
  useEffect(() => {
    if (groupedSources.webSearch.length === 0 && groupedSources.library.length > 0) {
      setActiveTab('library');
    }
  }, [groupedSources.webSearch.length, groupedSources.library.length]);

  useEffect(() => {
    if (activeTab === 'webSearch' && knowledgeBaseStore.sourceListDrawer.visible) {
      setResults(groupedSources.webSearch);
      setIsSearching(false);
    } else if (activeTab === 'library' && knowledgeBaseStore.sourceListDrawer.visible) {
      setResults(groupedSources.library);
      setIsSearching(false);
    } else {
      setResults([]);
      setIsSearching(false);
    }
  }, [
    knowledgeBaseStore.sourceListDrawer.visible,
    groupedSources.webSearch,
    groupedSources.library,
    activeTab,
  ]);

  return (
    <Drawer
      width={width}
      style={{
        zIndex: 66,
        height: height,
      }}
      getContainer={() => {
        const container = getPopupContainer();
        return !isWeb ? (container.querySelector('.ai-copilot-container') as Element) : container;
      }}
      className="source-list-modal"
      mask={false}
      maskClosable={false}
      closeIcon={null}
      title={
        <div className="source-list-modal-header flex items-center justify-between">
          <div>
            <div className="header-content">
              <LinkOutlined className="header-icon" />
              <div className="header-text">
                <div>
                  <span style={{ fontWeight: 'bold' }}>
                    {`${t('copilot.sourceListModal.title')} (${knowledgeBaseStore?.sourceListDrawer?.sources?.length || 0})`}
                  </span>
                </div>
              </div>
            </div>
            <div className="source-list-modal-header-title-message">
              {knowledgeBaseStore?.sourceListDrawer?.query}
            </div>
          </div>
          <Button icon={<CloseOutlined />} type="text" onClick={handleClose} />
        </div>
      }
      visible={knowledgeBaseStore.sourceListDrawer.visible}
      placement={isWeb ? 'right' : props.placement || 'bottom'}
      footer={null}
      onClose={handleClose}
    >
      <div className="source-list-modal-tabs">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          defaultActiveKey="webSearch"
          items={[
            ...(groupedSources.webSearch.length > 0
              ? [
                  {
                    key: 'webSearch',
                    label: (
                      <span>
                        {t('copilot.sourceListModal.webSearchTab')} (
                        {groupedSources.webSearch.length})
                      </span>
                    ),
                    children: (
                      <div className="source-list-modal-web-search">
                        <SearchResults
                          outputLocale={outputLocale}
                          config={{
                            showCheckbox: true,
                            showIndex: true,
                            handleItemClick: (item) => {
                              window.open(item.url, '_blank');
                            },
                            enableTranslation: false,
                          }}
                        />
                      </div>
                    ),
                  },
                ]
              : []),
            ...(groupedSources.library.length > 0
              ? [
                  {
                    key: 'library',
                    label: (
                      <span>
                        {t('copilot.sourceListModal.libraryTab')} ({groupedSources.library.length})
                      </span>
                    ),
                    children: (
                      <div className="source-list-modal-web-search">
                        <SearchResults
                          outputLocale={outputLocale}
                          config={{
                            showCheckbox: true,
                            showIndex: true,
                            startIndex: groupedSources.webSearch.length + 1,
                            handleItemClick: (item) => {
                              if (item?.url) {
                                window.open(item.url, '_blank');
                              } else {
                                message.warning(t('copilot.sourceListModal.noUrl'));
                              }
                            },
                            enableTranslation: false,
                          }}
                        />
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
        <div className="source-list-modal-action-menu-container">
          <ActionMenu
            disabled={readonly}
            importActionMode={
              activeTab === 'webSearch'
                ? ImportActionMode.CREATE_RESOURCE
                : ImportActionMode.ADD_NODE
            }
            getTarget={() => document.querySelector('.source-list-modal-tabs') as HTMLElement}
            sourceType="sourceListModal"
          />
        </div>
      </div>
    </Drawer>
  );
};

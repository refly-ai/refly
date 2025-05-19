import { useEffect } from 'react';
import { SearchBox } from './components/search-box';
import { SearchProgress } from './components/search-progress';
import { SearchResults } from './components/search-results';
import { ActionMenu, ImportActionMode } from './components/action-menu';
import { SearchHome } from './components/search-home';
import { useMultilingualSearchStoreShallow } from './stores/multilingual-search';
import './index.scss';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { TbWorldSearch } from 'react-icons/tb';

function MultilingualSearch() {
  const { t } = useTranslation();
  const { isSearching, results, outputLocale, pageState, resetAll, setPageState } =
    useMultilingualSearchStoreShallow((state) => ({
      isSearching: state.isSearching,
      results: state.results,
      outputLocale: state.outputLocale,
      pageState: state.pageState,
      resetAll: state.resetAll,
      setPageState: state.setPageState,
    }));

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetAll();
    };
  }, [resetAll]);

  const handleHomeClick = () => {
    resetAll();
    setPageState('home');
  };

  return (
    <div className="multilingual-search-container">
      <div className="intergration-header p-6">
        <div className="breadcrumb-nav">
          {pageState === 'results' ? (
            <>
              <div className="breadcrumb-item clickable" onClick={handleHomeClick}>
                <span className="menu-item-icon">
                  <SearchOutlined />
                </span>
                <span className="intergration-header-title">
                  {t('resource.import.fromWebSearch')}
                </span>
              </div>
              <span className="breadcrumb-separator">/</span>
              <div className="breadcrumb-item">
                <span className="intergration-header-title">
                  {t('resource.multilingualSearch.searchResults')}
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="menu-item-icon flex items-center justify-center text-white dark:text-dark">
                <TbWorldSearch className="text-lg" />
              </span>
              <span className="intergration-header-title text-white dark:text-dark">
                {t('resource.import.fromWebSearch')}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="multilingual-search-inner-container px-6 py-4">
        {pageState === 'home' ? (
          <SearchHome />
        ) : (
          <>
            <SearchBox />
            {isSearching || results?.length > 0 ? <SearchProgress /> : null}
            <SearchResults
              outputLocale={outputLocale}
              config={{ enableTranslation: true, showCheckbox: true, showIndex: true }}
            />
          </>
        )}
      </div>

      <div className="multilingual-search-action-menu-container">
        <ActionMenu
          getTarget={() => document.querySelector('.import-resource-right-panel') as HTMLElement}
          sourceType="multilingualSearch"
          importActionMode={ImportActionMode.CREATE_RESOURCE}
        />
      </div>
    </div>
  );
}

export default MultilingualSearch;

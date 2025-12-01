import { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { TemplateList } from '@refly-packages/ai-workspace-common/components/canvas-template/template-list';
import { TemplateCardSkeleton } from '@refly-packages/ai-workspace-common/components/canvas-template/template-card-skeleton';
import { canvasTemplateEnabled } from '@refly/ui-kit';
import { useSiderStoreShallow } from '@refly/stores';
import cn from 'classnames';
import { DocAdd, ArrowRight } from 'refly-icons';
import { RecentWorkflow } from './recent-workflow';
import { useListCanvasTemplateCategories } from '@refly-packages/ai-workspace-common/queries/queries';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';

const TAB_ORDER = [
  'Featured',
  'Sales',
  'Marketing',
  'Research',
  'Support',
  'Content Creation',
  'Business',
  'Education',
  'Development',
  'Design',
] as const;

const ModuleContainer = ({
  title,
  children,
  className,
  handleTitleClick,
}: {
  title: string;
  children?: React.ReactNode;
  className?: string;
  handleTitleClick?: () => void;
}) => {
  return (
    <div className={cn('flex flex-col gap-4 mb-10', className)}>
      <div className="text-[18px] leading-7 font-semibold text-refly-text-1 flex items-center gap-2 justify-between">
        {title}
        {handleTitleClick && (
          <Button className="!h-8 !w-8 p-0" type="text" size="small" onClick={handleTitleClick}>
            <ArrowRight size={20} />
          </Button>
        )}
      </div>
      {children}
    </div>
  );
};

export const FrontPage = memo(() => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { getCanvasList } = useHandleSiderData();

  const { canvasList, setIsManualCollapse } = useSiderStoreShallow((state) => ({
    canvasList: state.canvasList,
    setIsManualCollapse: state.setIsManualCollapse,
  }));
  const canvases = canvasList?.slice(0, 4);

  const { debouncedCreateCanvas, isCreating: createCanvasLoading } = useCreateCanvas({});

  const { data, isLoading: isLoadingCategories } = useListCanvasTemplateCategories({}, undefined, {
    enabled: true,
  });

  const currentLanguage = i18n.language;
  const [templateCategoryId, setTemplateCategoryId] = useState('');

  // Sort categories according to TAB_ORDER
  const templateCategories = useMemo(() => {
    const categories = [...(data?.data ?? [])].filter((category) => category.name !== 'top_picks');
    return categories.sort((a, b) => {
      // Get English label from labelDict (try 'en' or 'en-US')
      const getEnglishLabel = (category: (typeof categories)[0]) => {
        return category.labelDict?.en ?? category.labelDict?.['en-US'] ?? category.name ?? '';
      };

      const labelA = getEnglishLabel(a);
      const labelB = getEnglishLabel(b);

      // Find index in TAB_ORDER (case-insensitive)
      const indexA = TAB_ORDER.findIndex((order) => order.toLowerCase() === labelA.toLowerCase());
      const indexB = TAB_ORDER.findIndex((order) => order.toLowerCase() === labelB.toLowerCase());

      // If both found, sort by index
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only A found, A comes first
      if (indexA !== -1) {
        return -1;
      }
      // If only B found, B comes first
      if (indexB !== -1) {
        return 1;
      }
      // If neither found, maintain original order
      return 0;
    });
  }, [data?.data]);

  // Set default category to Featured when categories are loaded
  useEffect(() => {
    if (templateCategories.length > 0 && !templateCategoryId) {
      const featuredCategory = templateCategories.find((category) => {
        const englishLabel =
          category.labelDict?.en ?? category.labelDict?.['en-US'] ?? category.name ?? '';
        return englishLabel.toLowerCase() === 'featured';
      });

      if (featuredCategory) {
        setTemplateCategoryId(featuredCategory.categoryId);
      }
    }
  }, [templateCategories, templateCategoryId]);

  const handleNewWorkflow = useCallback(() => {
    setIsManualCollapse(false);
    debouncedCreateCanvas();
  }, [debouncedCreateCanvas, setIsManualCollapse]);

  const handleTemplateCategoryClick = useCallback(
    (categoryId: string) => {
      if (categoryId === templateCategoryId) return;
      setTemplateCategoryId(categoryId);
    },
    [templateCategoryId],
  );

  const handleViewGuide = useCallback(() => {
    if (currentLanguage === 'zh-CN') {
      window.open('https://powerformer.feishu.cn/wiki/KrI1wxCKiisumTkOLJbcLeY7nec', '_blank');
    } else {
      window.open(
        'https://www.notion.so/reflydoc/How-to-Use-Refly-ai-28cd62ce6071801f9b86e39bc50d3333',
        '_blank',
      );
    }
  }, [currentLanguage]);

  const handleViewAllWorkflows = useCallback(() => {
    navigate('/workflow-list');
  }, [navigate]);

  const handleViewMarketplace = useCallback(() => {
    window.open('/workflow-marketplace', '_blank');
  }, []);

  useEffect(() => {
    getCanvasList();
  }, []);

  return (
    <div
      className={cn(
        'w-full h-full bg-refly-bg-content-z2 overflow-y-auto p-5 rounded-xl border border-solid border-refly-Card-Border',
      )}
      id="front-page-scrollable-div"
    >
      <Helmet>
        <title>{t('loggedHomePage.siderMenu.home')}</title>
      </Helmet>
      <div className="p-4 rounded-xl flex flex-wrap items-center gap-6 bg-gradient-tools-open bg-refly-bg-body-z0 dark:bg-gradient-to-br dark:from-emerald-500/20 dark:via-cyan-500/15 dark:to-blue-500/10 dark:bg-refly-bg-body-z0">
        <div className="text-xl leading-7">
          <span className="text-refly-primary-default font-[800] mr-2">
            {t('frontPage.guide.title')}
          </span>
          <span className="text-refly-text-0">{t('frontPage.guide.description')}</span>
        </div>
        <Button type="primary" onClick={handleViewGuide} className="font-semibold">
          {t('frontPage.guide.view')}
        </Button>
      </div>

      <ModuleContainer title={t('frontPage.newWorkflow.title')} className="mt-[120px]">
        <Button
          className="w-fit h-fit flex items-center gap-2  border-[1px] border-solid border-refly-Card-Border rounded-xl p-3 cursor-pointer bg-transparent hover:bg-refly-fill-hover transition-colors"
          onClick={handleNewWorkflow}
          loading={createCanvasLoading}
        >
          <DocAdd size={42} color="var(--refly-primary-default)" />
          <div className="flex flex-col gap-1 w-[184px]">
            <div className="text-left text-base leading-[26px] font-semibold text-refly-text-0">
              {t('frontPage.newWorkflow.buttonText')}
            </div>
            <div className="text-left text-xs text-refly-text-3 leading-4 font-normal">
              {t('frontPage.newWorkflow.buttonDescription')}
            </div>
          </div>
        </Button>
      </ModuleContainer>

      {canvases?.length > 0 && (
        <ModuleContainer
          title={t('frontPage.recentWorkflows.title')}
          handleTitleClick={handleViewAllWorkflows}
        >
          <RecentWorkflow canvases={canvases} />
        </ModuleContainer>
      )}

      {canvasTemplateEnabled && (
        <ModuleContainer
          title={t('frontPage.template.title')}
          handleTitleClick={handleViewMarketplace}
        >
          {templateCategories.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {templateCategories.map((category) => (
                <div
                  key={category.categoryId}
                  className={cn(
                    'flex-shrink-0 whitespace-nowrap px-3 py-1.5 text-sm leading-5 cursor-pointer rounded-[40px] transition-all duration-300 ease-in-out transform',
                    {
                      '!bg-refly-primary-default text-white font-semibold shadow-sm scale-105':
                        category.categoryId === templateCategoryId,
                      'text-refly-text-0 hover:bg-refly-tertiary-hover hover:scale-[1.02]':
                        category.categoryId !== templateCategoryId,
                    },
                  )}
                  onClick={() => handleTemplateCategoryClick(category.categoryId)}
                >
                  {category.labelDict?.[currentLanguage]}
                </div>
              ))}
            </div>
          )}

          <div className="flex-1">
            {!templateCategoryId || isLoadingCategories ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <TemplateCardSkeleton key={index} />
                ))}
              </div>
            ) : (
              <TemplateList
                source="front-page"
                scrollableTargetId="front-page-scrollable-div"
                language={currentLanguage}
                categoryId={templateCategoryId}
                className="!bg-transparent !px-0 !pt-0 -ml-2 -mt-2"
              />
            )}
          </div>
        </ModuleContainer>
      )}
    </div>
  );
});

FrontPage.displayName = 'FrontPage';

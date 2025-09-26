import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { TemplateList } from '@refly-packages/ai-workspace-common/components/canvas-template/template-list';
import { canvasTemplateEnabled } from '@refly/ui-kit';
import { useCanvasTemplateModalShallow, useSiderStoreShallow } from '@refly/stores';
import cn from 'classnames';
import { DocInline, ArrowRight } from 'refly-icons';
import { RecentWorkflow } from './recent-workflow';
import { useListCanvasTemplateCategories } from '@refly-packages/ai-workspace-common/queries/queries';

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

export const FrontPage = memo(({ projectId }: { projectId: string | null }) => {
  const { t, i18n } = useTranslation();
  console.log('projectId', projectId);
  const { canvasList } = useSiderStoreShallow((state) => ({
    canvasList: state.canvasList,
  }));
  const canvases = canvasList?.slice(0, 4);

  const { data } = useListCanvasTemplateCategories({}, undefined, {
    enabled: true,
  });
  const templateCategories = data?.data ?? [];

  const templateLanguage = i18n.language;
  const templateCategoryId = templateCategories[0]?.categoryId ?? '';

  const { setVisible: setCanvasTemplateModalVisible } = useCanvasTemplateModalShallow((state) => ({
    setVisible: state.setVisible,
  }));

  const handleViewAllTemplates = useCallback(() => {
    setCanvasTemplateModalVisible(true);
  }, [setCanvasTemplateModalVisible]);

  const handleNewWorkflow = useCallback(() => {
    console.log('handleNewWorkflow');
  }, []);

  return (
    <div
      className={cn(
        'w-full h-full bg-refly-bg-content-z2 overflow-y-auto p-5 rounded-xl border border-solid border-refly-Card-Border',
      )}
      id="front-page-scrollable-div"
    >
      <div
        className="p-4 rounded-xl flex items-center gap-6"
        style={{
          background:
            'linear-gradient(124deg, rgba(31, 201, 150, 0.10) 0%, rgba(69, 190, 255, 0.06) 24.85%), var(--bg-refly-bg-body-z0, #FFF)',
        }}
      >
        <div className="text-xl leading-7">
          <span className="text-refly-primary-default font-[800] mr-2">
            {t('frontPage.guide.title')}
          </span>
          <span className="text-refly-text-0">{t('frontPage.guide.description')}</span>
        </div>
        <Button type="primary">{t('frontPage.guide.view')}</Button>
      </div>

      <ModuleContainer title={t('frontPage.newWorkflow.title')} className="mt-[120px]">
        <div
          className="w-fit flex items-center gap-2  border-[0.5px] border-solid border-refly-Card-Border rounded-xl p-3 cursor-pointer hover:bg-refly-fill-hover transition-colors"
          onClick={handleNewWorkflow}
        >
          <DocInline size={42} color="var(--refly-primary-default)" />
          <div className="flex flex-col gap-1">
            <div className="text-base leading-[26px] font-semibold text-refly-text-0">
              {t('frontPage.newWorkflow.buttonText')}
            </div>
            <div className="text-xs text-refly-text-3 leading-4">
              {t('frontPage.newWorkflow.buttonDescription')}
            </div>
          </div>
        </div>
      </ModuleContainer>

      {canvases?.length > 0 && (
        <ModuleContainer title={t('frontPage.recentWorkflows.title')}>
          <RecentWorkflow canvases={canvases} />
        </ModuleContainer>
      )}

      {canvasTemplateEnabled && (
        <ModuleContainer
          title={t('frontPage.template.title')}
          handleTitleClick={handleViewAllTemplates}
        >
          <div className="flex items-center gap-2">
            {templateCategories.map((category) => (
              <div key={category.categoryId} className="text-xs text-refly-text-3 leading-4">
                {category.labelDict[templateLanguage]}
              </div>
            ))}
          </div>
          <div className="flex-1">
            <TemplateList
              source="front-page"
              scrollableTargetId="front-page-scrollable-div"
              language={templateLanguage}
              categoryId={templateCategoryId}
              className="!bg-transparent !px-0"
            />
          </div>
        </ModuleContainer>
      )}
    </div>
  );
});

FrontPage.displayName = 'FrontPage';

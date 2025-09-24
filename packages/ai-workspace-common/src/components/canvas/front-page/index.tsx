import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { TemplateList } from '@refly-packages/ai-workspace-common/components/canvas-template/template-list';
import { canvasTemplateEnabled } from '@refly/ui-kit';
import { useCanvasTemplateModalShallow, useSiderStoreShallow } from '@refly/stores';
import cn from 'classnames';
import { IconRight } from '@refly-packages/ai-workspace-common/components/common/icon';
import { DocInline } from 'refly-icons';
import { RecentWorkflow } from './recent-workflow';

const ModuleContainer = ({
  title,
  children,
  className,
}: { title: string; children?: React.ReactNode; className?: string }) => {
  return (
    <div className={cn('flex flex-col gap-4 mb-10', className)}>
      <div className="text-[18px] leading-7 font-semibold text-refly-text-1">{title}</div>
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

  const templateLanguage = i18n.language;
  const templateCategoryId = '';

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
        'w-full h-full bg-refly-bg-content-z2 overflow-y-auto rounded-lg border border-solid border-refly-Card-Border shadow-sm p-5',
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
          className="w-fit flex items-center gap-2  border-[0.5px] border-solid border-refly-Card-Border rounded-xl p-3 cursor-pointer hover:border-refly-primary-default hover:shadow-refly-m transition-colors"
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
        <div className="h-full flex flex-col mt-10">
          <div className="flex justify-between items-center mx-2">
            <div>
              <h3 className="text-base font-medium">{t('frontPage.fromCommunity')}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('frontPage.fromCommunityDesc')}</p>
            </div>
            <Button
              type="text"
              size="small"
              className="text-xs text-gray-500 gap-1 hover:!text-green-500 transition-colors"
              onClick={handleViewAllTemplates}
            >
              {t('common.viewAll')} <IconRight className="w-3 h-3" />
            </Button>
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
        </div>
      )}
    </div>
  );
});

FrontPage.displayName = 'FrontPage';

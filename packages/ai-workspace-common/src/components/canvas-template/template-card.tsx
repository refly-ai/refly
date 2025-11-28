import { useUserStoreShallow, useAuthStoreShallow } from '@refly/stores';
import { logEvent } from '@refly/telemetry-web';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';
import { CanvasTemplate } from '@refly/openapi-schema';
import { IoPersonOutline } from 'react-icons/io5';
import { Avatar, Button, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCanvasTemplateModal } from '@refly/stores';
import { cn } from '@refly/utils/cn';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { WiTime3 } from 'react-icons/wi';
import { LOCALE } from '@refly/common-types';
import { useCallback } from 'react';

interface TemplateCardProps {
  template: CanvasTemplate;
  className?: string;
  showUser?: boolean;
}

export const TemplateCard = ({ template, className, showUser = true }: TemplateCardProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.languages?.[0];
  const { setVisible: setModalVisible } = useCanvasTemplateModal((state) => ({
    setVisible: state.setVisible,
  }));
  const { duplicateCanvas, loading: duplicating } = useDuplicateCanvas();
  const isLogin = useUserStoreShallow((state) => state.isLogin);
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  const handlePreview = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      logEvent('home::template_preview', null, {
        templateId: template.templateId,
        templateName: template.title,
      });

      if (template.shareId) {
        setModalVisible(false);
        window.open(`/app/${template.shareId}`, '_blank');
        return;
      }
    },
    [template, setModalVisible],
  );

  const handleUse = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      logEvent('home::template_use', null, {
        templateId: template.templateId,
        templateName: template.title,
      });

      if (!isLogin) {
        setLoginModalOpen(true);
        return;
      }
      if (template.shareId) {
        duplicateCanvas({ shareId: template.shareId, templateId: template.templateId });
      }
    },
    [template, duplicateCanvas, isLogin, setLoginModalOpen],
  );

  return (
    <div
      className={`${className} m-2 flex flex-col group relative bg-refly-bg-content-z2 rounded-xl overflow-hidden cursor-pointer border-[0.5px] border-solid border-refly-Card-Border hover:shadow-lg transition-all duration-200 ease-in-out h-[245px]`}
      onClick={handlePreview}
    >
      <div className="h-40 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
        <img
          src={`${template.coverUrl}`}
          alt={`${template?.title} cover`}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between gap-1">
        <div className="text-sm font-medium truncate">
          {template?.title ?? t('common.untitled')}
        </div>

        <div
          className={cn(
            'flex items-center justify-between gap-2',
            showUser ? 'justify-between' : 'justify-end',
          )}
        >
          {showUser ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <Avatar
                className="flex-shrink-0"
                size={18}
                src={template.shareUser?.avatar}
                icon={!template.shareUser?.avatar && <IoPersonOutline />}
              />
              <div className="truncate text-xs text-refly-text-2">
                {template.shareUser?.nickname
                  ? template.shareUser?.nickname
                  : `@${template.shareUser?.name}`}
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-1 flex-shrink-0">
            <WiTime3 className="w-4 h-4 text-refly-text-2" />
            <span className="text-refly-text-2 text-xs leading-4 whitespace-nowrap">
              {time(template.updatedAt, language as LOCALE)
                ?.utc()
                ?.fromNow()}
            </span>
          </div>
        </div>
      </div>

      {/* Hover overlay that slides up from bottom */}
      <div className="absolute left-0 bottom-0 w-full rounded-xl bg-refly-bg-glass-content backdrop-blur-[20px] shadow-refly-xl transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
        <div className="p-4 h-full flex flex-col justify-between">
          {/* Title and description section */}
          <div className="flex-1 flex flex-col gap-1">
            <div className="text-sm font-semibold text-refly-text-0 truncate">
              {template?.title ?? t('common.untitled')}
            </div>
            <Typography.Paragraph
              className="text-refly-text-2 text-xs !m-0"
              ellipsis={{ tooltip: true, rows: 4 }}
            >
              {template.description ?? t('template.noDescription')}
            </Typography.Paragraph>
          </div>

          {/* Action buttons section */}
          <div className="flex items-center justify-between gap-3 mt-3">
            <Button
              loading={duplicating}
              type="primary"
              className="flex-1 px-2"
              onClick={handleUse}
            >
              {t('template.use')}
            </Button>

            {template.shareId && (
              <Button type="default" className="min-w-20 px-2" onClick={handlePreview}>
                {t('template.preview')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

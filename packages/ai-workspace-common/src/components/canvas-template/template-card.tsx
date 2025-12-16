import { useUserStoreShallow, useAuthStoreShallow } from '@refly/stores';
import { logEvent } from '@refly/telemetry-web';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';
import { CanvasTemplate } from '@refly/openapi-schema';
import { Button, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCanvasTemplateModal } from '@refly/stores';
import { useCallback, useState, useMemo, useEffect } from 'react';
import type { SyntheticEvent } from 'react';
import { AVATAR_PLACEHOLDER_IMAGE, CARD_PLACEHOLDER_IMAGE } from './constants';
import diamondIcon from '@refly-packages/ai-workspace-common/assets/diamond.svg';

interface TemplateCardProps {
  template: CanvasTemplate;
  className?: string;
  showUser?: boolean;
}

export const TemplateCard = ({ template, className, showUser = true }: TemplateCardProps) => {
  const { t } = useTranslation();
  const { setVisible: setModalVisible } = useCanvasTemplateModal((state) => ({
    setVisible: state.setVisible,
  }));
  const { duplicateCanvas, loading: duplicating } = useDuplicateCanvas();
  const isLogin = useUserStoreShallow((state) => state.isLogin);
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  const getValidImageSrc = useCallback((url: string | undefined | null): string => {
    if (url && url.trim() !== '') {
      return url;
    }
    return CARD_PLACEHOLDER_IMAGE;
  }, []);

  const [imageSrc, setImageSrc] = useState(() => getValidImageSrc(template?.coverUrl));

  useEffect(() => {
    setImageSrc(getValidImageSrc(template.coverUrl));
  }, [template.coverUrl, getValidImageSrc]);

  const handleImageError = useCallback(() => {
    setImageSrc((previous) => {
      if (previous === CARD_PLACEHOLDER_IMAGE) {
        return previous;
      }
      return CARD_PLACEHOLDER_IMAGE;
    });
  }, []);

  const handleAuthorAvatarError = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.src !== AVATAR_PLACEHOLDER_IMAGE) {
      event.currentTarget.src = AVATAR_PLACEHOLDER_IMAGE;
    }
  }, []);

  const author = useMemo(() => {
    if (template.shareUser) {
      return template.shareUser.nickname || template.shareUser.name || t('common.unknown');
    }
    return t('common.unknown');
  }, [template.shareUser, t]);

  const authorAvatar = useMemo(() => {
    return template.shareUser?.avatar || AVATAR_PLACEHOLDER_IMAGE;
  }, [template.shareUser]);

  const formattedDate = useMemo(() => {
    if (!template.createdAt) {
      return '';
    }
    const date = new Date(template.createdAt);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }, [template.createdAt]);

  const points = String(template.creditUsage ?? 0);

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
      className={`${className ?? ''} w-full h-[262px] rounded-[12px] border-[0.5px] overflow-hidden flex flex-col cursor-pointer group relative transition-shadow duration-200 ease-out hover:shadow-[0px_8px_24px_0px_var(--refly-modal-mask)]`}
      style={{
        borderRadius: '12px',
        border: '0.5px solid var(--refly-Card-Border)',
        background: 'var(--refly-bg-content-z2)',
      }}
      onClick={handlePreview}
    >
      <div className="relative w-full h-[160px] overflow-hidden flex-shrink-0">
        <img
          src={imageSrc}
          alt={template.title}
          className="w-full h-full object-cover transform-gpu transition-transform duration-300 ease-out will-change-transform group-hover:scale-[1.05]"
          onError={handleImageError}
        />
        <div className="absolute inset-0" />
      </div>

      <div className="flex-1 p-4 flex flex-col gap-2 h-[102px] flex-shrink-0">
        <div className="flex items-start justify-between min-h-[18px]">
          <h3
            className="text-sm font-semibold leading-[1.4285714285714286em] text-foreground flex-1 line-clamp-1"
            style={{ fontFamily: 'PingFang SC, sans-serif' }}
          >
            {template?.title ?? t('common.untitled')}
          </h3>
        </div>

        <div className="flex items-center gap-[6px] flex-shrink-0">
          {showUser && (
            <>
              <img
                src={authorAvatar}
                alt={author}
                className="w-4 h-4 rounded-full border-[0.5px] border-refly-Card-Border flex-shrink-0"
                onError={handleAuthorAvatarError}
              />
              <span
                className="text-[11px] leading-[1.4545454545454546em] text-refly-text-2 flex-shrink-0"
                style={{ fontFamily: 'Open Sans, sans-serif' }}
              >
                {author}
              </span>
              <div className="w-px h-[10px] rounded-[3px] bg-refly-line flex-shrink-0" />
            </>
          )}
          <span
            className="text-[11px] leading-[1.4545454545454546em] text-refly-text-2 flex-shrink-0"
            style={{ fontFamily: 'Open Sans, sans-serif' }}
          >
            {formattedDate}
          </span>
        </div>

        <div className="flex items-center justify-between mt-auto flex-shrink-0">
          <div className="flex items-center gap-[2px]">
            <img
              src={diamondIcon}
              alt="price"
              className="w-3.5 h-3.5 flex-shrink-0"
              style={{ filter: 'var(--refly-icon-filter, none)' }}
            />
            <span
              className="text-base font-semibold leading-[1em] text-refly-text-0 flex-shrink-0"
              style={{ fontFamily: 'Open Sans, sans-serif' }}
            >
              {points}
            </span>
            <span
              className="text-xs leading-[1.3333333333333333em] text-refly-text-caption flex-shrink-0"
              style={{ fontFamily: 'Open Sans, sans-serif' }}
            >
              {t('template.perRun', { defaultValue: '/run' })}
            </span>
          </div>
        </div>
      </div>

      {/* Hover overlay that slides up from bottom */}
      <div className="absolute left-0 bottom-0 w-full rounded-[12px] bg-refly-bg-glass-content backdrop-blur-[20px] shadow-refly-xl transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
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
            {
              <Button
                loading={duplicating}
                type="primary"
                className="flex-1 px-2"
                onClick={handleUse}
              >
                {t('template.use')}
              </Button>
            }

            {template.shareId && (
              <Button type="primary" className="flex-1 min-w-20 px-2" onClick={handlePreview}>
                {t('template.preview')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

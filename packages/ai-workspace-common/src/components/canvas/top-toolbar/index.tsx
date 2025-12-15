import { FC, memo, useCallback, useState } from 'react';
import { useMatch } from 'react-router-dom';
import { Button, Divider, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { LOCALE } from '@refly/common-types';
import { useCanvasStoreShallow } from '@refly/stores';
import { Helmet } from 'react-helmet';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { CanvasTitle, ReadonlyCanvasTitle, type CanvasTitleMode } from './canvas-title';
// import ShareSettings from './share-settings';
import PublishTemplateButton from './publish-template-button';
import { useUserStoreShallow } from '@refly/stores';
import './index.scss';
import { IconLink } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Copy } from 'refly-icons';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';
import { useAuthStoreShallow } from '@refly/stores';
import { logEvent } from '@refly/telemetry-web';
import { ActionsInCanvasDropdown } from '@refly-packages/ai-workspace-common/components/canvas/top-toolbar/actions-in-canvas-dropdown';
import { SettingItem } from '@refly-packages/ai-workspace-common/components/canvas/front-page';
import { GithubStar } from '@refly-packages/ai-workspace-common/components/common/github-star';

interface TopToolbarProps {
  canvasId: string;
}

export const TopToolbar: FC<TopToolbarProps> = memo(({ canvasId }) => {
  const { i18n, t } = useTranslation();
  const language = i18n.language as LOCALE;
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  const [canvasTitleMode, setCanvasTitleMode] = useState<CanvasTitleMode>('view');

  const isShareCanvas = useMatch('/share/canvas/:canvasId');
  const isPreviewCanvas = useMatch('/preview/canvas/:shareId');

  const { loading, readonly, shareData, syncFailureCount } = useCanvasContext();

  const { canvasInitialized, canvasTitle: canvasTitleFromStore } = useCanvasStoreShallow(
    (state) => ({
      canvasInitialized: state.canvasInitialized[canvasId],
      canvasTitle: state.canvasTitle[canvasId],
    }),
  );

  const canvasTitle = shareData?.title || canvasTitleFromStore;

  const { duplicateCanvas, loading: duplicating } = useDuplicateCanvas();

  const handleDuplicate = () => {
    logEvent('remix_workflow_share', Date.now(), {
      canvasId,
    });

    if (!isLogin) {
      setLoginModalOpen(true);
      return;
    }
    duplicateCanvas({ shareId: canvasId });
  };

  const handleRename = useCallback(() => {
    setCanvasTitleMode('edit');
  }, [setCanvasTitleMode]);

  return (
    <>
      <Helmet>
        <title>{canvasTitle?.toString() || t('common.untitled')} · Refly</title>
        {shareData?.minimapUrl && <meta property="og:image" content={shareData.minimapUrl} />}
      </Helmet>

      <div className=" h-[42px] pb-2 box-border flex justify-between items-center bg-transparent">
        <div className="flex items-center gap-2">
          {readonly ? (
            <ReadonlyCanvasTitle
              canvasTitle={canvasTitle}
              isLoading={false}
              owner={shareData?.owner}
            />
          ) : (
            <div className="flex items-center gap-2">
              <ActionsInCanvasDropdown
                canvasId={canvasId}
                canvasName={canvasTitle}
                onRename={handleRename}
              />

              <Divider type="vertical" className="m-0 h-5 bg-refly-Card-Border" />

              <CanvasTitle
                mode={canvasTitleMode}
                setMode={setCanvasTitleMode}
                canvasTitle={canvasTitle}
                canvasLoading={loading || !canvasInitialized}
                language={language}
                syncFailureCount={syncFailureCount}
                canvasId={canvasId}
              />

              <Divider type="vertical" className="m-0 h-5 bg-refly-Card-Border" />
              <GithubStar />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isPreviewCanvas ? (
            <Button
              loading={duplicating}
              type="primary"
              icon={<Copy size={16} />}
              onClick={handleDuplicate}
            >
              {t('template.use')}
            </Button>
          ) : isShareCanvas ? (
            <>
              <Button loading={duplicating} icon={<Copy size={16} />} onClick={handleDuplicate}>
                {t('template.duplicateCanvas')}
              </Button>
              <Button
                type="primary"
                icon={<IconLink className="flex items-center" />}
                onClick={() => {
                  logEvent('duplicate_workflow_share', Date.now(), {
                    canvasId,
                    shareUrl: window.location.href,
                  });
                  navigator.clipboard.writeText(window.location.href);
                  message.success(t('shareContent.copyLinkSuccess'));
                }}
              >
                {t('canvas.toolbar.copyLink')}
              </Button>
            </>
          ) : (
            <>
              {/* <ShareSettings canvasId={canvasId} canvasTitle={canvasTitle} /> */}
              <PublishTemplateButton canvasId={canvasId} canvasTitle={canvasTitle} />
            </>
          )}
          <div className="group relative">
            <SettingItem showName={false} avatarAlign={'right'} />
          </div>
        </div>
      </div>
    </>
  );
});

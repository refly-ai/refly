import { FC, memo, useCallback, useState } from 'react';
import { useMatch } from 'react-router-dom';
import { Button, Divider, message } from 'antd';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useTranslation } from 'react-i18next';
import { LOCALE } from '@refly/common-types';
import { useCanvasStoreShallow } from '@refly/stores';
import { Helmet } from 'react-helmet';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { CanvasTitle, ReadonlyCanvasTitle, type CanvasTitleMode } from './canvas-title';
import { ToolbarButtons } from './buttons';
import ShareSettings from './share-settings';
import { useUserStoreShallow } from '@refly/stores';
import './index.scss';
import { IconLink } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Copy, Play } from 'refly-icons';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';
import { useAuthStoreShallow } from '@refly/stores';
import { TooltipButton } from './buttons';
import { ToolsDependency } from '../tools-dependency';
import cn from 'classnames';
import { logEvent } from '@refly/telemetry-web';
import { ActionsInCanvasDropdown } from '@refly-packages/ai-workspace-common/components/canvas/top-toolbar/actions-in-canvas-dropdown';

const buttonClass = '!p-0 h-[30px] w-[30px] flex items-center justify-center ';

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
  const { showWorkflowRun, setShowWorkflowRun } = useCanvasResourcesPanelStoreShallow((state) => ({
    showWorkflowRun: state.showWorkflowRun,
    setShowWorkflowRun: state.setShowWorkflowRun,
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

  const handleInitializeWorkflow = () => {
    if (!isLogin) {
      setLoginModalOpen(true);
      return;
    }
    setShowWorkflowRun(!showWorkflowRun);
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
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!readonly && !isPreviewCanvas && (
            <TooltipButton
              tooltip={t('canvas.toolbar.tooltip.initializeWorkflow') || 'Initialize Workflow'}
              onClick={handleInitializeWorkflow}
              className={cn(buttonClass, showWorkflowRun && '!bg-gradient-tools-open')}
            >
              <Play
                size={16}
                color={showWorkflowRun ? 'var(--refly-primary-default)' : 'var(--refly-text-0)'}
              />
            </TooltipButton>
          )}

          <ToolsDependency canvasId={canvasId} />

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
              <ShareSettings canvasId={canvasId} canvasTitle={canvasTitle} />
            </>
          )}

          <ToolbarButtons />
        </div>
      </div>
    </>
  );
});

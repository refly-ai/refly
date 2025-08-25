import { FC, memo } from 'react';
import { useMatch } from 'react-router-dom';
import { Button, Divider, message } from 'antd';
import { useSiderStoreShallow } from '@refly/stores';
import { useTranslation } from 'react-i18next';
import { LOCALE } from '@refly/common-types';
import { SiderPopover } from '@refly-packages/ai-workspace-common/components/sider/popover';
import { useCanvasStoreShallow } from '@refly/stores';
import { Helmet } from 'react-helmet';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { CanvasTitle, ReadonlyCanvasTitle } from './canvas-title';
import { ToolbarButtons, type Mode } from './buttons';
import { CanvasActionDropdown } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal/canvasActionDropdown';
import ShareSettings from './share-settings';
import { useUserStoreShallow } from '@refly/stores';
import './index.scss';
import { IconLink } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Undo, Redo, Copy, Play } from 'refly-icons';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';
import { useAuthStoreShallow } from '@refly/stores';
import { CanvasLayoutControls } from '@refly-packages/ai-workspace-common/components/canvas/layout-control/canvas-layout-controls';
import { TooltipButton } from './buttons';
import { useInitializeWorkflow } from '@refly-packages/ai-workspace-common/hooks/use-initialize-workflow';

const buttonClass = '!p-0 h-[30px] w-[30px] flex items-center justify-center ';

interface TopToolbarProps {
  canvasId: string;
  mode: Mode;
  changeMode: (mode: Mode) => void;
}

const ToolContainer = memo(({ children }: { children: React.ReactNode }) => {
  return (
    <div className="h-12 box-border p-2 flex items-center gap-2 relative z-10 bg-refly-bg-content-z2 rounded-xl border-[1px] border-solid border-refly-Card-Border shadow-refly-m">
      {children}
    </div>
  );
});

export const TopToolbar: FC<TopToolbarProps> = memo(({ canvasId, mode, changeMode }) => {
  const { i18n, t } = useTranslation();
  const language = i18n.language as LOCALE;
  const { collapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
  }));
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));
  const isShareCanvas = useMatch('/share/canvas/:canvasId');
  const isPreviewCanvas = useMatch('/preview/canvas/:shareId');

  const { loading, readonly, shareData, undo, redo, syncFailureCount } = useCanvasContext();

  const { canvasInitialized, canvasTitle: canvasTitleFromStore } = useCanvasStoreShallow(
    (state) => ({
      canvasInitialized: state.canvasInitialized[canvasId],
      canvasTitle: state.canvasTitle[canvasId],
    }),
  );

  const canvasTitle = shareData?.title || canvasTitleFromStore;

  const { duplicateCanvas, loading: duplicating } = useDuplicateCanvas();
  const {
    initializeWorkflow,
    initializeWorkflowInNewCanvas,
    loading: initializing,
    newModeLoading,
  } = useInitializeWorkflow();

  const handleDuplicate = () => {
    if (!isLogin) {
      setLoginModalOpen(true);
      return;
    }
    duplicateCanvas(canvasId);
  };

  const handleInitializeWorkflow = () => {
    if (!isLogin) {
      setLoginModalOpen(true);
      return;
    }
    initializeWorkflow(canvasId);
  };

  const handleInitializeWorkflowInNewCanvas = () => {
    if (!isLogin) {
      setLoginModalOpen(true);
      return;
    }
    initializeWorkflowInNewCanvas(canvasId);
  };

  return (
    <>
      <Helmet>
        <title>{canvasTitle?.toString() || t('common.untitled')} · Refly</title>
        {shareData?.minimapUrl && <meta property="og:image" content={shareData.minimapUrl} />}
      </Helmet>

      <div className="absolute h-16 p-2 top-0 left-0 right-0 box-border flex justify-between items-center bg-transparent">
        <ToolContainer>
          {collapse && (
            <>
              <SiderPopover align={{ offset: [8, -8] }} showBrand={false} />
              <Divider type="vertical" className="m-0 h-5 bg-refly-Card-Border" />
            </>
          )}
          {readonly ? (
            <ReadonlyCanvasTitle
              canvasTitle={canvasTitle}
              isLoading={false}
              owner={shareData?.owner}
            />
          ) : (
            <CanvasActionDropdown canvasId={canvasId} canvasName={canvasTitle} offset={[0, 4]}>
              <CanvasTitle
                canvasTitle={canvasTitle}
                canvasLoading={loading || !canvasInitialized}
                language={language}
                syncFailureCount={syncFailureCount}
              />
            </CanvasActionDropdown>
          )}
        </ToolContainer>

        <ToolContainer>
          {!readonly && (
            <>
              <TooltipButton
                tooltip={t('canvas.toolbar.tooltip.undo')}
                onClick={() => undo()}
                className={buttonClass}
              >
                <Undo size={16} />
              </TooltipButton>

              <TooltipButton
                tooltip={t('canvas.toolbar.tooltip.redo')}
                onClick={() => redo()}
                className={buttonClass}
              >
                <Redo size={16} />
              </TooltipButton>
            </>
          )}
          <CanvasLayoutControls />

          <TooltipButton
            tooltip={t('canvas.toolbar.tooltip.initializeWorkflow') || 'Initialize Workflow'}
            onClick={handleInitializeWorkflow}
            disabled={initializing}
            className={buttonClass}
          >
            <Play size={16} />
          </TooltipButton>

          {/* Add a button to trigger new execution mode, passing a new canvasId, and after successful initialization, navigate to the new canvas */}
          <TooltipButton
            tooltip={
              t('canvas.toolbar.tooltip.initializeWorkflowInNewCanvas') ||
              'Initialize Workflow in New Canvas'
            }
            onClick={handleInitializeWorkflowInNewCanvas}
            disabled={newModeLoading}
            className={buttonClass}
          >
            <Copy size={16} />
          </TooltipButton>

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

          <ToolbarButtons canvasTitle={canvasTitle} mode={mode} changeMode={changeMode} />
        </ToolContainer>
      </div>
    </>
  );
});

import { FC, memo } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { Button, Divider, message, Tooltip } from 'antd';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useTranslation } from 'react-i18next';
import { LOCALE } from '@refly/common-types';
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
import { Undo, Redo, Copy, Play, Chat } from 'refly-icons';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';
import { useAuthStoreShallow } from '@refly/stores';
import { CanvasLayoutControls } from '@refly-packages/ai-workspace-common/components/canvas/layout-control/canvas-layout-controls';
import { TooltipButton } from './buttons';
import { ToolsDependency } from '../tools-dependency';
import cn from 'classnames';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { logEvent } from '@refly/telemetry-web';

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
  const navigate = useNavigate();
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));
  const { showWorkflowRun, setShowWorkflowRun, showCopilot, setShowCopilot } =
    useCanvasResourcesPanelStoreShallow((state) => ({
      showWorkflowRun: state.showWorkflowRun,
      setShowWorkflowRun: state.setShowWorkflowRun,
      showCopilot: state.showCopilot,
      setShowCopilot: state.setShowCopilot,
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

  const handleDuplicate = () => {
    logEvent('remix_workflow_share', Date.now(), {
      canvasId,
    });

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
    setShowWorkflowRun(!showWorkflowRun);
  };

  const handleToggleCopilot = () => {
    if (!isLogin) {
      setLoginModalOpen(true);
      return;
    }
    setShowCopilot(!showCopilot);
  };

  return (
    <>
      <Helmet>
        <title>{canvasTitle?.toString() || t('common.untitled')} · Refly</title>
        {shareData?.minimapUrl && <meta property="og:image" content={shareData.minimapUrl} />}
      </Helmet>

      <div className="absolute h-16 p-2 top-0 left-0 right-0 box-border flex justify-between items-center bg-transparent">
        <ToolContainer>
          {readonly ? (
            <ReadonlyCanvasTitle
              canvasTitle={canvasTitle}
              isLoading={false}
              owner={shareData?.owner}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Tooltip
                title={t(isLogin ? 'canvas.toolbar.backDashboard' : 'canvas.toolbar.backHome')}
                arrow={false}
                align={{ offset: [20, -8] }}
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center h-8 w-8 hover:bg-refly-tertiary-hover rounded-lg cursor-pointer"
                  onClick={() => navigate('/')}
                >
                  <Logo
                    textProps={{ show: false }}
                    logoProps={{ show: true, className: '!w-5 !h-5' }}
                  />
                </div>
              </Tooltip>
              <Divider type="vertical" className="m-0 h-5 bg-refly-Card-Border" />
              <CanvasActionDropdown canvasId={canvasId} canvasName={canvasTitle} offset={[0, 4]}>
                <CanvasTitle
                  canvasTitle={canvasTitle}
                  canvasLoading={loading || !canvasInitialized}
                  language={language}
                  syncFailureCount={syncFailureCount}
                />
              </CanvasActionDropdown>
            </div>
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

          {!readonly && !isPreviewCanvas && (
            <>
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

              <TooltipButton
                tooltip="Daily AI News Copilot"
                onClick={handleToggleCopilot}
                className={cn(buttonClass, showCopilot && '!bg-gradient-tools-open')}
              >
                <Chat
                  size={16}
                  color={showCopilot ? 'var(--refly-primary-default)' : 'var(--refly-text-0)'}
                />
              </TooltipButton>
            </>
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

          <ToolbarButtons canvasTitle={canvasTitle} mode={mode} changeMode={changeMode} />
        </ToolContainer>
      </div>
    </>
  );
});

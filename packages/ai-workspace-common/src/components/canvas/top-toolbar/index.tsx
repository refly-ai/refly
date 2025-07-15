import { FC, memo } from 'react';
import { useMatch } from 'react-router-dom';
import { Button, Divider, message } from 'antd';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useTranslation } from 'react-i18next';
import { LOCALE } from '@refly/common-types';
import { AiOutlineMenuUnfold } from 'react-icons/ai';
import { SiderPopover } from '@refly-packages/ai-workspace-common/components/sider/popover';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { Helmet } from 'react-helmet';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { CanvasTitle, ReadonlyCanvasTitle } from './canvas-title';
import { ToolbarButtons } from './buttons';
import { CanvasActionDropdown } from '@refly-packages/ai-workspace-common/components/workspace/canvas-list-modal/canvasActionDropdown';
import ShareSettings from './share-settings';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import './index.scss';
import { IconLink } from '@refly-packages/ai-workspace-common/components/common/icon';
import { LuBookCopy } from 'react-icons/lu';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';
import { useAuthStoreShallow } from '@refly-packages/ai-workspace-common/stores/auth';

interface TopToolbarProps {
  canvasId: string;
}

export const TopToolbar: FC<TopToolbarProps> = memo(({ canvasId }) => {
  const { i18n, t } = useTranslation();
  const language = i18n.language as LOCALE;
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));
  const isShareCanvas = useMatch('/share/canvas/:canvasId');
  const isPreviewCanvas = useMatch('/preview/canvas/:shareId');

  const { loading, readonly, shareData } = useCanvasContext();

  const {
    canvasInitialized,
    showPreview,
    setShowPreview,
    showMaxRatio,
    setShowMaxRatio,
    canvasTitle: canvasTitleFromStore,
  } = useCanvasStoreShallow((state) => ({
    canvasInitialized: state.canvasInitialized[canvasId],
    showPreview: state.showPreview,
    setShowPreview: state.setShowPreview,
    showMaxRatio: state.showMaxRatio,
    setShowMaxRatio: state.setShowMaxRatio,
    canvasTitle: state.canvasTitle[canvasId],
  }));

  const canvasTitle = shareData?.title || canvasTitleFromStore;

  const { duplicateCanvas, loading: duplicating } = useDuplicateCanvas();
  const handleDuplicate = () => {
    if (!isLogin) {
      setLoginModalOpen(true);
      return;
    }
    duplicateCanvas(canvasId, () => {});
  };

  return (
    <>
      <Helmet>
        <title>{canvasTitle?.toString() || t('common.untitled')} · Refly</title>
        {shareData?.minimapUrl && <meta property="og:image" content={shareData.minimapUrl} />}
      </Helmet>
      <div
        className={`absolute h-16 top-0 left-0 right-0  box-border flex justify-between items-center py-2 px-4 pr-0 bg-transparent ${
          collapse ? 'w-[calc(100vw-12px)]' : 'w-[calc(100vw-260px)]'
        }`}
      >
        <div className="flex items-center relative z-10">
          {collapse && (
            <>
              <SiderPopover>
                <Button
                  type="text"
                  icon={<AiOutlineMenuUnfold size={16} className="text-gray-500" />}
                  onClick={() => {
                    setCollapse(!collapse);
                  }}
                />
              </SiderPopover>
              <Divider type="vertical" className="pr-[4px] h-4" />
            </>
          )}
          {readonly ? (
            <ReadonlyCanvasTitle
              canvasTitle={canvasTitle}
              isLoading={false}
              owner={shareData?.owner}
            />
          ) : (
            <CanvasTitle
              canvasId={canvasId}
              canvasTitle={canvasTitle}
              canvasLoading={loading || !canvasInitialized}
              language={language}
            />
          )}
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <ToolbarButtons
            canvasTitle={canvasTitle}
            showPreview={showPreview}
            showMaxRatio={showMaxRatio}
            setShowPreview={setShowPreview}
            setShowMaxRatio={setShowMaxRatio}
          />

          {isPreviewCanvas ? (
            <Button
              loading={duplicating}
              type="primary"
              icon={<LuBookCopy className="flex items-center" />}
              onClick={handleDuplicate}
            >
              {t('template.use')}
            </Button>
          ) : isShareCanvas ? (
            <>
              <Button
                loading={duplicating}
                icon={<LuBookCopy className="flex items-center" />}
                onClick={handleDuplicate}
              >
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
              <CanvasActionDropdown canvasId={canvasId} canvasName={canvasTitle} btnSize="large" />
            </>
          )}
        </div>
      </div>
    </>
  );
});

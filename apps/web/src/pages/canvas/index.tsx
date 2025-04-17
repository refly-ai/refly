import { useParams } from 'react-router-dom';
import { Canvas } from '@refly-packages/ai-workspace-common/components/canvas';
import { Button, Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import { IconPlus } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { SiderPopover } from '@refly-packages/ai-workspace-common/components/sider/popover';
import { AiOutlineMenuUnfold } from 'react-icons/ai';
const CanvasPage = () => {
  const { t } = useTranslation();
  const { canvasId = '' } = useParams();
  const { debouncedCreateCanvas, isCreating } = useCreateCanvas();
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));

  return canvasId && canvasId !== 'empty' ? (
    <Canvas canvasId={canvasId} />
  ) : (
    <div className="flex h-full w-full flex-col">
      <div className="box-border flex h-16 items-center justify-between px-4 py-2">
        {collapse && (
          <SiderPopover>
            <Button
              type="text"
              icon={<AiOutlineMenuUnfold size={16} className="text-gray-500" />}
              onClick={() => {
                setCollapse(!collapse);
              }}
            />
          </SiderPopover>
        )}
      </div>
      <Empty
        className="m-0 flex w-full flex-grow flex-col items-center justify-center"
        description={t('common.empty')}
      >
        <Button
          type="primary"
          onClick={debouncedCreateCanvas}
          loading={isCreating}
          icon={<IconPlus />}
          data-cy="empty-canvas-create-button"
        >
          {t('loggedHomePage.siderMenu.newCanvas')}
        </Button>
      </Empty>
    </div>
  );
};

export default CanvasPage;

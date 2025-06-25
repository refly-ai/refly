import { useParams } from 'react-router-dom';
import { Canvas } from '@refly-packages/ai-workspace-common/components/canvas';
import { Button } from 'antd';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { SiderPopover } from '@refly-packages/ai-workspace-common/components/sider/popover';
import { AiOutlineMenuUnfold } from 'react-icons/ai';
import { FrontPage } from '@refly-packages/ai-workspace-common/components/canvas/front-page';
import { CanvasProvider } from '@refly-packages/ai-workspace-common/context/canvas';
import { ReactFlowProvider } from '@xyflow/react';

const CanvasPage = () => {
  const { canvasId = '' } = useParams();
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));

  return canvasId && canvasId !== 'empty' ? (
    <Canvas canvasId={canvasId} />
  ) : (
    <div className="flex h-full w-full flex-col">
      <div className="absolute top-0 left-0 h-16 items-center justify-between px-4 py-2 z-10">
        {collapse && (
          <SiderPopover>
            <Button
              type="text"
              icon={<AiOutlineMenuUnfold size={16} className="text-gray-500 dark:text-gray-400" />}
              onClick={() => {
                setCollapse(!collapse);
              }}
            />
          </SiderPopover>
        )}
      </div>
      <ReactFlowProvider>
        <CanvasProvider canvasId="empty" readonly={false}>
          <FrontPage projectId={null} />
        </CanvasProvider>
      </ReactFlowProvider>
    </div>
  );
};

export default CanvasPage;

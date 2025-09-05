import { useParams } from 'react-router-dom';
import { Canvas } from '@refly-packages/ai-workspace-common/components/canvas';
import { useSiderStoreShallow } from '@refly/stores';
import { SiderPopover } from '@refly-packages/ai-workspace-common/components/sider/popover';
import { FrontPage } from '@refly-packages/ai-workspace-common/components/canvas/front-page';
import { cn } from '@refly/utils';

const CanvasPage = () => {
  const { canvasId = '' } = useParams();
  const { collapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
  }));

  return (
    <div className={cn('w-full h-full p-2 rounded-lg', { 'pl-0': !collapse })}>
      {canvasId && canvasId !== 'empty' ? (
        <Canvas canvasId={canvasId} />
      ) : (
        <div className="flex h-full w-full flex-col">
          {collapse && (
            <SiderPopover
              align={{ offset: [8, -48] }}
              childrenClassName="absolute top-6 left-6 z-10"
            />
          )}
          <FrontPage projectId={null} />
        </div>
      )}
    </div>
  );
};

export default CanvasPage;

import { memo, useEffect } from 'react';
import { Modal } from 'antd';
import { ResourceOverview } from './share/resource-overview';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { PreviewComponent } from '@refly-packages/ai-workspace-common/components/canvas/node-preview';
import { CanvasResourcesHeader } from './share/canvas-resources-header';

import './index.scss';
import cn from 'classnames';
import { useReactFlow } from '@xyflow/react';

interface CanvasResourcesProps {
  className?: string;
  wideScreen?: boolean;
}

export const CanvasResources = memo(({ className, wideScreen }: CanvasResourcesProps) => {
  const { getNodes } = useReactFlow();
  const nodes = getNodes();
  const { currentResource, setCurrentResource } = useCanvasResourcesPanelStoreShallow((state) => ({
    currentResource: state.currentResource,
    setCurrentResource: state.setCurrentResource,
  }));

  useEffect(() => {
    console.log('currentResource', currentResource);
    console.log('nodes', nodes);
  }, [currentResource]);

  return (
    <div
      className={cn(
        'h-full overflow-hidden flex flex-shrink-0 rounded-xl bg-refly-bg-content-z2 border-solid border-[1px] border-refly-Card-Border shadow-refly-m',
        className,
      )}
    >
      <ResourceOverview currentResource={currentResource} setCurrentResource={setCurrentResource} />
      {currentResource && (
        <div
          className={cn(
            'h-full flex flex-col flex-1 min-w-0 border-solid border-l-[1px] border-y-0 border-r-0 border-refly-Card-Border',
            !wideScreen ? 'w-[460px]' : '',
          )}
        >
          <CanvasResourcesHeader
            currentResource={currentResource}
            setCurrentResource={setCurrentResource}
          />
          <div className="flex-grow overflow-hidden min-w-0">
            <PreviewComponent node={currentResource} hideMeta />
          </div>
        </div>
      )}
    </div>
  );
});

export const CanvasResourcesWidescreenModal = memo(() => {
  const { wideScreenVisible, setWideScreenVisible } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      wideScreenVisible: state.wideScreenVisible,
      setWideScreenVisible: state.setWideScreenVisible,
    }),
  );

  return (
    <Modal
      open={wideScreenVisible}
      centered
      onCancel={() => {
        setWideScreenVisible(false);
      }}
      title={null}
      closable={false}
      footer={null}
      width="90%"
      styles={{
        wrapper: {
          transform: 'translateX(4.5%)',
        },
        content: {
          padding: 0,
        },
      }}
      className="resources-widescreen-modal flex flex-col"
      destroyOnHidden
    >
      <div className="flex w-full h-[calc(100vh-56px)] rounded-xl overflow-hidden">
        <CanvasResources className="w-full" wideScreen />
      </div>
    </Modal>
  );
});

CanvasResourcesWidescreenModal.displayName = 'CanvasResourcesWidescreenModal';

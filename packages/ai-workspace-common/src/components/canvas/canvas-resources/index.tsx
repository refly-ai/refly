import { memo, useEffect, useRef } from 'react';
import { Modal } from 'antd';
import { CanvasResourcesHeader } from './share/canvas-resources-header';
import { ResourceOverview } from './share/resource-overview';
import { useActiveNode, useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { PreviewComponent } from '@refly-packages/ai-workspace-common/components/canvas/node-preview';
import { CanvasNodeType } from '@refly/openapi-schema';
import './index.scss';
import cn from 'classnames';

interface CanvasResourcesProps {
  className?: string;
}

export const CanvasResources = memo(({ className }: CanvasResourcesProps) => {
  const { canvasId } = useCanvasContext();
  const { showLeftOverview, resetState, setParentType } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      showLeftOverview: state.showLeftOverview,
      resetState: state.resetState,
      setParentType: state.setParentType,
    }),
  );
  const { activeNode } = useActiveNode(canvasId);

  const prevCanvasIdRef = useRef<string | null>(canvasId);

  useEffect(() => {
    if (canvasId && canvasId !== prevCanvasIdRef.current) {
      prevCanvasIdRef.current = canvasId;
      resetState();
    }
  }, [canvasId, resetState]);

  useEffect(() => {
    if (activeNode) {
      if (activeNode.type === 'resource') {
        setParentType('myUpload');
      }
      if (activeNode.type === 'skillResponse') {
        setParentType('stepsRecord');
      }
      if (
        ['document', 'codeArtifact', 'website', 'video', 'audio'].includes(
          activeNode.type as CanvasNodeType,
        )
      ) {
        setParentType('resultsRecord');
      }
      if (activeNode.type === 'image' && !!activeNode.data?.metadata?.resultId) {
        setParentType(activeNode.data?.metadata?.resultId ? 'resultsRecord' : 'myUpload');
      }
    }
  }, [activeNode]);

  return (
    <div
      className={cn(
        'w-full h-full overflow-hidden flex flex-col bg-refly-bg-content-z2 rounded-xl border-solid border border-refly-Card-Border shadow-refly-m',
        { 'rounded-l-none': showLeftOverview },
        className,
      )}
    >
      <CanvasResourcesHeader />
      {activeNode ? <PreviewComponent node={activeNode} /> : <ResourceOverview />}
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
      className="flex flex-col"
      destroyOnHidden
    >
      <div className="flex w-full h-[99vh]">
        <div className="w-[360px] flex h-full border-r border-refly-Card-Border">
          <ResourceOverview />
        </div>
        <div className="flex-1 h-full">
          <CanvasResources className="!rounded-l-none" />
        </div>
      </div>
    </Modal>
  );
});

CanvasResourcesWidescreenModal.displayName = 'CanvasResourcesWidescreenModal';

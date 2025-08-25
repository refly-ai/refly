import { memo, useEffect, useMemo, useRef } from 'react';
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
  forceHideLeftOverview?: boolean;
}

export const CanvasResources = memo(
  ({ className, forceHideLeftOverview }: CanvasResourcesProps) => {
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
        if (['skillResponse'].includes(activeNode.type)) {
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
        if (activeNode.type === 'start') {
          setParentType(null);
        }
      }
    }, [activeNode]);

    return (
      <div
        className={cn(
          'w-full h-full overflow-hidden flex flex-col bg-refly-bg-content-z2 rounded-xl border-solid border border-refly-Card-Border shadow-refly-m',
          { 'rounded-l-none': showLeftOverview && !forceHideLeftOverview },
          className,
        )}
      >
        <CanvasResourcesHeader />
        {activeNode ? <PreviewComponent node={activeNode} /> : <ResourceOverview />}
      </div>
    );
  },
);

export const CanvasResourcesWidescreenModal = memo(() => {
  const { wideScreenVisible, setWideScreenVisible } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      wideScreenVisible: state.wideScreenVisible,
      setWideScreenVisible: state.setWideScreenVisible,
    }),
  );

  const { canvasId } = useCanvasContext();
  const { activeNode } = useActiveNode(canvasId);
  const hideLeftOverview = useMemo(() => {
    return activeNode?.type === 'start';
  }, [activeNode?.type]);

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
      width={hideLeftOverview ? '70%' : '90%'}
      styles={{
        wrapper: {
          transform: hideLeftOverview ? 'translateX(14.5%)' : 'translateX(4.5%)',
        },
        content: {
          padding: 0,
        },
      }}
      className="flex flex-col"
      destroyOnHidden
    >
      <div className="flex w-full h-[calc(100vh-16px)]">
        {!hideLeftOverview && (
          <div className="w-[360px] flex h-full border-r border-refly-Card-Border">
            <ResourceOverview />
          </div>
        )}
        <div className="flex-1 h-full">
          <CanvasResources forceHideLeftOverview={hideLeftOverview} />
        </div>
      </div>
    </Modal>
  );
});

CanvasResourcesWidescreenModal.displayName = 'CanvasResourcesWidescreenModal';

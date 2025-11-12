import { memo, useEffect } from 'react';
import { Modal } from 'antd';
import cn from 'classnames';
import { FileOverview } from './share/file-overview';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { FileItemHeader } from './share/file-item-header';
import { FilePreview } from './file-preview';

import './index.scss';

interface CanvasDriveProps {
  className?: string;
  wideScreen?: boolean;
}

export const CanvasDrive = memo(({ className, wideScreen }: CanvasDriveProps) => {
  const { currentFile, setSidePanelVisible } = useCanvasResourcesPanelStoreShallow((state) => ({
    currentFile: state.currentFile,
    setSidePanelVisible: state.setSidePanelVisible,
  }));

  useEffect(() => {
    if (currentFile) {
      setSidePanelVisible(true);
    }
  }, [currentFile, setSidePanelVisible]);

  return (
    <div
      className={cn(
        'h-full overflow-hidden flex flex-shrink-0 rounded-xl bg-refly-bg-content-z2 border-solid border-[1px] border-refly-Card-Border shadow-refly-m',
        className,
      )}
    >
      <FileOverview />
      {currentFile && (
        <div
          className={cn(
            'h-full flex flex-col flex-1 min-w-0 border-solid border-l-[1px] border-y-0 border-r-0 border-refly-Card-Border',
            !wideScreen ? 'w-[460px]' : '',
          )}
        >
          <FileItemHeader />
          <div className="flex-grow overflow-hidden min-w-0">
            <FilePreview file={currentFile} />
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
        <CanvasDrive className="w-full" wideScreen />
      </div>
    </Modal>
  );
});

CanvasResourcesWidescreenModal.displayName = 'CanvasResourcesWidescreenModal';

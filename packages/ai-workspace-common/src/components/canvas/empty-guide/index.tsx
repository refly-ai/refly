import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import {
  IconAskAI,
  IconTemplate,
  IconImportResource,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { TemplatesGuide } from './templates-guide';
import { useCanvasTemplateModal } from '@refly-packages/ai-workspace-common/stores/canvas-template-modal';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useImportResourceStoreShallow } from '@refly-packages/ai-workspace-common/stores/import-resource';
import { canvasTemplateEnabled } from '@refly-packages/ai-workspace-common/utils/env';

export const EmptyGuide = ({ canvasId }: { canvasId: string }) => {
  const { t } = useTranslation();
  const { setVisible } = useCanvasTemplateModal((state) => ({
    setVisible: state.setVisible,
  }));

  const { setShowLinearThread, showLinearThread } = useCanvasStoreShallow((state) => ({
    setShowLinearThread: state.setShowLinearThread,
    showLinearThread: state.showLinearThread,
  }));

  const { setImportResourceModalVisible } = useImportResourceStoreShallow((state) => ({
    setImportResourceModalVisible: state.setImportResourceModalVisible,
  }));

  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[70%]"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="flex flex-col items-center justify-center text-gray-500 text-center gap-4"
        style={{ pointerEvents: 'none' }}
      >
        <div className="text-[20px]" style={{ pointerEvents: 'none' }}>
          {t('canvas.emptyText')}
        </div>
        <div className="flex gap-4" style={{ pointerEvents: 'none' }}>
          <Button
            icon={<IconImportResource className="-mr-1 flex items-center justify-center" />}
            type="text"
            className="text-[20px] text-[#00968F] py-[4px] px-[8px]"
            onClick={() => setImportResourceModalVisible(true)}
            data-cy="canvas-import-resource-button"
            style={{ pointerEvents: 'auto' }}
          >
            {t('canvas.toolbar.importResource')}
          </Button>

          <Button
            type="text"
            icon={<IconAskAI className="-mr-1 flex items-center justify-center" />}
            className="text-[20px] text-[#00968F] py-[4px] px-[8px]"
            onClick={() => setShowLinearThread(!showLinearThread)}
            data-cy="canvas-ask-ai-button"
            style={{ pointerEvents: 'auto' }}
          >
            {t('canvas.reflyPilot.title')}
          </Button>

          {canvasTemplateEnabled && (
            <Button
              icon={<IconTemplate className="-mr-1 flex items-center justify-center" />}
              type="text"
              className="text-[20px] text-[#00968F] py-[4px] px-[8px]"
              onClick={() => setVisible(true)}
              data-cy="canvas-create-document-button"
              style={{ pointerEvents: 'auto' }}
            >
              {t('loggedHomePage.siderMenu.template')}
            </Button>
          )}
        </div>
      </div>

      <TemplatesGuide canvasId={canvasId} />
    </div>
  );
};

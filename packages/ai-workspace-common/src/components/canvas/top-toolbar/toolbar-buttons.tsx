import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useCallback } from 'react';
import { Divider, Button, message } from 'antd';
import { Resource, Play, Note1, AiChat, Chat } from 'refly-icons';
import { ToolsDependency } from '../tools-dependency';
import { CreateVariablesModal } from '@refly-packages/ai-workspace-common/components/canvas/workflow-variables';
import { genMemoID } from '@refly/utils/id';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

interface ToolbarButtonsProps {
  canvasId: string;
}

export const ToolbarButtons = memo(({ canvasId }: ToolbarButtonsProps) => {
  const { t } = useTranslation();
  const { addNode } = useAddNode();
  const { readonly } = useCanvasContext();

  const [showCreateVariablesModal, setShowCreateVariablesModal] = useState(false);

  const handleCloseModal = useCallback(() => {
    setShowCreateVariablesModal(false);
  }, [setShowCreateVariablesModal]);

  const { sidePanelVisible, setSidePanelVisible, showWorkflowRun, setShowWorkflowRun } =
    useCanvasResourcesPanelStoreShallow((state) => ({
      sidePanelVisible: state.sidePanelVisible,
      setSidePanelVisible: state.setSidePanelVisible,
      showWorkflowRun: state.showWorkflowRun,
      setShowWorkflowRun: state.setShowWorkflowRun,
    }));

  const handleResourcesPanelOpen = useCallback(() => {
    setSidePanelVisible(!sidePanelVisible);
  }, [sidePanelVisible, setSidePanelVisible]);

  const handleShowWorkflowRun = useCallback(() => {
    setShowWorkflowRun(!showWorkflowRun);
  }, [showWorkflowRun, setShowWorkflowRun]);

  const handleAddUserInput = useCallback(() => {
    setShowCreateVariablesModal(true);
  }, [setShowCreateVariablesModal]);

  const createMemo = (position: { x: number; y: number }) => {
    const memoId = genMemoID();
    addNode(
      {
        type: 'memo',
        data: { title: t('canvas.nodeTypes.memo'), entityId: memoId },
        position: position,
      },
      [],
      true,
      true,
    );
  };

  const handleAddAgent = useCallback(() => {
    message.info('Add Agent is coming soon');
  }, []);

  const handleAddMemo = useCallback(() => {
    createMemo({ x: 0, y: 0 });
  }, []);

  const internalActions = useMemo(() => {
    return readonly
      ? []
      : [
          {
            key: 'addUserInput',
            icon: <Chat size={16} />,
            onClick: handleAddUserInput,
            label: t('canvas.toolbar.tooltip.addUserInput'),
            active: false,
          },
          {
            key: 'addAgent',
            icon: <AiChat size={16} />,
            onClick: handleAddAgent,
            label: t('canvas.toolbar.tooltip.addAgent'),
            active: false,
          },
          {
            key: 'addNote',
            icon: <Note1 size={16} />,
            onClick: handleAddMemo,
            label: t('canvas.toolbar.tooltip.addNote'),
          },
          { type: 'divider', key: 'divider-1' },
        ];
  }, [handleAddUserInput, handleAddAgent, handleAddMemo, t, readonly]);

  const actions = useMemo(() => {
    return [
      ...internalActions,

      {
        key: 'resources',
        icon: <Resource size={16} />,
        onClick: handleResourcesPanelOpen,
        label: t('canvas.toolbar.tooltip.resourceLibrary'),
        active: sidePanelVisible,
      },
    ];
  }, [internalActions, handleResourcesPanelOpen, t, sidePanelVisible]);

  return (
    <div className="absolute bottom-6 left-0 right-0 z-20 p-2 flex items-center justify-center pointer-events-none">
      <div className="flex items-center gap-2 p-2 bg-refly-bg-content-z2 rounded-2xl border-solid border-[1px] border-refly-Card-Border pointer-events-auto">
        {actions.map((action) =>
          action.type === 'divider' ? (
            <Divider key={action.key} type="vertical" className="m-0 h-5 bg-refly-Card-Border" />
          ) : (
            <Button
              key={action.key}
              type="text"
              icon={action.icon}
              onClick={action.onClick}
              className="px-[10px] py-[5px] font-semibold"
            >
              {action.label}
            </Button>
          ),
        )}
        <Divider type="vertical" className="m-0 h-5 bg-refly-Card-Border" />

        <ToolsDependency canvasId={canvasId} />
        {readonly && <div />}

        {!readonly && (
          <Button
            type="primary"
            icon={<Play size={16} />}
            onClick={handleShowWorkflowRun}
            className="px-[10px] py-[5px] font-semibold ml-4"
          >
            {t('canvas.toolbar.tooltip.previewWorkflowRun')}
          </Button>
        )}
      </div>

      <CreateVariablesModal
        visible={showCreateVariablesModal}
        onCancel={handleCloseModal}
        variableType="string"
        mode="create"
      />
    </div>
  );
});

ToolbarButtons.displayName = 'ToolbarButtons';

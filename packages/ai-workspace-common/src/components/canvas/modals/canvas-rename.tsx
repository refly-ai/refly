import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input, Tooltip, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { LuSparkles } from 'react-icons/lu';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useCanvasStoreShallow } from '@refly/stores';
import { useSiderStoreShallow } from '@refly/stores';
import type { InputRef } from 'antd';
import { useCanvasOperationStoreShallow } from '@refly/stores';

async function updateRemoteCanvasTitle(canvasId: string, newTitle: string) {
  const { data, error } = await getClient().updateCanvas({
    body: {
      canvasId,
      title: newTitle,
    },
  });
  if (error || !data?.success) {
    return;
  }
  return data.data?.title;
}

export const CanvasRenameModal = memo(() => {
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(false);

  const {
    canvasId,
    canvasTitle,
    modalVisible,
    modalType,
    reset: resetCanvasOperationState,
    triggerRenameSuccess,
  } = useCanvasOperationStoreShallow((state) => ({
    canvasId: state.canvasId,
    canvasTitle: state.canvasTitle,
    modalVisible: state.modalVisible,
    modalType: state.modalType,
    reset: state.reset,
    triggerRenameSuccess: state.triggerRenameSuccess,
  }));
  const setCanvasTitle = useCanvasStoreShallow((state) => state.setCanvasTitle);
  const [editedTitle, setEditedTitle] = useState(canvasTitle);

  const updateCanvasTitleInStore = useSiderStoreShallow((state) => state.updateCanvasTitle);
  const inputRef = useRef<InputRef | null>(null);

  useEffect(() => {
    setEditedTitle(canvasTitle);
  }, [canvasTitle]);

  const handleAutoName = useCallback(async () => {
    if (!canvasId) return;
    setIsLoading(true);
    const { data, error } = await getClient().autoNameCanvas({
      body: {
        canvasId,
        directUpdate: false,
      },
    });
    setIsLoading(false);
    if (error || !data?.success) {
      return;
    }
    if (data?.data?.title) {
      setEditedTitle(data.data.title);
    }
  }, [canvasId]);

  const handleSubmit = useCallback(async () => {
    if (editedTitle?.trim()) {
      const newTitle = await updateRemoteCanvasTitle(canvasId, editedTitle);
      if (newTitle) {
        setCanvasTitle(canvasId, newTitle);
        updateCanvasTitleInStore(canvasId, newTitle);

        // Trigger rename success event with updated canvas data
        triggerRenameSuccess({
          canvasId,
          title: newTitle,
        } as any);

        resetCanvasOperationState();
      }
    }
  }, [
    canvasId,
    editedTitle,
    setCanvasTitle,
    updateCanvasTitleInStore,
    resetCanvasOperationState,
    triggerRenameSuccess,
  ]);

  const handleCancel = useCallback(() => {
    resetCanvasOperationState();
  }, [resetCanvasOperationState]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.keyCode === 13 && !e.nativeEvent.isComposing) {
        e.preventDefault();
        if (editedTitle?.trim()) {
          handleSubmit();
        }
      }
    },
    [editedTitle, handleSubmit],
  );

  return (
    <Modal
      centered
      title={t('canvas.toolbar.editTitle')}
      open={modalVisible && modalType === 'rename'}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      onOk={handleSubmit}
      onCancel={handleCancel}
      okButtonProps={{ disabled: !editedTitle?.trim() }}
      afterOpenChange={(open) => {
        if (open) {
          inputRef.current?.focus();
        }
      }}
    >
      <div className="relative">
        <Input
          className="pr-8"
          autoFocus
          ref={inputRef}
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          placeholder={t('canvas.toolbar.editTitlePlaceholder')}
          onKeyDown={handleInputKeyDown}
        />
        <Tooltip title={t('canvas.toolbar.autoName')}>
          <Button
            type="text"
            className="absolute right-0.5 top-1/2 -translate-y-1/2 p-1 text-gray-500"
            onClick={handleAutoName}
            loading={isLoading}
            icon={<LuSparkles className="h-4 w-4 flex items-center" />}
          />
        </Tooltip>
      </div>
    </Modal>
  );
});

CanvasRenameModal.displayName = 'CanvasRenameModal';

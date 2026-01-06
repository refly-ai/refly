import { memo, useCallback, useRef } from 'react';
import { Button, Input, Tooltip, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { LuSparkles } from 'react-icons/lu';
import { useCanvasOperationStoreShallow } from '@refly/stores';
import { useUpdateCanvasTitle } from '@refly-packages/ai-workspace-common/hooks/canvas';
import type { InputRef } from 'antd';

export const CanvasRenameModal = memo(() => {
  const { t } = useTranslation();

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

  const {
    editedTitle,
    setEditedTitle,
    isAutoNaming: isLoading,
    isSaving: saveLoading,
    handleAutoName,
    updateTitle,
  } = useUpdateCanvasTitle(canvasId, canvasTitle);

  const inputRef = useRef<InputRef | null>(null);

  const handleSubmit = useCallback(async () => {
    if (saveLoading) return;
    const newTitle = await updateTitle();
    if (newTitle !== undefined) {
      // Trigger rename success event with updated canvas data
      triggerRenameSuccess({
        canvasId,
        title: newTitle,
      } as any);

      resetCanvasOperationState();
    }
  }, [canvasId, resetCanvasOperationState, triggerRenameSuccess, saveLoading, updateTitle]);

  const handleCancel = useCallback(() => {
    resetCanvasOperationState();
  }, [resetCanvasOperationState]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.keyCode === 13 && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
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
      okButtonProps={{ disabled: saveLoading, loading: saveLoading }}
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

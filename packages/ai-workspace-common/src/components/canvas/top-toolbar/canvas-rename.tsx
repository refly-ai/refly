import { Button, Input, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { Modal } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { LuSparkles } from 'react-icons/lu';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

interface CanvasRenameProps {
  canvasId: string;
  canvasTitle?: string;
  isModalOpen: boolean;
  handleModalOk: (editedTitle: string) => void;
  handleModalCancel: () => void;
}

export const CanvasRename: React.FC<CanvasRenameProps> = ({
  canvasId,
  canvasTitle,
  isModalOpen,
  handleModalOk,
  handleModalCancel,
}) => {
  const { t } = useTranslation();
  const [editedTitle, setEditedTitle] = useState(canvasTitle);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isModalOpen) {
      setEditedTitle(canvasTitle);
    }
  }, [canvasTitle, isModalOpen]);

  const handleAutoName = async () => {
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
  };

  return (
    <Modal
      centered
      title={t('canvas.toolbar.editTitle')}
      open={isModalOpen}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      onOk={() => handleModalOk(editedTitle)}
      onCancel={handleModalCancel}
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
          onKeyDown={(e) => {
            if (e.keyCode === 13 && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (editedTitle?.trim()) {
                handleModalOk(editedTitle);
              }
            }
          }}
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
};

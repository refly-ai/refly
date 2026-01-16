import React, { useCallback, useMemo } from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { InputContext } from 'refly-icons';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';

export const NewCanvasButton = React.memo(() => {
  const { t } = useTranslation();
  const { debouncedCreateCanvas, isCreating: createCanvasLoading } = useCreateCanvas();
  const { getCanvasList } = useHandleSiderData();
  const navigate = useNavigate();

  const handleImportCanvas = async (file: File) => {
    try {
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.json')) {
        message.error(t('canvas.import.invalidFileType', 'Please select a JSON file'));
        return;
      }

      // Validate file size (e.g., max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        message.error(t('canvas.import.fileTooLarge', 'File size must be less than 50MB'));
        return;
      }

      // Call importCanvas API
      const { data, error } = await getClient().importCanvas({
        body: { file },
      });

      if (error || !data?.success) {
        message.error(t('canvas.import.importFailed', 'Failed to import canvas'));
        return;
      }

      // Get the imported canvas ID
      const importedCanvasId = data?.data?.canvasId;
      if (!importedCanvasId) {
        message.error(t('canvas.import.importFailed', 'Failed to get imported canvas ID'));
        return;
      }

      message.success(t('canvas.import.importSuccess', 'Canvas imported successfully'));

      // Refresh the canvas list in sider
      getCanvasList();

      // Navigate to the newly imported canvas
      navigate(`/workflow/${importedCanvasId}`);
    } catch (error) {
      console.error('Import canvas error:', error);
      message.error(t('canvas.import.importFailed', 'Failed to import canvas'));
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImportCanvas(file);
    }
    // Reset the input value to allow selecting the same file again
    event.target.value = '';
  };

  const onMenuClick = (e: { key?: string }) => {
    if (e.key === 'importCanvas') {
      // Trigger file input click
      const fileInput = document.getElementById('canvas-import-input') as HTMLInputElement;
      fileInput?.click();
    }
  };

  const items = useMemo(
    () => [
      {
        key: 'importCanvas',
        label: t('loggedHomePage.siderMenu.importCanvas', 'Import Canvas'),
        icon: <InputContext size={18} />,
      },
    ],
    [t],
  );

  const menuProps = useMemo(() => ({ items, onClick: onMenuClick }), [items, onMenuClick]);

  // Ensure both internal ant buttons adopt our background/hover styles
  const buttonsRender = useCallback((buttons: [ReactElement, ReactElement]) => {
    const [leftButton, rightButton] = buttons ?? [];

    const commonClassName =
      'h-9 border-[1px] border-solid border-refly-Card-Border bg-refly-bg-control-z1 hover:!bg-refly-tertiary-hover';
    const leftClassName = `${leftButton?.props?.className ?? ''} ${commonClassName}`;
    const rightClassName = `${rightButton?.props?.className ?? ''} ${commonClassName}`;

    return [
      React.cloneElement(leftButton, { className: leftClassName }),
      React.cloneElement(rightButton, { className: rightClassName }),
    ];
  }, []);

  return (
    <>
      <Dropdown.Button
        className="w-full mt-1 grid grid-cols-[1fr_auto]"
        key="newCanvas"
        loading={createCanvasLoading}
        type="default"
        menu={menuProps}
        buttonsRender={buttonsRender}
        onClick={() => debouncedCreateCanvas()}
      >
        <span className="text-refly-text-0 font-semibold">
          {t('loggedHomePage.siderMenu.newCanvas')}
        </span>
      </Dropdown.Button>
      {/* Hidden file input for canvas import */}
      <input
        id="canvas-import-input"
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </>
  );
});

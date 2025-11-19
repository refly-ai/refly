import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip, Typography, Input, InputRef, message } from 'antd';
import { ScreenFull, ScreenDefault, Download } from 'refly-icons';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
// import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import cn from 'classnames';
import {
  getExtFromContentType,
  buildSafeFileName,
} from '@refly-packages/ai-workspace-common/utils/download-file';
import { serverOrigin } from '@refly/ui-kit';

const { Text } = Typography;

export const FileItemHeader = memo(() => {
  const { currentFile, setCurrentFile } = useCanvasResourcesPanelStoreShallow((state) => ({
    currentFile: state.currentFile,
    setCurrentFile: state.setCurrentFile,
  }));

  const { t } = useTranslation();
  // const { readonly } = useCanvasContext();
  const readonly = true;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const titleInputRef = useRef<InputRef>(null);

  const contentType = (currentFile?.type ?? '') as string;
  const [isDownloading, setIsDownloading] = useState(false);

  const { wideScreenVisible, setWideScreenVisible } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      wideScreenVisible: state.wideScreenVisible,
      setWideScreenVisible: state.setWideScreenVisible,
    }),
  );

  // Update editing title when active file changes
  useEffect(() => {
    if (currentFile?.name) {
      setEditingTitle(currentFile.name);
    }
  }, [currentFile?.name]);

  const handleParentClick = useCallback(() => {
    setCurrentFile(null);
  }, [setCurrentFile]);

  const handleWideScreen = useCallback(() => {
    setWideScreenVisible(true);
  }, [setWideScreenVisible]);

  const handleExitWideScreen = useCallback(() => {
    setWideScreenVisible(false);
  }, [setWideScreenVisible]);

  // Handle title click to start editing
  const handleTitleClick = useCallback(() => {
    if (!currentFile?.fileId || !currentFile?.type) return;

    setIsEditingTitle(true);
    setEditingTitle(currentFile.name || '');

    // Focus the input after a short delay to ensure DOM is ready
    setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 100);
  }, [currentFile?.fileId, currentFile?.type, currentFile?.name]);

  // Handle title save
  const handleTitleSave = useCallback(() => {
    if (!currentFile?.fileId || !currentFile?.type) return;

    setIsEditingTitle(false);
  }, [currentFile, editingTitle]);

  // Handle title cancel
  const handleTitleCancel = useCallback(() => {
    setIsEditingTitle(false);
    setEditingTitle(currentFile?.name || '');
  }, [currentFile?.name]);

  // Handle key press in title input
  const handleTitleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleTitleSave();
      } else if (e.key === 'Escape') {
        handleTitleCancel();
      }
    },
    [handleTitleSave, handleTitleCancel],
  );

  const handleDownload = useCallback(async () => {
    if (isDownloading) return;

    if (!currentFile?.fileId) {
      message.error(t('canvas.resourceLibrary.download.invalidUrl'));
      return;
    }

    // Trigger download with custom filename
    const triggerDownload = (href: string, fileName: string) => {
      const link = document.createElement('a');
      link.href = href;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const baseTitle = currentFile?.name ?? t('common.untitled');
    const fileExt = getExtFromContentType(contentType);
    const fileName = buildSafeFileName(baseTitle, fileExt);
    setIsDownloading(true);

    try {
      // Add download=1 query parameter to the URL
      const url = new URL(`${serverOrigin}/v1/drive/file/content/${currentFile?.fileId}`);
      url.searchParams.set('download', '1');

      // Fetch the file with authentication
      const response = await fetch(url.toString(), {
        credentials: 'include',
      });

      if (!response?.ok) {
        throw new Error(`Download failed: ${response?.status ?? 'unknown'}`);
      }

      // Get the blob from the response
      const blob = await response.blob();

      // Create a temporary object URL for download
      const objectUrl = URL.createObjectURL(blob);

      // Trigger download with custom filename
      triggerDownload(objectUrl, fileName);
      message.success(t('canvas.resourceLibrary.download.success'));

      // Clean up the object URL
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Download failed:', error);
      message.error(t('canvas.resourceLibrary.download.error'));
    } finally {
      setIsDownloading(false);
    }
  }, [currentFile, contentType, isDownloading, t, setIsDownloading]);

  return (
    <div className="w-full h-14 flex-shrink-0 flex gap-2 items-center justify-between px-3 py-4">
      <div className="min-w-0 flex-1 flex items-center gap-1">
        <Button
          type="text"
          size="small"
          onClick={handleParentClick}
          className={cn(
            'h-[30px] !text-refly-text-1 hover:!bg-refly-tertiary-hover',
            wideScreenVisible ? 'pointer-events-none' : '',
            'px-0.5',
          )}
        >
          {t('canvas.resourceLibrary.title')}
        </Button>
        <div className="text-refly-text-2">/</div>
        {isEditingTitle && !readonly ? (
          <Input
            ref={titleInputRef}
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyPress}
            className="min-w-0 flex-1 !max-w-[400px] h-[30px]"
            size="small"
            autoFocus
          />
        ) : (
          <Text
            ellipsis={{ tooltip: true }}
            className={cn(
              'min-w-0 flex-1 !max-w-[400px] leading-5 rounded-lg px-1 py-[5px]',
              readonly ? 'cursor-default' : 'cursor-pointer hover:bg-refly-tertiary-hover',
            )}
            onClick={!readonly ? handleTitleClick : undefined}
          >
            {currentFile?.name || t('common.untitled')}
          </Text>
        )}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <Button
          className="!h-5 !w-5 p-0"
          size="small"
          type="text"
          icon={<Download size={16} />}
          loading={isDownloading}
          onClick={handleDownload}
          disabled={isDownloading}
        />

        {currentFile && (
          <Tooltip
            title={t(
              `canvas.resourceLibrary.${wideScreenVisible ? 'exitWideScreen' : 'wideScreen'}`,
            )}
            arrow={false}
          >
            <Button
              className="!h-5 !w-5 p-0"
              size="small"
              type="text"
              icon={wideScreenVisible ? <ScreenDefault size={16} /> : <ScreenFull size={16} />}
              onClick={wideScreenVisible ? handleExitWideScreen : handleWideScreen}
            />
          </Tooltip>
        )}
      </div>
    </div>
  );
});

FileItemHeader.displayName = 'FileItemHeader';

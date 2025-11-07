import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip, Typography, Input, InputRef, message } from 'antd';
import { ScreenFull, ScreenDefault, Download } from 'refly-icons';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import cn from 'classnames';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import { CanvasNodeType } from '@refly/openapi-schema';
import { CanvasNode } from '@refly/canvas-common';
import {
  getExtFromContentType,
  buildSafeFileName,
} from '@refly-packages/ai-workspace-common/utils/download-file';

const { Text } = Typography;

interface CanvasResourcesHeaderProps {
  currentResource: CanvasNode | null;
  setCurrentResource: (resource: CanvasNode | null) => void;
}

export const CanvasResourcesHeader = memo((props: CanvasResourcesHeaderProps) => {
  const { currentResource, setCurrentResource } = props;

  const { t } = useTranslation();
  const { readonly } = useCanvasContext();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const titleInputRef = useRef<InputRef>(null);

  const contentType = (currentResource?.data?.metadata?.contentType ?? '') as string;
  const downloadURL = (currentResource?.data?.metadata?.downloadURL ?? '') as string;
  const [isDownloading, setIsDownloading] = useState(false);

  const { wideScreenVisible, setWideScreenVisible } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      wideScreenVisible: state.wideScreenVisible,
      setWideScreenVisible: state.setWideScreenVisible,
    }),
  );

  const updateNodeTitle = useUpdateNodeTitle();

  // Update editing title when activeNode changes
  useEffect(() => {
    if (currentResource?.data?.title) {
      setEditingTitle(currentResource.data.title);
    }
  }, [currentResource?.data?.title]);

  const handleParentClick = useCallback(() => {
    setCurrentResource(undefined);
  }, [setCurrentResource]);

  const handleWideScreen = useCallback(() => {
    setWideScreenVisible(true);
  }, [setWideScreenVisible]);

  const handleExitWideScreen = useCallback(() => {
    setWideScreenVisible(false);
  }, [setWideScreenVisible]);

  // Handle title click to start editing
  const handleTitleClick = useCallback(() => {
    if (!currentResource?.data?.entityId || !currentResource?.type) return;

    setIsEditingTitle(true);
    setEditingTitle(currentResource.data.title || '');

    // Focus the input after a short delay to ensure DOM is ready
    setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 100);
  }, [currentResource?.data?.entityId, currentResource?.type, currentResource?.data?.title]);

  // Handle title save
  const handleTitleSave = useCallback(() => {
    if (!currentResource?.data?.entityId || !currentResource?.type) return;

    const newTitle = editingTitle.trim();
    if (newTitle && newTitle !== currentResource.data.title) {
      updateNodeTitle(
        newTitle,
        currentResource.data.entityId,
        currentResource.id,
        currentResource.type as CanvasNodeType,
      );
    }

    setIsEditingTitle(false);
  }, [currentResource, editingTitle, updateNodeTitle]);

  // Handle title cancel
  const handleTitleCancel = useCallback(() => {
    setIsEditingTitle(false);
    setEditingTitle(currentResource?.data?.title || '');
  }, [currentResource?.data?.title]);

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

    if (!downloadURL) {
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

    const baseTitle = currentResource?.data?.title ?? t('common.untitled');
    const fileExt = getExtFromContentType(contentType);
    const fileName = buildSafeFileName(baseTitle, fileExt);
    setIsDownloading(true);

    try {
      // Add download=1 query parameter to the URL
      const url = new URL(downloadURL);
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
      // Fallback to direct download if fetch fails
      triggerDownload(downloadURL, fileName);
      message.error(t('canvas.resourceLibrary.download.error'));
    } finally {
      setIsDownloading(false);
    }
  }, [downloadURL, contentType, currentResource?.data?.title, isDownloading, t, setIsDownloading]);

  return (
    <div className="w-full h-[64px] flex-shrink-0 flex gap-2 items-center justify-between px-3 py-4">
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
            {currentResource?.data?.title || t('common.untitled')}
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

        {currentResource && (
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

CanvasResourcesHeader.displayName = 'CanvasResourcesHeader';

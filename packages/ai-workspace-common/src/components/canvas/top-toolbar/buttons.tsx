import { useState, useCallback, memo } from 'react';
import { Button, Tooltip, Popover } from 'antd';
import { useTranslation } from 'react-i18next';
import { MdOutlineImage } from 'react-icons/md';
import {
  IconAskAI,
  IconDownloadFile,
  IconSearch,
  IconSlideshow,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { NodeSelector } from '../common/node-selector';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useReactFlow } from '@xyflow/react';
import { HoverCard } from '@refly-packages/ai-workspace-common/components/hover-card';
import { useHoverCard } from '@refly-packages/ai-workspace-common/hooks/use-hover-card';
import { useExportCanvasAsImage } from '@refly-packages/ai-workspace-common/hooks/use-export-canvas-as-image';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

export const ToolbarButtons = memo(
  ({
    canvasTitle,
    showPreview,
    setShowPreview,
  }: {
    canvasTitle: string;
    showPreview: boolean;
    showMaxRatio: boolean;
    setShowPreview: (show: boolean) => void;
    setShowMaxRatio: (show: boolean) => void;
  }) => {
    const { t } = useTranslation();
    const { exportCanvasAsImage, isLoading } = useExportCanvasAsImage();
    const [searchOpen, setSearchOpen] = useState(false);
    const { setNodeCenter } = useNodePosition();
    const { getNodes } = useReactFlow();
    const { hoverCardEnabled } = useHoverCard();
    const { readonly } = useCanvasContext();

    const { showSlideshow, showLinearThread, setShowSlideshow, setShowLinearThread } =
      useCanvasStoreShallow((state) => ({
        showSlideshow: state.showSlideshow,
        showLinearThread: state.showLinearThread,
        setShowSlideshow: state.setShowSlideshow,
        setShowLinearThread: state.setShowLinearThread,
      }));

    const handleNodeSelect = useCallback(
      (item: IContextItem) => {
        const nodes = getNodes();
        const node = nodes.find((n) => n.data?.entityId === item.entityId);
        if (node) {
          setNodeCenter(node.id, true);
          // setSearchOpen(false);
        }
      },
      [getNodes, setNodeCenter],
    );

    const previewButtonConfig = {
      title: t(`canvas.toolbar.${showPreview ? 'hidePreview' : 'showPreview'}`),
      description: t('canvas.toolbar.togglePreviewDescription'),
      videoUrl: 'https://static.refly.ai/onboarding/top-toolbar/topToolbar-togglePreview.webm',
      placement: 'bottom' as const,
    };

    const linearThreadButtonConfig = {
      title: t(`canvas.toolbar.${showLinearThread ? 'hideLaunchpad' : 'showLaunchpad'}`, {
        defaultValue: showLinearThread ? 'Hide Pilot' : 'Show Pilot',
      }),
      description: t('canvas.toolbar.toggleLaunchpadTitle', {
        defaultValue: 'Toggle the visibility of Pilot Panel',
      }),
      placement: 'bottom' as const,
    };

    const previewButton = (
      <Button
        type="text"
        icon={
          <MdOutlineImage
            size={16}
            className={`flex items-center justify-center ${
              showPreview ? 'text-gray-900 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'
            }`}
          />
        }
        onClick={() => setShowPreview(!showPreview)}
        className="w-8 h-6 flex items-center justify-center mr-1 hover:bg-gray-100 dark:hover:bg-gray-700"
      />
    );

    const linearThreadButton = (
      <Button
        type="text"
        icon={
          <span
            className={`flex items-center justify-center text-sm font-semibold ${
              showLinearThread ? 'text-green-600' : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            <IconAskAI className="w-4 h-4 mr-2" />
            {t('canvas.toolbar.askAI')}
          </span>
        }
        onClick={() => setShowLinearThread(!showLinearThread)}
        className="!w-20 h-6 flex items-center justify-center"
      />
    );

    const exportImageButton = (
      <Button
        type="text"
        loading={isLoading}
        icon={<IconDownloadFile size={16} className="#000 flex items-center justify-center " />}
        onClick={() => exportCanvasAsImage(canvasTitle)}
        className="w-8 h-6 flex items-center justify-center"
      />
    );

    const slideshowButton = (
      <Button
        type="text"
        icon={
          <IconSlideshow
            size={16}
            className={`flex items-center justify-center ${showSlideshow ? 'text-green-600' : '#000'}`}
          />
        }
        className="w-8 h-6 flex items-center justify-center"
        onClick={() => setShowSlideshow(!showSlideshow)}
      />
    );

    return (
      <>
        {!readonly && (
          <div className="flex items-center h-9 bg-[#ffffff] rounded-lg px-2 border border-solid border-1 border-[#EAECF0] box-shadow-[0px_2px_6px_0px_rgba(0,0,0,0.1)] dark:bg-gray-900 dark:border-gray-700">
            {hoverCardEnabled ? (
              <HoverCard {...linearThreadButtonConfig}>{linearThreadButton}</HoverCard>
            ) : (
              <Tooltip title={linearThreadButtonConfig.title}>{linearThreadButton}</Tooltip>
            )}
          </div>
        )}

        <div className="flex items-center h-9 bg-[#ffffff] rounded-lg px-2 border border-solid border-1 border-[#EAECF0] box-shadow-[0px_2px_6px_0px_rgba(0,0,0,0.1)] dark:bg-gray-900 dark:border-gray-700">
          {!readonly && <Tooltip title={t('canvas.toolbar.slideshow')}>{slideshowButton}</Tooltip>}

          <Popover
            open={searchOpen}
            onOpenChange={setSearchOpen}
            overlayInnerStyle={{ padding: 0, boxShadow: 'none' }}
            trigger="click"
            placement="bottomRight"
            content={
              <NodeSelector
                onSelect={handleNodeSelect}
                showFooterActions={true}
                onClickOutside={() => setSearchOpen(false)}
              />
            }
            overlayClassName="node-search-popover"
          >
            <Tooltip title={t('canvas.toolbar.searchNode')}>
              <Button
                type="text"
                icon={
                  <IconSearch
                    size={16}
                    className="flex items-center justify-center text-gray-900 dark:text-gray-300"
                  />
                }
                className="w-8 h-6 flex items-center justify-center mr-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              />
            </Tooltip>
          </Popover>

          {hoverCardEnabled ? (
            <HoverCard {...previewButtonConfig}>{previewButton}</HoverCard>
          ) : (
            <Tooltip title={previewButtonConfig.title}>{previewButton}</Tooltip>
          )}

          <Tooltip title={t('canvas.toolbar.exportImage')}>{exportImageButton}</Tooltip>
        </div>
      </>
    );
  },
);

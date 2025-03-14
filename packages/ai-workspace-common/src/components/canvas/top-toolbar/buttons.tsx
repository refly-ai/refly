import { useState, useCallback, memo } from 'react';
import { Button, Tooltip, Popover } from 'antd';
import { useTranslation } from 'react-i18next';
import { MdOutlineImage, MdOutlineAspectRatio } from 'react-icons/md';
import {
  IconDownloadFile,
  IconSearch,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { NodeSelector } from '../common/node-selector';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useReactFlow } from '@xyflow/react';
import { HoverCard } from '@refly-packages/ai-workspace-common/components/hover-card';
import { useHoverCard } from '@refly-packages/ai-workspace-common/hooks/use-hover-card';
import { useExportCanvasAsImage } from '@refly-packages/ai-workspace-common/hooks/use-export-canvas-as-image';

export const ToolbarButtons = memo(
  ({
    canvasTitle,
    showPreview,
    showMaxRatio,
    setShowPreview,
    setShowMaxRatio,
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

    const maxRatioButtonConfig = {
      title: t(`canvas.toolbar.${showMaxRatio ? 'hideMaxRatio' : 'showMaxRatio'}`),
      description: t('canvas.toolbar.toggleMaxRatioDescription'),
      videoUrl: 'https://static.refly.ai/onboarding/top-toolbar/topToolbar-toogleMaxRatio.webm',
      placement: 'bottom' as const,
    };

    const previewButton = (
      <Button
        type="text"
        icon={<MdOutlineImage style={{ color: showPreview ? '#000' : '#9CA3AF' }} />}
        onClick={() => setShowPreview(!showPreview)}
        className="w-8 h-6 flex items-center justify-center mr-1"
      />
    );

    const maxRatioButton = (
      <Button
        type="text"
        icon={<MdOutlineAspectRatio style={{ color: showMaxRatio ? '#000' : '#9CA3AF' }} />}
        onClick={() => setShowMaxRatio(!showMaxRatio)}
        className="w-8 h-6 flex items-center justify-center"
      />
    );

    const exportImageButton = (
      <Button
        type="text"
        loading={isLoading}
        icon={<IconDownloadFile size={16} className="#000" />}
        onClick={() => exportCanvasAsImage(canvasTitle)}
        className="w-8 h-6 flex items-center justify-center"
      />
    );

    return (
      <div className="flex items-center h-9 bg-[#ffffff] rounded-lg px-2 border border-solid border-1 border-[#EAECF0] box-shadow-[0px_2px_6px_0px_rgba(0,0,0,0.1)]">
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
              icon={<IconSearch style={{ color: '#000' }} />}
              className="w-8 h-6 flex items-center justify-center mr-1"
            />
          </Tooltip>
        </Popover>

        {hoverCardEnabled ? (
          <HoverCard {...previewButtonConfig}>{previewButton}</HoverCard>
        ) : (
          <Tooltip title={previewButtonConfig.title}>{previewButton}</Tooltip>
        )}

        {hoverCardEnabled ? (
          <HoverCard {...maxRatioButtonConfig}>{maxRatioButton}</HoverCard>
        ) : (
          <Tooltip title={maxRatioButtonConfig.title}>{maxRatioButton}</Tooltip>
        )}

        <Tooltip title={t('canvas.toolbar.exportImage')}>{exportImageButton}</Tooltip>
      </div>
    );
  },
);

import { useState, useCallback, memo, useMemo } from 'react';
import { Button, Tooltip, Popover, Dropdown, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import {
  IconAskAI,
  IconSlideshow,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { Download, Search, Touchpad, Mouse, ArrowDown } from 'refly-icons';
import { NodeSelector } from '../common/node-selector';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { IContextItem } from '@refly/common-types';
import { useReactFlow } from '@xyflow/react';
import { HoverCard } from '@refly-packages/ai-workspace-common/components/hover-card';
import { useHoverCard } from '@refly-packages/ai-workspace-common/hooks/use-hover-card';
import { useExportCanvasAsImage } from '@refly-packages/ai-workspace-common/hooks/use-export-canvas-as-image';
import { useCanvasStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { Help } from '@refly-packages/ai-workspace-common/components/canvas/layout-control/help';
import { logEvent } from '@refly/telemetry-web';
export type Mode = 'mouse' | 'touchpad';

// Add interface for TooltipButton props
interface TooltipButtonProps {
  tooltip: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

// Add interfaces for component props
interface ModeSelectorProps {
  mode: 'mouse' | 'touchpad';
  open: boolean;
  setOpen: (open: boolean) => void;
  items: any[]; // Type this according to your items structure
  onModeChange: (mode: 'mouse' | 'touchpad') => void;
  t: TFunction;
}

// Update component definition
export const TooltipButton = memo(({ tooltip, children, ...buttonProps }: TooltipButtonProps) => (
  <Tooltip title={tooltip} arrow={false}>
    <Button type="text" {...buttonProps}>
      {children}
    </Button>
  </Tooltip>
));

const ModeSelector = memo(({ mode, open, setOpen, items, onModeChange, t }: ModeSelectorProps) => (
  <Dropdown
    menu={{
      items,
      onClick: ({ key }) => onModeChange(key as 'mouse' | 'touchpad'),
      selectedKeys: [mode],
      className: 'dark:bg-gray-800 dark:[&_.ant-dropdown-menu-item-selected]:bg-gray-700',
    }}
    trigger={['click']}
    open={open}
    onOpenChange={setOpen}
  >
    <Tooltip title={t('canvas.toolbar.tooltip.mode')} arrow={false}>
      <Button
        type="text"
        className="!p-0 h-[30px] w-[48px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 group"
      >
        {mode === 'mouse' ? <Mouse size={18} /> : <Touchpad size={18} />}
        <ArrowDown className={`ml-[-6px] ${open ? 'rotate-180' : ''}`} size={16} />
      </Button>
    </Tooltip>
  </Dropdown>
));
ModeSelector.displayName = 'ModeSelector';

export const ToolbarButtons = memo(
  ({
    canvasTitle,
    mode,
    changeMode,
  }: {
    canvasTitle: string;
    mode: 'mouse' | 'touchpad';
    changeMode: (mode: 'mouse' | 'touchpad') => void;
  }) => {
    const { t } = useTranslation();
    const { exportCanvasAsImage, isLoading } = useExportCanvasAsImage();
    const [searchOpen, setSearchOpen] = useState(false);
    const [modeOpen, setModeOpen] = useState(false);
    const { setNodeCenter } = useNodePosition();
    const { getNodes } = useReactFlow();
    const { hoverCardEnabled } = useHoverCard();
    const { readonly, canvasId } = useCanvasContext();

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
        }
      },
      [getNodes, setNodeCenter],
    );

    // Memoize static configurations for mode selector
    const modeItems = useMemo(
      () => [
        {
          key: 'mouse',
          label: (
            <div className="flex items-center gap-2">
              <Mouse size={18} />
              {t('canvas.toolbar.mouse')}
            </div>
          ),
        },
        {
          key: 'touchpad',
          label: (
            <div className="flex items-center gap-2">
              <Touchpad size={18} />
              {t('canvas.toolbar.touchpad')}
            </div>
          ),
        },
      ],
      [t],
    );

    const linearThreadButtonConfig = {
      title: t(`canvas.toolbar.${showLinearThread ? 'hideLaunchpad' : 'showLaunchpad'}`, {
        defaultValue: showLinearThread ? 'Hide Pilot' : 'Show Pilot',
      }),
      description: t('canvas.toolbar.toggleLaunchpadTitle', {
        defaultValue: 'Toggle the visibility of Pilot Panel',
      }),
      placement: 'bottom' as const,
    };

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
        icon={<Download size={18} />}
        onClick={() => {
          logEvent('canvas::canvas_download_image', Date.now(), {
            canvas_id: canvasId,
          });
          exportCanvasAsImage(canvasTitle);
        }}
      />
    );

    const slideshowButton = (
      <Button
        type="text"
        icon={<IconSlideshow size={18} />}
        onClick={() => {
          logEvent('canvas::canvas_demo_click', Date.now(), {
            canvas_id: canvasId,
          });
          setShowSlideshow(!showSlideshow);
        }}
      />
    );

    return (
      <>
        {false && (
          <div className="flex items-center h-9 bg-[#ffffff] rounded-lg px-2 border border-solid border-1 border-[#EAECF0] box-shadow-[0px_2px_6px_0px_rgba(0,0,0,0.1)] dark:bg-gray-900 dark:border-gray-700">
            {hoverCardEnabled ? (
              <HoverCard {...linearThreadButtonConfig}>{linearThreadButton}</HoverCard>
            ) : (
              <Tooltip title={linearThreadButtonConfig.title}>{linearThreadButton}</Tooltip>
            )}
          </div>
        )}

        <div className="flex items-center">
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
              <Button type="text" icon={<Search size={18} />} />
            </Tooltip>
          </Popover>

          <Tooltip title={t('canvas.toolbar.exportImage')}>{exportImageButton}</Tooltip>

          <Divider type="vertical" className="h-5 bg-refly-Card-Border" />

          <ModeSelector
            mode={mode}
            open={modeOpen}
            setOpen={setModeOpen}
            items={modeItems}
            onModeChange={changeMode}
            t={t}
          />

          <Help />
        </div>
      </>
    );
  },
);

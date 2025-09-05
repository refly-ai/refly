import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button, Dropdown } from 'antd';
import { useTranslation } from 'react-i18next';
import { ZoomIn, ZoomOut, Reload, Fullscreen, AutoLayout } from 'refly-icons';
import { useReactFlow, useOnViewportChange } from '@xyflow/react';
import { useCanvasLayout } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-layout';

// Common menu item label component
interface MenuItemLabelProps {
  icon: React.ReactNode;
  text: string;
  shortcut?: string;
  className?: string;
  handleClick?: () => void;
}

const MenuItemLabel = memo<MenuItemLabelProps>(
  ({
    icon,
    text,
    shortcut,
    className = 'w-32 flex items-center justify-between gap-1',
    handleClick,
  }) => {
    return (
      <div
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          handleClick?.();
        }}
      >
        <div className="flex items-center gap-1">
          {icon}
          <span>{text}</span>
        </div>
        {shortcut && <span className="text-xs text-gray-400">{shortcut}</span>}
      </div>
    );
  },
);

MenuItemLabel.displayName = 'MenuItemLabel';

export const CanvasLayoutControls = memo(() => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const reactFlowInstance = useReactFlow();
  const { onLayout } = useCanvasLayout();
  const timeoutRef = useRef<NodeJS.Timeout>();

  const minZoom = 0.25;
  const maxZoom = 2;

  // Handle viewport changes to update zoom percentage
  useOnViewportChange({
    onChange: useCallback(
      ({ zoom }: { zoom: number }) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          if (Math.abs(zoom - currentZoom) > 0.01) {
            setCurrentZoom(zoom);
          }
        }, 15);
      },
      [currentZoom],
    ),
  });

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Update CSS custom property for resize control scaling
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--current-zoom',
      Math.min(currentZoom, 1).toString(),
    );

    return () => {
      document.documentElement.style.removeProperty('--current-zoom');
    };
  }, [currentZoom]);

  // Zoom control handlers
  const handleZoomIn = useCallback(() => {
    if (currentZoom < maxZoom) {
      const newZoom = Math.min(currentZoom + 0.25, maxZoom);
      const viewport = reactFlowInstance?.getViewport?.();
      if (viewport) {
        reactFlowInstance?.setViewport?.({ ...viewport, zoom: newZoom });
      }
    }
  }, [currentZoom, reactFlowInstance, maxZoom]);

  const handleZoomOut = useCallback(() => {
    if (currentZoom > minZoom) {
      const newZoom = Math.max(currentZoom - 0.25, minZoom);
      const viewport = reactFlowInstance?.getViewport?.();
      if (viewport) {
        reactFlowInstance?.setViewport?.({ ...viewport, zoom: newZoom });
      }
    }
  }, [currentZoom, reactFlowInstance, minZoom]);

  const handleZoomReset = useCallback(() => {
    reactFlowInstance?.zoomTo(1);
  }, [reactFlowInstance]);

  const handleFitView = useCallback(() => {
    reactFlowInstance?.fitView();
  }, [reactFlowInstance]);

  const handleAutoLayout = useCallback(() => {
    onLayout('LR');
  }, [onLayout]);

  const canZoomIn = currentZoom < maxZoom;
  const canZoomOut = currentZoom > minZoom;

  // Dropdown menu items
  const menuItems = useMemo(
    () => [
      {
        key: 'zoomIn',
        label: (
          <MenuItemLabel
            icon={<ZoomIn size={18} />}
            text={t('canvas.toolbar.tooltip.zoomIn')}
            // shortcut="⌘+"
            handleClick={handleZoomIn}
          />
        ),
        disabled: !canZoomIn,
      },
      {
        key: 'zoomOut',
        label: (
          <MenuItemLabel
            icon={<ZoomOut size={18} />}
            text={t('canvas.toolbar.tooltip.zoomOut')}
            // shortcut="⌘-"
            handleClick={handleZoomOut}
          />
        ),
        disabled: !canZoomOut,
      },
      {
        key: 'zoomReset',
        label: (
          <MenuItemLabel
            icon={<Reload size={18} />}
            text={t('canvas.toolbar.tooltip.zoomReset')}
            // shortcut="⌘1"
            handleClick={handleZoomReset}
          />
        ),
      },
      {
        type: 'divider' as const,
      },
      {
        key: 'fullscreen',
        label: (
          <MenuItemLabel
            icon={<Fullscreen size={18} />}
            text={t('canvas.toolbar.tooltip.fitView')}
            handleClick={handleFitView}
          />
        ),
      },
      {
        key: 'autoLayout',
        label: (
          <MenuItemLabel
            icon={<AutoLayout size={18} />}
            text={t('canvas.toolbar.tooltip.layout')}
            handleClick={handleAutoLayout}
          />
        ),
      },
    ],
    [
      t,
      handleZoomIn,
      handleZoomOut,
      handleZoomReset,
      handleFitView,
      handleAutoLayout,
      canZoomIn,
      canZoomOut,
    ],
  );

  return (
    <Dropdown
      menu={{
        items: menuItems,
        className: 'dark:bg-gray-800 dark:[&_.ant-dropdown-menu-item-selected]:bg-gray-700',
      }}
      trigger={['click']}
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      destroyOnHidden={false}
    >
      <Button
        color="default"
        variant="filled"
        className="px-3 py-1.5 flex items-center justify-center "
      >
        <span className="text-sm font-semibold text-refly-text-0">
          {Math.round(currentZoom * 100)}%
        </span>
      </Button>
    </Dropdown>
  );
});

CanvasLayoutControls.displayName = 'CanvasLayoutControls';

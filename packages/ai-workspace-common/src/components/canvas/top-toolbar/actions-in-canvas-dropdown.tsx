import { useState, memo, useCallback, useMemo, useEffect } from 'react';
import { Dropdown, DropdownProps, MenuProps } from 'antd';
import { ArrowDown } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import './index.scss';
import { cn } from '@refly/utils/cn';
import { useNavigate } from 'react-router-dom';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useCanvasLayout } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-layout';
import { ReactFlowState, useReactFlow, useStore } from '@xyflow/react';
import { reflyEnv } from '@refly/utils/env';
import { useCanvasOperationStoreShallow } from '@refly/stores';
import { Home } from 'refly-icons';

interface MenuItemLabelProps {
  icon?: React.ReactNode;
  text: string;
  shortcut?: string;
  className?: string;
  handleClick?: () => void;
  loading?: boolean;
}

const MenuItemLabel = memo<MenuItemLabelProps>(
  ({
    icon,
    text,
    shortcut,
    className = 'min-w-32 flex items-center justify-between gap-1',
    handleClick,
    loading,
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
          {icon ? icon : null}
          <span className="select-none">{text}</span>
          {loading && <Spin size="small" className="text-refly-text-3" />}
        </div>
        {shortcut && <span className="text-xs text-refly-text-2 select-none">{shortcut}</span>}
      </div>
    );
  },
);

MenuItemLabel.displayName = 'MenuItemLabel';

interface ActionsInCanvasDropdownProps {
  canvasId: string;
  canvasName: string;
  onRename: () => void;
  onDeleteSuccess?: () => void;
  offset?: [number, number];
}

export const ActionsInCanvasDropdown = memo((props: ActionsInCanvasDropdownProps) => {
  const { canvasId, canvasName, offset, onRename, onDeleteSuccess } = props;
  const [popupVisible, setPopupVisible] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { duplicateCanvas, loading: duplicateLoading } = useDuplicateCanvas();
  const { openDeleteModal } = useCanvasOperationStoreShallow((state) => ({
    openDeleteModal: state.openDeleteModal,
  }));
  const { undo, redo } = useCanvasContext();

  const currentZoom = useStore((state: ReactFlowState) => state.transform?.[2] ?? 1);
  const reactFlowInstance = useReactFlow();
  const { onLayout } = useCanvasLayout();

  const minZoom = 0.25;
  const maxZoom = 2;

  const isMac = useMemo(() => {
    try {
      return reflyEnv?.getOsType?.() === 'OSX';
    } catch {
      return false;
    }
  }, []);

  const handleBackDashboard = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleRename = useCallback(() => {
    onRename();
    setPopupVisible(false);
  }, [onRename, setPopupVisible]);

  const hideDropdown = useCallback(() => {
    setPopupVisible(false);
  }, [setPopupVisible]);

  const handleDuplicate = useCallback(() => {
    duplicateCanvas({
      canvasId,
      title: canvasName ?? t('common.untitled'),
      isCopy: true,
      onSuccess: hideDropdown,
    });
  }, [canvasId, canvasName, hideDropdown]);

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

  const handleFitView = useCallback(() => {
    reactFlowInstance?.fitView();
  }, [reactFlowInstance]);

  const handleAutoLayout = useCallback(() => {
    onLayout('LR');
  }, [onLayout]);

  const canZoomIn = currentZoom < maxZoom;
  const canZoomOut = currentZoom > minZoom;

  const items: MenuProps['items'] = useMemo(
    () => [
      {
        label: (
          <MenuItemLabel
            text={t('canvas.toolbar.backDashboard')}
            handleClick={handleBackDashboard}
          />
        ),
        key: 'backDashboard',
      },
      { type: 'divider' },
      {
        label: <MenuItemLabel text={t('canvas.toolbar.rename')} handleClick={handleRename} />,
        key: 'rename',
      },
      // {
      //   label: (
      //     <MenuItemLabel
      //       text={t('canvas.toolbar.tooltip.duplicateWorkflow')}
      //       handleClick={handleDuplicate}
      //       loading={duplicateLoading}
      //     />
      //   ),
      //   key: 'duplicate',
      //   disabled: duplicateLoading,
      // },
      {
        label: (
          <div
            className="flex items-center text-refly-func-danger-default gap-1 w-32"
            onClick={(e) => {
              e.stopPropagation();
              openDeleteModal(canvasId, canvasName, () => {
                // After successful deletion, navigate back to dashboard to prevent canvas not found error
                handleBackDashboard();
                onDeleteSuccess?.();
              });
              setPopupVisible(false);
            }}
          >
            {t('canvas.toolbar.deleteCanvas')}
          </div>
        ),
        key: 'delete',
      },
      {
        type: 'divider' as const,
      },
      {
        label: (
          <MenuItemLabel
            text={t('canvas.toolbar.tooltip.undo')}
            handleClick={undo}
            shortcut={isMac ? '⌘Z' : 'CtrlZ'}
          />
        ),
        key: 'undo',
      },
      {
        label: (
          <MenuItemLabel
            text={t('canvas.toolbar.tooltip.redo')}
            handleClick={redo}
            shortcut={isMac ? '⌘⇧Z' : 'Ctrl⇧Z'}
          />
        ),
        key: 'redo',
      },

      {
        key: 'zoomIn',
        label: (
          <MenuItemLabel
            text={t('canvas.toolbar.tooltip.zoomIn')}
            shortcut={isMac ? '⌘+' : 'Ctrl+'}
            handleClick={handleZoomIn}
          />
        ),
        disabled: !canZoomIn,
      },
      {
        key: 'zoomOut',
        label: (
          <MenuItemLabel
            text={t('canvas.toolbar.tooltip.zoomOut')}
            shortcut={isMac ? '⌘-' : 'Ctrl-'}
            handleClick={handleZoomOut}
          />
        ),
        disabled: !canZoomOut,
      },

      {
        key: 'fullscreen',
        label: (
          <MenuItemLabel
            text={t('canvas.toolbar.tooltip.fitView')}
            handleClick={handleFitView}
            shortcut={isMac ? '⌘0' : 'Ctrl0'}
          />
        ),
      },
      {
        key: 'autoLayout',
        label: (
          <MenuItemLabel
            text={t('canvas.toolbar.tooltip.layout')}
            handleClick={handleAutoLayout}
            shortcut={isMac ? '⌘⇧L' : 'Ctrl⇧L'}
          />
        ),
      },
    ],
    [
      handleBackDashboard,
      handleRename,
      handleDuplicate,
      duplicateLoading,
      undo,
      redo,
      handleZoomIn,
      handleZoomOut,
      handleFitView,
      handleAutoLayout,
      canZoomIn,
      canZoomOut,
      t,
      canvasId,
      canvasName,
      onDeleteSuccess,
    ],
  );

  const handleOpenChange: DropdownProps['onOpenChange'] = (open: boolean, info: any) => {
    if (info.source === 'trigger') {
      setPopupVisible(open);
    }
  };

  return (
    <Dropdown
      overlayClassName="main-action-in-canvas-dropdown"
      trigger={['hover']}
      open={popupVisible}
      onOpenChange={handleOpenChange}
      menu={{
        items,
        ...(offset && {
          style: {
            top: offset[1],
            left: offset[0],
          },
        }),
      }}
    >
      <div
        className={cn(
          'flex-shrink-0 flex gap-1 items-center justify-center h-[30px] p-1 hover:bg-refly-tertiary-hover rounded-lg cursor-pointer',
          { 'bg-refly-tertiary-hover': popupVisible },
        )}
      >
        <Home size={20} />
        <ArrowDown size={10} />
      </div>
    </Dropdown>
  );
});

ActionsInCanvasDropdown.displayName = 'ActionsInCanvasDropdown';

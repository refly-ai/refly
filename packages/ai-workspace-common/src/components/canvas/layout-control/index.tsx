import React, { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import { Button, Dropdown, Space, Divider, Tooltip } from 'antd';
import { LuLayoutDashboard, LuLightbulb, LuShipWheel } from 'react-icons/lu';
import { RiFullscreenFill } from 'react-icons/ri';
import { FiHelpCircle } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { LuUndo, LuRedo, LuZoomIn, LuZoomOut } from 'react-icons/lu';
import {
  IconDocumentation,
  IconDown,
  IconMouse,
  IconTouchpad,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { useReactFlow, useOnViewportChange } from '@xyflow/react';
import { useCanvasLayout } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-layout';
import { TFunction } from 'i18next';

import './index.scss';
import { useUserStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

interface LayoutControlProps {
  mode: 'mouse' | 'touchpad';
  changeMode: (mode: 'mouse' | 'touchpad') => void;
  readonly: boolean;
}

const iconClass = 'flex items-center justify-center text-base';
const buttonClass = '!p-0 h-[30px] w-[30px] flex items-center justify-center ';

// Add interface for TooltipButton props
interface TooltipButtonProps {
  tooltip: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

// Add interfaces for component props
interface ActionButtonsProps {
  onFitView: () => void;
  onLayout: (direction: 'TB' | 'LR') => void;
  undo: () => void;
  redo: () => void;
  t: TFunction;
}

interface ModeSelectorProps {
  mode: 'mouse' | 'touchpad';
  open: boolean;
  setOpen: (open: boolean) => void;
  items: any[]; // Type this according to your items structure
  onModeChange: (mode: 'mouse' | 'touchpad') => void;
  t: TFunction;
}

interface ZoomControlsProps {
  currentZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  t: TFunction;
}

// Update component definition
const TooltipButton = memo(({ tooltip, children, ...buttonProps }: TooltipButtonProps) => (
  <Tooltip title={tooltip} arrow={false}>
    <Button type="text" {...buttonProps}>
      {children}
    </Button>
  </Tooltip>
));

// Update component definitions
const ActionButtons = memo(({ onFitView, onLayout, undo, redo, t }: ActionButtonsProps) => (
  <>
    <TooltipButton
      tooltip={t('canvas.toolbar.tooltip.undo')}
      onClick={() => undo()}
      className={buttonClass}
    >
      <LuUndo className={iconClass} size={16} />
    </TooltipButton>

    <TooltipButton
      tooltip={t('canvas.toolbar.tooltip.redo')}
      onClick={() => redo()}
      className={buttonClass}
    >
      <LuRedo className={iconClass} size={16} />
    </TooltipButton>

    <Divider type="vertical" className="h-full" />

    <TooltipButton
      tooltip={t('canvas.toolbar.tooltip.fitView')}
      onClick={onFitView}
      className={buttonClass}
    >
      <RiFullscreenFill className={iconClass} size={16} />
    </TooltipButton>

    <TooltipButton
      tooltip={t('canvas.toolbar.tooltip.layout')}
      onClick={() => onLayout('LR')}
      className={buttonClass}
    >
      <LuLayoutDashboard className={iconClass} size={16} />
    </TooltipButton>
  </>
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
        {mode === 'mouse' ? (
          <IconMouse className={iconClass} />
        ) : (
          <IconTouchpad className={iconClass} />
        )}
        <IconDown className={`ml-[-6px] ${iconClass} ${open ? 'rotate-180' : ''}`} />
      </Button>
    </Tooltip>
  </Dropdown>
));
ModeSelector.displayName = 'ModeSelector';

// Create a memoized zoom controls component
const ZoomControls = memo(
  ({
    currentZoom,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    canZoomIn,
    canZoomOut,
    t,
  }: ZoomControlsProps) => (
    <>
      <TooltipButton
        tooltip={t('canvas.toolbar.tooltip.zoomOut')}
        onClick={onZoomOut}
        disabled={!canZoomOut}
        className={`${buttonClass} ${!canZoomOut ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <LuZoomOut className={iconClass} size={16} />
      </TooltipButton>

      <TooltipButton
        tooltip={t('canvas.toolbar.tooltip.zoomReset')}
        className={`${buttonClass} mx-1.5`}
      >
        <div className="text-xs" onClick={onZoomReset}>
          {Math.round(currentZoom * 100)}%
        </div>
      </TooltipButton>

      <TooltipButton
        tooltip={t('canvas.toolbar.tooltip.zoomIn')}
        onClick={onZoomIn}
        disabled={!canZoomIn}
        className={`${buttonClass} ${!canZoomIn ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <LuZoomIn className={iconClass} size={16} />
      </TooltipButton>
    </>
  ),
);
ZoomControls.displayName = 'ZoomControls';

export const LayoutControl: React.FC<LayoutControlProps> = memo(
  ({ mode, changeMode, readonly }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const { onLayout } = useCanvasLayout();
    const reactFlowInstance = useReactFlow();
    const [currentZoom, setCurrentZoom] = useState(reactFlowInstance?.getZoom() ?? 1);
    const minZoom = 0.1;
    const maxZoom = 2;
    const { setShowTourModal, setShowSettingsGuideModal } = useUserStoreShallow((state) => ({
      setShowTourModal: state.setShowTourModal,
      setShowSettingsGuideModal: state.setShowSettingsGuideModal,
    }));

    // Use ref to avoid recreating the timeout on each render
    const timeoutRef = useRef<NodeJS.Timeout>();

    // Optimize viewport change handling
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
          }, 100);
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

    const handleZoomIn = useCallback(() => {
      if (currentZoom < maxZoom) {
        reactFlowInstance?.zoomIn?.();
      }
    }, [currentZoom, reactFlowInstance]);

    const handleZoomOut = useCallback(() => {
      if (currentZoom > minZoom) {
        reactFlowInstance?.zoomOut?.();
      }
    }, [currentZoom, reactFlowInstance]);

    const handleZoomReset = useCallback(() => {
      reactFlowInstance?.zoomTo(1);
    }, [reactFlowInstance]);

    const handleFitView = useCallback(() => {
      reactFlowInstance?.fitView();
    }, [reactFlowInstance]);

    const canZoomIn = currentZoom < maxZoom;
    const canZoomOut = currentZoom > minZoom;

    // Memoize static configurations
    const items = useMemo(
      () => [
        {
          key: 'mouse',
          label: (
            <Space>
              <IconMouse className={iconClass} />
              {t('canvas.toolbar.mouse')}
            </Space>
          ),
        },
        {
          key: 'touchpad',
          label: (
            <Space>
              <IconTouchpad className={iconClass} />
              {t('canvas.toolbar.touchpad')}
            </Space>
          ),
        },
      ],
      [t],
    );

    const { undo, redo } = useCanvasContext();

    const helpMenuItems = useMemo(
      () => [
        {
          key: 'settings',
          icon: <LuShipWheel className={iconClass} size={14} />,
          label: <Space>{t('canvas.toolbar.openSettings')}</Space>,
          onClick: () => setShowSettingsGuideModal(true),
        },
        {
          key: 'tour',
          icon: <LuLightbulb className={iconClass} size={14} />,
          label: <Space>{t('canvas.toolbar.openTour')}</Space>,
          onClick: () => setShowTourModal(true),
        },
        {
          key: 'docs',
          icon: <IconDocumentation className={iconClass} size={14} />,
          label: <Space>{t('canvas.toolbar.openDocs')}</Space>,
          onClick: () => window.open('https://docs.refly.ai', '_blank'),
        },
      ],
      [t, setShowSettingsGuideModal, setShowTourModal],
    );

    return (
      <>
        <div className="absolute bottom-2 left-2.5 px-1 h-[32px] border-box flex items-center justify-center bg-white rounded-md shadow-refly-m dark:bg-gray-900">
          <ZoomControls
            currentZoom={currentZoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            canZoomIn={canZoomIn}
            canZoomOut={canZoomOut}
            t={t}
          />

          <Divider type="vertical" className="h-full" />

          {!readonly && (
            <ActionButtons
              onFitView={handleFitView}
              onLayout={onLayout}
              undo={undo}
              redo={redo}
              t={t}
            />
          )}

          <ModeSelector
            mode={mode}
            open={open}
            setOpen={setOpen}
            items={items}
            onModeChange={changeMode}
            t={t}
          />

          <Divider type="vertical" className="h-full mx-0.5" />

          <Dropdown menu={{ items: helpMenuItems }} trigger={['click']}>
            <Tooltip title={t('canvas.toolbar.tooltip.help')} arrow={false}>
              <Button type="text" className={buttonClass}>
                <FiHelpCircle className={iconClass} size={16} />
              </Button>
            </Tooltip>
          </Dropdown>
        </div>
      </>
    );
  },
);

// Add display name for better debugging
LayoutControl.displayName = 'LayoutControl';

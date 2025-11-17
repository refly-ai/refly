import { memo, useCallback, useMemo } from 'react';
import { Button } from 'antd';
import { ZoomIn, ZoomOut, Location } from 'refly-icons';
import { ReactFlowState, useReactFlow, useStore } from '@xyflow/react';

export const CanvasControlButtons = memo(() => {
  const currentZoom = useStore((state: ReactFlowState) => state.transform?.[2] ?? 1);
  const reactFlowInstance = useReactFlow();

  const minZoom = 0.25;
  const maxZoom = 2;

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

  const canZoomIn = currentZoom < maxZoom;
  const canZoomOut = currentZoom > minZoom;

  const buttons = useMemo(
    () => [
      {
        icon: <Location size={16} />,
        onClick: handleFitView,
        disabled: false,
        key: 'fitView',
      },
      {
        icon: <ZoomIn size={16} />,
        onClick: handleZoomIn,
        disabled: !canZoomIn,
        key: 'zoomIn',
      },
      {
        icon: <ZoomOut size={16} />,
        onClick: handleZoomOut,
        disabled: !canZoomOut,
        key: 'zoomOut',
      },
    ],
    [handleFitView, handleZoomIn, handleZoomOut],
  );

  return (
    <div className="absolute px-1 py-4 bottom-[30px] left-[30px] flex flex-col gap-3 bg-refly-bg-content-z2 z-20 shadow-refly-m rounded-[18px] pointer-events-auto">
      {buttons.map((button) => (
        <Button
          key={button.key}
          type="text"
          className="flex items-center justify-center !w-6 !h-6"
          onClick={button.onClick}
          disabled={button.disabled}
          icon={button.icon}
        />
      ))}
    </div>
  );
});

CanvasControlButtons.displayName = 'CanvasControlButtons';

import mitt from 'mitt';

type CanvasEvents = {
  'canvas:drive-files:refetch': undefined;
};

export const canvasEmitter = mitt<CanvasEvents>();

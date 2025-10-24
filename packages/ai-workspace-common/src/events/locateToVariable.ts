import mitt from 'mitt';

export type Events = {
  locateToVariable: {
    canvasId: string;
    nodeId: string;
    variableId: string;
    variableName: string;
  };
};

export const locateToVariableEmitter = mitt<Events>();

import mitt from 'mitt';

export type ToolsetEvents = {
  toolsetInstalled: {
    toolset: any;
  };
  updateNodeToolset: {
    nodeId: string;
    toolsetKey: string;
    newToolsetId: string;
  };
};

export const toolsetEmitter = mitt<ToolsetEvents>();

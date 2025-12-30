import mitt from 'mitt';
import { GenericToolset } from '@refly/openapi-schema';

export type ToolsetEvents = {
  toolsetInstalled: {
    toolset: GenericToolset;
  };
  updateNodeToolset: {
    nodeId: string;
    toolsetKey: string;
    newToolsetId: string;
  };
};

export const toolsetEmitter = mitt<ToolsetEvents>();

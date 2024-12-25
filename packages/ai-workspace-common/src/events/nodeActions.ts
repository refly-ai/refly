import mitt from 'mitt';

export type NodeActionEvents = {
  [key: `node:${string}:rerun`]: void;
  [key: `node:${string}:delete`]: void;
  [key: `node:${string}:addToContext`]: void;
  [key: `node:${string}:createDocument`]: void;
  [key: `node:${string}:insertToDoc`]: {
    content?: string;
  };
};

export const nodeActionEmitter = mitt<NodeActionEvents>();

export const createNodeEventName = (nodeId: string, action: string) =>
  `node:${nodeId}:${action}` as keyof NodeActionEvents;

export const cleanupNodeEvents = (nodeId: string) => {
  const eventTypes = ['rerun', 'delete', 'addToContext', 'createDocument', 'insertToDoc'];
  eventTypes.forEach((type) => {
    nodeActionEmitter.all.delete(createNodeEventName(nodeId, type));
  });
};

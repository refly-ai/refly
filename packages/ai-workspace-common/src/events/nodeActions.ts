import mitt from 'mitt';

export type NodeActionEvents = {
  [key: `node:${string}:rerun`]: undefined;
  [key: `node:${string}:delete`]: undefined;
  [key: `node:${string}:addToContext`]: undefined;
  [key: `node:${string}:createDocument`]: undefined;
  [key: `node:${string}:createDocument.completed`]: undefined;
  [key: `node:${string}:ungroup`]: undefined;
  [key: `node:${string}:insertToDoc`]: {
    content?: string;
  };
  [key: `node:${string}:askAI`]: undefined;
  [key: `node:${string}:cloneAskAI`]: undefined;
  [key: `node:${string}:cloneAskAI.completed`]: undefined;
  [key: `node:${string}:fullScreenPreview`]: undefined;
};

export const nodeActionEmitter = mitt<NodeActionEvents>();

export const createNodeEventName = (nodeId: string, action: string) =>
  `node:${nodeId}:${action}` as keyof NodeActionEvents;

export const cleanupNodeEvents = (nodeId: string) => {
  const eventTypes = [
    'run',
    'rerun',
    'delete',
    'addToContext',
    'createDocument',
    'insertToDoc',
    'ungroup',
    'askAI',
    'cloneAskAI',
    'cloneAskAI.completed',
  ];
  for (const type of eventTypes) {
    nodeActionEmitter.all.delete(createNodeEventName(nodeId, type));
  }
};

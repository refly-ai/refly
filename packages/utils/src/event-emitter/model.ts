import mitt from 'mitt';

type ModelEvents = {
  'model:list:refetch': null;
};

export const modelEmitter = mitt<ModelEvents>();

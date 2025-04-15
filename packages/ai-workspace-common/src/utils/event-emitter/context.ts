import mitt from 'mitt';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';

// Define event types
type ContextEventTypes = {
  addToContext: {
    contextItem: IContextItem;
    resultId: string;
  };
  addToContextCompleted: {
    contextItem: IContextItem;
    resultId: string;
    success: boolean;
  };
};

// Create the event emitter instance
export const contextEmitter = mitt<ContextEventTypes>();

// Helper function for adding a context item
export const emitAddToContext = (contextItem: IContextItem, resultId: string) => {
  contextEmitter.emit('addToContext', { contextItem, resultId });
};

// Helper function for completing addition of a context item
export const emitAddToContextCompleted = (
  contextItem: IContextItem,
  resultId: string,
  success: boolean,
) => {
  contextEmitter.emit('addToContextCompleted', { contextItem, resultId, success });
};

// Helper function to clean up event handlers
export const cleanupContextEvents = () => {
  contextEmitter.all.clear();
};

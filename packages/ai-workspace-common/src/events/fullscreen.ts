import mitt from 'mitt';

// Define the event types for fullscreen management
export type FullscreenEvents = {
  // Event to exit fullscreen when requesting a fix for code
  exitFullscreenForFix: {
    nodeId: string;
  };
};

// Create and export the event emitter for fullscreen events
export const fullscreenEmitter = mitt<FullscreenEvents>();

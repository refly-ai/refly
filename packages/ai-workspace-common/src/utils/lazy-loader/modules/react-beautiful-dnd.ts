/**
 * react-beautiful-dnd lazy loader
 * Provides lazy loaded drag and drop functionality
 */

import { createLazyLoader } from '../core';
import type {
  DragDropContext as DragDropContextType,
  Droppable as DroppableType,
  Draggable as DraggableType,
  DropResult,
  DraggingStyle,
  NotDraggingStyle,
  DroppableProvided,
  DraggableProvided,
  DraggableStateSnapshot,
  DroppableStateSnapshot,
} from 'react-beautiful-dnd';

// Re-export types for consumers
export type {
  DropResult,
  DraggingStyle,
  NotDraggingStyle,
  DroppableProvided,
  DraggableProvided,
  DraggableStateSnapshot,
  DroppableStateSnapshot,
};

// Types for the react-beautiful-dnd module exports
interface ReactBeautifulDndModuleExports {
  DragDropContext: typeof DragDropContextType;
  Droppable: typeof DroppableType;
  Draggable: typeof DraggableType;
}

/**
 * react-beautiful-dnd lazy loader
 */
export const reactBeautifulDndLoader = createLazyLoader<
  ReactBeautifulDndModuleExports,
  ReactBeautifulDndModuleExports
>({
  name: 'react-beautiful-dnd',
  loader: () => import('react-beautiful-dnd'),
  extractor: (m) => m as ReactBeautifulDndModuleExports,
  timeout: 30000,
  cache: true,
  retries: 1,
});

/**
 * Get the react-beautiful-dnd module
 */
export const getReactBeautifulDnd = (): Promise<ReactBeautifulDndModuleExports> =>
  reactBeautifulDndLoader.get();

/**
 * Preload react-beautiful-dnd (call when user is likely to need drag-drop soon)
 */
export const preloadReactBeautifulDnd = (): void => reactBeautifulDndLoader.preload();

/**
 * Lazy-loaded react-beautiful-dnd wrapper components
 * Provides drop-in replacements that load the library on-demand
 */

import React, { Suspense, lazy, useEffect } from 'react';
import type { DragDropContextProps, DroppableProps, DraggableProps } from 'react-beautiful-dnd';
import { Skeleton } from 'antd';

// Re-export types for convenience
export type {
  DropResult,
  DraggingStyle,
  NotDraggingStyle,
  DroppableProvided,
  DraggableProvided,
  DraggableStateSnapshot,
  DroppableStateSnapshot,
} from 'react-beautiful-dnd';

// Lazy load the internal components
const InternalDragDropContext = lazy(() =>
  import('react-beautiful-dnd').then((mod) => ({
    default: mod.DragDropContext,
  })),
);

const InternalDroppable = lazy(() =>
  import('react-beautiful-dnd').then((mod) => ({
    default: mod.Droppable,
  })),
);

const InternalDraggable = lazy(() =>
  import('react-beautiful-dnd').then((mod) => ({
    default: mod.Draggable,
  })),
);

/**
 * Loading placeholder for DnD components
 */
const DndLoadingFallback: React.FC<{ height?: number | string }> = ({ height = 100 }) => (
  <div style={{ height, opacity: 0.5 }}>
    <Skeleton active paragraph={{ rows: 2 }} />
  </div>
);

/**
 * Lazy-loaded DragDropContext wrapper
 */
export const LazyDnDContext: React.FC<DragDropContextProps & { fallback?: React.ReactNode }> = ({
  fallback,
  children,
  ...props
}) => {
  return (
    <Suspense fallback={fallback || null}>
      <InternalDragDropContext {...props}>{children}</InternalDragDropContext>
    </Suspense>
  );
};

/**
 * Lazy-loaded Droppable wrapper
 */
export const LazyDroppable: React.FC<DroppableProps & { fallback?: React.ReactNode }> = ({
  fallback,
  children,
  ...props
}) => {
  return (
    <Suspense fallback={fallback || <DndLoadingFallback />}>
      <InternalDroppable {...props}>{children}</InternalDroppable>
    </Suspense>
  );
};

/**
 * Lazy-loaded Draggable wrapper
 */
export const LazyDraggable: React.FC<DraggableProps & { fallback?: React.ReactNode }> = ({
  fallback,
  children,
  ...props
}) => {
  return (
    <Suspense fallback={fallback || null}>
      <InternalDraggable {...props}>{children}</InternalDraggable>
    </Suspense>
  );
};

/**
 * Hook to preload react-beautiful-dnd
 * Call this when user is likely to need DnD functionality soon
 */
export function usePreloadDnd(): void {
  useEffect(() => {
    // Preload on mount
    const timer = setTimeout(() => {
      import('react-beautiful-dnd');
    }, 100);
    return () => clearTimeout(timer);
  }, []);
}

/**
 * Preload function for imperative usage
 */
export function preloadDnd(): void {
  import('react-beautiful-dnd');
}

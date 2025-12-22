import { memo } from 'react';
import { InternalToolRendererProps } from './types';
import { ToolCallStatus } from '../types';

interface DefaultInternalRendererProps extends InternalToolRendererProps {
  toolsetName: string;
}

/**
 * Default fallback renderer for unknown internal tools
 */
export const DefaultInternalRenderer = memo<DefaultInternalRendererProps>(
  ({ toolCallStatus, toolsetName }) => {
    const isExecuting = toolCallStatus === ToolCallStatus.EXECUTING;

    return (
      <div className="flex items-center gap-1 py-1 px-3 text-sm">
        <span className={isExecuting ? 'text-shimmer' : 'text-refly-text-0'}>{toolsetName}</span>
      </div>
    );
  },
);

DefaultInternalRenderer.displayName = 'DefaultInternalRenderer';
